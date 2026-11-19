/**
 * Parser, validator, and formatter for user-supplied electron density files (ELSEPA MELEC 5).
 *
 * ELSEPA reads density.usr:
 * - skips 3 header lines
 * - reads at most NDIN - 1 = 999 R RHO pairs: its loop reads NDIN = 1000 lines and stops with
 *   'File is too large' if no end of file was met (requires at least 5 points for its cubic spline)
 * - takes LOG(RHO), so RHO must be > 0 and R > 0 strictly increasing
 * - units: R in bohr (a0), RHO in electrons/bohr^3
 * - normalized: 4*pi*integral(RHO * R^2 dR) = number of bound electrons NELEC = Z - q
 */

export interface DensityParseResult {
  points: number;
  electrons: number;
  normalized: string;
  errors: string[];
}

export const MIN_DENSITY_POINTS = 5;
export const MAX_DENSITY_POINTS = 999;

/**
 * Parses user-supplied electron density text into normalized ELSEPA format.
 * Ignores blank lines and comments starting with '#'.
 * Accepts two numeric columns separated by whitespace or commas. Supports Fortran D exponents.
 */
export function parseDensityFile(text: string, filename?: string): DensityParseResult {
  const errors: string[] = [];
  if (!text || typeof text !== 'string') {
    return { points: 0, electrons: 0, normalized: '', errors: ['Density file is empty.'] };
  }

  const rawLines = text.split(/\r?\n/);
  const parsedPoints: { r: number; rho: number; rText: string; rhoText: string }[] = [];
  let prevR = -Infinity;

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const trimmed = rawLines[lineIdx].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Line ${lineIdx + 1}: expected 2 numeric columns (radius, density), but found ${parts.length}.`);
      continue;
    }

    const rText = parts[0].replace(/D/gi, 'E');
    const rhoText = parts[1].replace(/D/gi, 'E');
    const rNum = Number(rText);
    const rhoNum = Number(rhoText);

    if (!Number.isFinite(rNum) || !Number.isFinite(rhoNum)) {
      errors.push(`Line ${lineIdx + 1}: values must be finite numbers (got "${parts[0]}", "${parts[1]}").`);
      continue;
    }

    if (rNum <= 0) {
      errors.push(`Line ${lineIdx + 1}: radius r must be strictly positive (got ${rNum}).`);
    } else if (rNum <= prevR) {
      errors.push(`Line ${lineIdx + 1}: radius r must be strictly increasing (${rNum} <= ${prevR}).`);
    }

    if (rhoNum <= 0) {
      errors.push(`Line ${lineIdx + 1}: electron density rho must be strictly positive (got ${rhoNum}).`);
    }

    prevR = rNum;
    parsedPoints.push({ r: rNum, rho: rhoNum, rText, rhoText });
  }

  const points = parsedPoints.length;
  if (points < MIN_DENSITY_POINTS) {
    errors.push(`Density file must have at least ${MIN_DENSITY_POINTS} data points (found ${points}).`);
  } else if (points > MAX_DENSITY_POINTS) {
    errors.push(`Density file exceeds maximum of ${MAX_DENSITY_POINTS} data points (found ${points}).`);
  }

  // Calculate integrated electron count: 4 * pi * integral(rho * r^2 dr) using trapezoidal rule
  let sum = 0;
  if (points >= 2) {
    for (let i = 0; i < points - 1; i++) {
      const p1 = parsedPoints[i];
      const p2 = parsedPoints[i + 1];
      const y1 = p1.rho * p1.r * p1.r;
      const y2 = p2.rho * p2.r * p2.r;
      sum += 0.5 * (y1 + y2) * (p2.r - p1.r);
    }
  }
  const electrons = 4 * Math.PI * sum;

  let normalized = '';
  if (errors.length === 0) {
    const srcName = filename ? filename.trim() : 'user-supplied';
    const headerLines = [
      ' # User-supplied electron density',
      ` # Source file: ${srcName}`,
      ' #      R           RHO(R)',
    ];
    // Write the numbers as the user gave them, so no precision is lost before ELSEPA reads them.
    const dataLines = parsedPoints.map((p) => ` ${p.rText}  ${p.rhoText}`);
    normalized = [...headerLines, ...dataLines].join('\n') + '\n';
  }

  return {
    points,
    electrons,
    normalized,
    errors,
  };
}

/**
 * Returns a warning string when the integrated electron count differs from the
 * expected number of bound electrons (NELEC = Z - ionCharge) by more than 1%.
 */
export function checkElectronCountWarning(electrons: number, nelec: number): string | null {
  if (!Number.isFinite(electrons) || !Number.isFinite(nelec) || nelec <= 0) {
    return null;
  }
  const relDiff = Math.abs(electrons - nelec) / nelec;
  if (relDiff > 0.01) {
    const pct = (relDiff * 100).toFixed(1);
    return `Integrated electron count (${electrons.toFixed(3)}) differs from expected bound electrons (${nelec}) by ${pct}% (>1% tolerance).`;
  }
  return null;
}

/**
 * Re-validates a user-supplied density received from a client (the server must not trust it).
 * Returns the normalized ELSEPA text, an error message, or nothing for other density models.
 */
export function checkCustomDensity(params: {
  densityModel?: string;
  customDensityData?: string;
  customDensityName?: string;
}): { data?: string; error?: string } {
  if (params.densityModel !== 'custom-file') return {};
  if (typeof params.customDensityData !== 'string' || !params.customDensityData.trim()) {
    return { error: 'A user-supplied electron density file is required for the custom-file density model.' };
  }
  const parsed = parseDensityFile(params.customDensityData, params.customDensityName);
  if (parsed.errors.length > 0) {
    return { error: `Invalid user-supplied electron density: ${parsed.errors.slice(0, 3).join('; ')}` };
  }
  return { data: parsed.normalized };
}

/**
 * Parses ELSEPA electrostatic field tables (`esfield.dat` or `scfield.dat`) into
 * an array of radial electron density points (r in bohr, rho in electrons/bohr^3).
 *
 * In ELSEPA 2021:
 * - `esfield.dat` (written by subroutine EFIELD when IWR > 0, ~line 1432) has columns:
 *     I, R(I), RHON(I), RVN(I), DEN(I), RVST(I)
 *   where DEN(I) = 4*pi*r^2*rho(r) (radial distribution function D(r)). Thus rho = DEN / (4*pi*r^2).
 * - `scfield.dat` (written by subroutine ELSEPA when ELSCATA runs, ~line 878) has columns:
 *     i, r, r*V, r*Vst, r*Vex, r*Vpol, r*Wabs, rho_e
 *   where column 8 (rho_e) directly gives rho(r) in electrons/bohr^3.
 *
 * Points with r <= 0 are omitted as ELSEPA density grids require strictly positive r > 0.
 */
export function parseEsfield(input: string | Record<string, string>): { r: number; rho: number }[] {
  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (input && typeof input === 'object') {
    text = input['esfield.dat'] || input['scfield.dat'] || '';
  }

  if (!text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const points: { r: number; rho: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 8) {
      // scfield.dat format: i, r, r*V, r*Vst, r*Vex, r*Vpol, r*Wabs, rho_e
      const r = Number(parts[1].replace(/D/gi, 'E'));
      const rho = Number(parts[7].replace(/D/gi, 'E'));
      if (Number.isFinite(r) && Number.isFinite(rho) && r > 0 && rho > 0) {
        points.push({ r, rho });
      }
    } else if (parts.length >= 6) {
      // esfield.dat format: I, R(I), RHON(I), RVN(I), DEN(I), RVST(I)
      const r = Number(parts[1].replace(/D/gi, 'E'));
      const den = Number(parts[4].replace(/D/gi, 'E'));
      if (Number.isFinite(r) && Number.isFinite(den) && r > 0 && den > 0) {
        const rho = den / (4 * Math.PI * r * r);
        if (Number.isFinite(rho) && rho > 0) {
          points.push({ r, rho });
        }
      }
    }
  }

  return points;
}

