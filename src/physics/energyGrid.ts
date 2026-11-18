/**
 * Energy grid generator and validator for ELSEPA energy sweeps.
 */

export const DEFAULT_SWEEP_ENERGIES: number[] = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000,
];

export const MIN_SWEEP_ENERGY_EV = 10;
export const MAX_SWEEP_ENERGY_EV = 1e9;
export const MIN_SWEEP_POINTS = 1;
export const MAX_SWEEP_POINTS = 100;

function roundTo4SigFigs(val: number): number {
  if (val === 0) return 0;
  return Number(val.toPrecision(4));
}

/**
 * Generates n logarithmically spaced points between minEv and maxEv (inclusive),
 * each rounded to 4 significant figures.
 */
export function logGrid(minEv: number, maxEv: number, n: number): number[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  if (!Number.isFinite(minEv) || !Number.isFinite(maxEv) || minEv <= 0 || maxEv <= 0) {
    throw new Error('Energies for logGrid must be finite and strictly positive');
  }
  if (n === 1) return [roundTo4SigFigs(minEv)];
  if (minEv >= maxEv) {
    throw new Error('The minimum energy of a logarithmic grid must be below the maximum');
  }

  const logMin = Math.log(minEv);
  const logMax = Math.log(maxEv);
  const step = (logMax - logMin) / (n - 1);

  const grid: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = i === 0 ? minEv : i === n - 1 ? maxEv : Math.exp(logMin + i * step);
    grid.push(roundTo4SigFigs(val));
  }
  return grid;
}

/**
 * Parses a string of numbers separated by commas, spaces, semicolons, or newlines.
 * Supports standard scientific notation (1e3, 1E3) and Fortran D exponents (1d3, 1D3).
 */
export function parseEnergyList(text: string): number[] {
  if (!text || typeof text !== 'string') return [];
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
  return tokens.map((t) => Number(t.replace(/D/gi, 'E')));
}

export interface EnergyValidationResult {
  energies: number[];
  errors: string[];
}

/**
 * Validates a list of energies:
 * - Each energy must be finite and within [10 eV, 1e9 eV].
 * - Total number of valid unique energies must be between 1 and 100.
 * Returns sorted ascending and de-duplicated energies.
 */
export function validateEnergies(list: unknown): EnergyValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(list) || list.length === 0) {
    return { energies: [], errors: ['At least 1 energy value is required.'] };
  }

  const validNumbers: number[] = [];
  for (const item of list) {
    const num = typeof item === 'number' ? item : Number(item);
    if (!Number.isFinite(num)) {
      errors.push(`Invalid energy value "${item}": must be a finite number.`);
    } else if (num < MIN_SWEEP_ENERGY_EV) {
      errors.push(`Energy ${num} eV is below the minimum limit of ${MIN_SWEEP_ENERGY_EV} eV.`);
    } else if (num > MAX_SWEEP_ENERGY_EV) {
      errors.push(`Energy ${num} eV exceeds the maximum limit of ${MAX_SWEEP_ENERGY_EV.toExponential(0)} eV.`);
    } else {
      validNumbers.push(num);
    }
  }

  const uniqueSorted = Array.from(new Set(validNumbers)).sort((a, b) => a - b);

  if (uniqueSorted.length < MIN_SWEEP_POINTS && errors.length === 0) {
    errors.push(`At least ${MIN_SWEEP_POINTS} valid energy value is required.`);
  }

  if (uniqueSorted.length > MAX_SWEEP_POINTS) {
    errors.push(`Too many energies: maximum allowed is ${MAX_SWEEP_POINTS} points (got ${uniqueSorted.length}).`);
  }

  return {
    energies: uniqueSorted,
    errors,
  };
}
