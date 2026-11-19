/**
 * Pure numerical methods and transformation tools for radial electron densities.
 * All editing operations preserve rho > 0 and operate in log space where appropriate.
 */

import { parseDensityFile, checkElectronCountWarning, MIN_DENSITY_POINTS, MAX_DENSITY_POINTS } from './densityFile';

export interface DensityPoint {
  r: number; // radius in Bohr (a0)
  rho: number; // electron density in electrons / a0^3
}

export interface DensityStats {
  points: number;
  electrons: number;
  meanR: number; // <r> in a0
  rmsR: number; // sqrt(<r^2>) in a0
  r50: number; // radius enclosing 50% of electrons in a0
  r90: number; // radius enclosing 90% of electrons in a0
  warning: string | null;
}

/**
 * Calculates total integrated electrons: 4 * pi * integral(rho * r^2 dr)
 * using the trapezoidal rule over sorted radial grid points.
 */
export function integrateDensity(points: DensityPoint[]): number {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const y1 = p1.rho * p1.r * p1.r;
    const y2 = p2.rho * p2.r * p2.r;
    sum += 0.5 * (y1 + y2) * (p2.r - p1.r);
  }
  return 4 * Math.PI * sum;
}

/**
 * Calculates cumulative integrated electrons N(r_i) = 4 * pi * integral_0^{r_i}(rho * r^2 dr).
 */
export function cumulativeElectrons(points: DensityPoint[]): number[] {
  if (!points || points.length === 0) return [];
  const cum: number[] = [0];
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const y1 = p1.rho * p1.r * p1.r;
    const y2 = p2.rho * p2.r * p2.r;
    sum += 0.5 * (y1 + y2) * (p2.r - p1.r);
    cum.push(4 * Math.PI * sum);
  }
  return cum;
}

/**
 * Evaluates statistics and moments of the radial electron density:
 * points count, total electrons, <r>, sqrt(<r^2>), r_50, r_90, and electron count warning.
 */
export function calculateDensityStats(points: DensityPoint[], targetNelec?: number): DensityStats {
  const nPoints = points?.length ?? 0;
  if (nPoints < 2) {
    return {
      points: nPoints,
      electrons: 0,
      meanR: 0,
      rmsR: 0,
      r50: 0,
      r90: 0,
      warning: null,
    };
  }

  const cum = cumulativeElectrons(points);
  const totalN = cum[cum.length - 1];

  let sumR = 0;
  let sumR2 = 0;
  for (let i = 0; i < nPoints - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dr = p2.r - p1.r;
    const d1 = 4 * Math.PI * p1.rho * p1.r * p1.r;
    const d2 = 4 * Math.PI * p2.rho * p2.r * p2.r;
    // <r>: integral(r * D(r) dr)
    sumR += 0.5 * (p1.r * d1 + p2.r * d2) * dr;
    // <r^2>: integral(r^2 * D(r) dr)
    sumR2 += 0.5 * (p1.r * p1.r * d1 + p2.r * p2.r * d2) * dr;
  }

  const meanR = totalN > 0 ? sumR / totalN : 0;
  const rmsR = totalN > 0 ? Math.sqrt(Math.max(0, sumR2 / totalN)) : 0;

  // Find radius enclosing fraction f of electrons via linear interpolation on cumulative N
  const findPercentileRadius = (fraction: number): number => {
    if (totalN <= 0) return 0;
    const target = fraction * totalN;
    for (let i = 0; i < cum.length - 1; i++) {
      if (cum[i + 1] >= target) {
        const span = cum[i + 1] - cum[i];
        const t = span > 0 ? (target - cum[i]) / span : 0;
        return points[i].r + t * (points[i + 1].r - points[i].r);
      }
    }
    return points[nPoints - 1].r;
  };

  const r50 = findPercentileRadius(0.5);
  const r90 = findPercentileRadius(0.9);
  const expectedNelec = targetNelec !== undefined ? targetNelec : Math.round(totalN);
  const warning = checkElectronCountWarning(totalN, expectedNelec);

  return {
    points: nPoints,
    electrons: totalN,
    meanR,
    rmsR,
    r50,
    r90,
    warning,
  };
}

/**
 * Log-log interpolation of rho(r) on sorted grid points.
 * Extrapolates smoothly in log space if targetR is outside the grid bounds.
 */
export function interpolateLogLog(points: DensityPoint[], targetR: number): number {
  if (points.length === 0) return 1e-15;
  if (points.length === 1) return points[0].rho;
  if (targetR <= 0) return points[0].rho;

  // Below grid
  if (targetR <= points[0].r) {
    const p0 = points[0];
    const p1 = points[1];
    const slope = (Math.log(p1.rho) - Math.log(p0.rho)) / (Math.log(p1.r) - Math.log(p0.r));
    const logRho = Math.log(p0.rho) + slope * (Math.log(targetR) - Math.log(p0.r));
    return Math.exp(logRho);
  }

  // Above grid
  const last = points.length - 1;
  if (targetR >= points[last].r) {
    const pA = points[last - 1];
    const pB = points[last];
    const slope = (Math.log(pB.rho) - Math.log(pA.rho)) / (Math.log(pB.r) - Math.log(pA.r));
    const logRho = Math.log(pB.rho) + slope * (Math.log(targetR) - Math.log(pB.r));
    return Math.exp(logRho);
  }

  // Binary search
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid].r <= targetR) low = mid;
    else high = mid;
  }

  const p0 = points[low];
  const p1 = points[high];
  const t = (Math.log(targetR) - Math.log(p0.r)) / (Math.log(p1.r) - Math.log(p0.r));
  const logRho = Math.log(p0.rho) + t * (Math.log(p1.rho) - Math.log(p0.rho));
  return Math.exp(logRho);
}

/**
 * Scales density so that its volume integral equals exactly targetN electrons:
 * 4 * pi * integral(rho * r^2 dr) = targetN.
 */
export function normalizeDensity(points: DensityPoint[], targetN: number): DensityPoint[] {
  if (!points || points.length === 0 || targetN <= 0) return points;
  const currentN = integrateDensity(points);
  if (currentN <= 0) return points;

  const factor = targetN / currentN;
  return points.map((p) => ({
    r: p.r,
    rho: Math.max(1e-40, p.rho * factor),
  }));
}

/**
 * Drag editing: vertically raises or lowers density around centerR in log space
 * with a Gaussian weight profile in ln(r):
 * ln(rho'(r)) = ln(rho(r)) + deltaLogRho * exp(-0.5 * (ln(r / centerR) / logSigma)^2).
 */
export function dragEditDensity(
  points: DensityPoint[],
  centerR: number,
  deltaLogRho: number,
  logSigma: number = 0.5
): DensityPoint[] {
  if (!points || points.length === 0 || centerR <= 0) return points;
  const s2 = 2 * logSigma * logSigma;
  const lnCenter = Math.log(centerR);

  return points.map((p) => {
    const lnR = Math.log(p.r);
    const d = lnR - lnCenter;
    const weight = Math.exp(-(d * d) / s2);
    const newLogRho = Math.log(p.rho) + deltaLogRho * weight;
    return {
      r: p.r,
      rho: Math.max(1e-40, Math.exp(newLogRho)),
    };
  });
}

/**
 * Ionize: removes q electrons from the outer valence region using a smooth
 * Fermi-Dirac attenuation function f(r; r0) = 1 / (1 + exp((r - r0) / w)).
 *
 * r0 is solved via bisection so that exactly q electrons are removed,
 * keeping core orbitals untouched and rho > 0 everywhere.
 */
export function ionizeDensity(points: DensityPoint[], q: number): DensityPoint[] {
  if (!points || points.length < 2 || q === 0) return points;
  if (q < 0) return addOuterElectrons(points, -q);
  const currentN = integrateDensity(points);
  const targetN = currentN - q;
  if (targetN <= 0) {
    throw new Error(`Cannot ionize ${q} electrons: total bound electrons is only ${currentN.toFixed(3)}.`);
  }

  const rMin = points[0].r;
  const rMax = points[points.length - 1].r;

  const getWidth = (r0: number) => Math.min(0.5, Math.max(0.05 * r0, 0.05));

  // Evaluate integrated electrons with cutoff radius r0
  const evalN = (r0: number): number => {
    const w = getWidth(r0);
    let sum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const f1 = 1 / (1 + Math.exp((p1.r - r0) / w));
      const f2 = 1 / (1 + Math.exp((p2.r - r0) / w));
      const y1 = p1.rho * f1 * p1.r * p1.r;
      const y2 = p2.rho * f2 * p2.r * p2.r;
      sum += 0.5 * (y1 + y2) * (p2.r - p1.r);
    }
    return 4 * Math.PI * sum;
  };

  // Bisection on r0
  let low = 1e-4 * rMin;
  let high = 15 * rMax;
  for (let iter = 0; iter < 60; iter++) {
    const mid = 0.5 * (low + high);
    const nMid = evalN(mid);
    if (nMid < targetN) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const r0Opt = 0.5 * (low + high);
  const wOpt = getWidth(r0Opt);

  // Apply attenuation
  return points.map((p) => {
    const f = 1 / (1 + Math.exp((p.r - r0Opt) / wOpt));
    return {
      r: p.r,
      rho: Math.max(1e-40, p.rho * f),
    };
  });
}

/**
 * Negative ion: adds n electrons to the outer region, rho' = rho * (1 + k * (1 - f(r))), where f is
 * the same Fermi function as in ionizeDensity centred on the radius enclosing 90% of the electrons;
 * the added charge is linear in k, so k = n / integral(rho * (1 - f)) exactly.
 */
function addOuterElectrons(points: DensityPoint[], n: number): DensityPoint[] {
  const cumulative = cumulativeElectrons(points);
  const total = cumulative[cumulative.length - 1];
  const i90 = Math.max(0, cumulative.findIndex((c) => c >= 0.9 * total));
  const r0 = points[i90].r;
  const w = Math.min(0.5, Math.max(0.05 * r0, 0.05));
  const outer = points.map((p) => 1 - 1 / (1 + Math.exp((p.r - r0) / w)));
  const outerElectrons = integrateDensity(points.map((p, i) => ({ r: p.r, rho: p.rho * outer[i] })));
  if (!(outerElectrons > 0)) throw new Error('Cannot add electrons: the density has no outer region.');
  const k = n / outerElectrons;
  return points.map((p, i) => ({ r: p.r, rho: p.rho * (1 + k * outer[i]) }));
}

/**
 * Radial scale: compresses or expands density by scale factor s while preserving
 * electron count N: rho'(r) = (1 / s^3) * rho(r / s), re-interpolated on the same grid
 * using log-log interpolation.
 */
export function radialScaleDensity(points: DensityPoint[], s: number): DensityPoint[] {
  if (!points || points.length === 0 || s <= 0 || Math.abs(s - 1) < 1e-12) return points;
  const currentN = integrateDensity(points);
  const invS3 = 1 / (s * s * s);

  const scaled = points.map((p) => {
    const queryR = p.r / s;
    const interpRho = interpolateLogLog(points, queryR);
    return {
      r: p.r,
      rho: Math.max(1e-40, interpRho * invS3),
    };
  });

  // Maintain electron count within numerical precision
  return normalizeDensity(scaled, currentN);
}

/**
 * Truncate beyond rMax with a smooth exponential taper:
 * for r > rMax, rho(r) is smoothly attenuated towards zero while keeping rho > 0.
 */
export function truncateDensity(points: DensityPoint[], rMax: number, taperWidth?: number): DensityPoint[] {
  if (!points || points.length === 0 || rMax <= 0) return points;
  const lastR = points[points.length - 1].r;
  const w = taperWidth ?? Math.max(0.2 * rMax, (lastR - rMax) * 0.25, 0.1);
  const w2 = 2 * w * w;

  return points.map((p) => {
    if (p.r <= rMax) return p;
    const dr = p.r - rMax;
    const taper = Math.exp(-(dr * dr) / w2);
    return {
      r: p.r,
      rho: Math.max(1e-40, p.rho * taper),
    };
  });
}

/**
 * Moving average smoothing of ln(rho) over a window of k points.
 * Preserves positivity: rho_new = exp(mean(ln(rho))) > 0.
 */
export function smoothDensity(points: DensityPoint[], k: number = 3): DensityPoint[] {
  if (!points || points.length < 3 || k < 2) return points;
  const n = points.length;
  const half = Math.floor(k / 2);
  const lnRhos = points.map((p) => Math.log(Math.max(1e-40, p.rho)));

  const result: DensityPoint[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) {
      sum += lnRhos[j];
    }
    const avg = sum / (end - start + 1);
    result.push({
      r: points[i].r,
      rho: Math.max(1e-40, Math.exp(avg)),
    });
  }
  return result;
}

/**
 * Mixes two densities on the grid of the first density:
 * rho(r) = (1 - w) * rho1(r) + w * rho2(r), where rho2 is log-log interpolated onto grid 1.
 */
export function mixDensities(points1: DensityPoint[], points2: DensityPoint[], weight: number): DensityPoint[] {
  if (!points1 || points1.length === 0) return points2 || [];
  if (!points2 || points2.length === 0) return points1 || [];
  const w = Math.max(0, Math.min(1, weight));
  if (w <= 0) return points1;
  if (w >= 1) {
    // Return points2 interpolated onto points1 grid
    return points1.map((p) => ({
      r: p.r,
      rho: Math.max(1e-40, interpolateLogLog(points2, p.r)),
    }));
  }

  return points1.map((p) => {
    const rho2 = interpolateLogLog(points2, p.r);
    const mixed = (1 - w) * p.rho + w * rho2;
    return {
      r: p.r,
      rho: Math.max(1e-40, mixed),
    };
  });
}

/**
 * Serializes density points to ELSEPA-compatible `.den` text (3 header lines, then R RHO).
 */
export function formatDensityForElsepa(
  points: DensityPoint[],
  metadata: {
    element?: string;
    z: number;
    q?: number;
    nelec?: number;
    source?: string;
    edits?: string[];
  }
): string {
  const z = metadata.z;
  const q = metadata.q ?? 0;
  const nelec = metadata.nelec ?? z - q;
  const elem = metadata.element || `Z=${z}`;
  const src = metadata.source || 'edited';
  const editsStr = metadata.edits && metadata.edits.length > 0 ? metadata.edits.join(', ') : 'none';

  const headerLines = [
    ` # ELSEPA user-supplied electron density: ${elem} (Z=${z}, q=${q}, NELEC=${nelec})`,
    ` # Source: ${src} | Edits: ${editsStr}`,
    ' #      R (bohr)                 RHO (electrons/bohr^3)',
  ];

  const dataLines = points.map((p) => {
    const rStr = p.r.toExponential(8).padStart(16);
    const rhoStr = p.rho.toExponential(8).padStart(16);
    return `  ${rStr}  ${rhoStr}`;
  });

  return [...headerLines, ...dataLines].join('\n') + '\n';
}

/**
 * Converts parsed DensityParseResult (or raw points) into DensityPoint array.
 */
export function parseTextToDensityPoints(text: string): { points: DensityPoint[]; errors: string[]; electrons: number } {
  const parsed = parseDensityFile(text);
  if (parsed.errors.length > 0) {
    return { points: [], errors: parsed.errors, electrons: 0 };
  }
  const lines = parsed.normalized.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const points = lines.map((l) => {
    const [r, rho] = l.trim().split(/\s+/);
    return { r: Number(r), rho: Number(rho) };
  });
  return { points, errors: [], electrons: parsed.electrons };
}
