import { NuclearModel } from '../types';

export const BOHR_RADIUS_CM = 5.2917721067e-9;

// Atomic weights ELAW(103) in g/mol from fortran/elsepa2020.f DATA ELAW
export const ELAW: number[] = [
  1.0079, 4.0026, 6.941, 9.0122, 10.811, 12.0107, 14.0067, 15.9994, 18.9984, 20.1797,
  22.9898, 24.305, 26.9815, 28.0855, 30.9738, 32.066, 35.4527, 39.948, 39.0983, 40.078,
  44.9559, 47.867, 50.9415, 51.9961, 54.938, 55.845, 58.9332, 58.6934, 63.546, 65.39,
  69.723, 72.61, 74.9216, 78.96, 79.904, 83.8, 85.4678, 87.62, 88.9059, 91.224,
  92.9064, 95.94, 98.9063, 101.07, 102.9055, 106.42, 107.8682, 112.411, 114.818, 118.71,
  121.76, 127.6, 126.9045, 131.29, 132.9054, 137.327, 138.9055, 140.116, 140.9076, 144.24,
  144.9127, 150.36, 151.964, 157.25, 158.9253, 162.5, 164.9303, 167.26, 168.9342, 173.04,
  174.967, 178.49, 180.9479, 183.84, 186.207, 190.23, 192.217, 195.078, 196.9666, 200.59,
  204.3833, 207.2, 208.9804, 208.9824, 209.9871, 222.0176, 223.0197, 226.0254, 227.0277, 232.0381,
  231.0359, 238.0289, 237.0482, 244.0642, 243.0614, 247, 247, 251, 252, 257,
  258, 259, 262,
];

// Polarizabilities ATPOL(103) in cm^3 from fortran/elscata.f DATA ATPOL
export const ATPOL: number[] = [
  0.666e-24, 0.205e-24, 24.30e-24, 5.600e-24, 3.030e-24, 1.760e-24, 1.100e-24, 0.802e-24, 0.557e-24, 0.3956e-24,
  24.08e-24, 10.06e-24, 6.800e-24, 5.380e-24, 3.630e-24, 2.900e-24, 2.180e-24, 1.641e-24, 43.40e-24, 22.80e-24,
  17.80e-24, 14.60e-24, 12.40e-24, 11.60e-24, 9.400e-24, 8.400e-24, 7.500e-24, 6.800e-24, 6.100e-24, 7.100e-24,
  8.120e-24, 6.070e-24, 4.310e-24, 3.770e-24, 3.050e-24, 2.484e-24, 47.30e-24, 27.60e-24, 22.70e-24, 17.90e-24,
  15.70e-24, 12.80e-24, 11.40e-24, 9.600e-24, 8.600e-24, 4.800e-24, 7.200e-24, 7.200e-24, 10.20e-24, 7.700e-24,
  6.600e-24, 5.500e-24, 5.350e-24, 4.044e-24, 59.60e-24, 39.70e-24, 31.10e-24, 29.60e-24, 28.20e-24, 31.40e-24,
  30.10e-24, 28.80e-24, 27.70e-24, 23.50e-24, 25.50e-24, 24.50e-24, 23.60e-24, 22.70e-24, 21.80e-24, 21.00e-24,
  21.90e-24, 16.20e-24, 13.10e-24, 11.10e-24, 9.700e-24, 8.500e-24, 7.600e-24, 6.500e-24, 5.800e-24, 5.100e-24,
  7.600e-24, 6.800e-24, 7.400e-24, 6.800e-24, 6.000e-24, 5.300e-24, 48.70e-24, 38.30e-24, 32.10e-24, 32.10e-24,
  25.40e-24, 24.90e-24, 24.80e-24, 24.50e-24, 23.30e-24, 23.00e-24, 22.70e-24, 20.50e-24, 19.70e-24, 23.80e-24,
  18.20e-24, 17.50e-24, 20.00e-24,
];

export interface ElsepaNuclearDefaults {
  radiusFm: number | null;
  skinFm: number | null;
}

export function elsepaDefaultNuclear(
  z: number,
  model: NuclearModel,
  aw?: number
): ElsepaNuclearDefaults {
  if (model === 'point') {
    return { radiusFm: null, skinFm: null };
  }

  const effectiveAw = aw !== undefined && aw > 0 ? aw : (ELAW[z - 1] ?? 1.0);
  const rnuc = 1.07 * Math.pow(effectiveAw, 1 / 3);

  if (model === 'uniform') {
    const r2 = 2.0;
    const rRatio = r2 / rnuc;
    const r1 = rnuc * Math.sqrt((1.0 + 2.5 * rRatio * rRatio) / (1.0 + 0.75 * rRatio * rRatio));
    return { radiusFm: r1, skinFm: null };
  }

  if (model === 'fermi') {
    return { radiusFm: rnuc, skinFm: 0.546 };
  }

  if (model === 'helm') {
    const r1 = 0.96219 * rnuc + 0.435;
    const r2 = 2.0;
    return { radiusFm: r1, skinFm: r2 };
  }

  return { radiusFm: null, skinFm: null };
}

export function elsepaDefaultCutoffA0(
  z: number,
  energyEv: number,
  polarizabilityA0?: number
): number {
  const bpol = Math.sqrt(Math.max((energyEv - 50.0) / 16.0, 1.0));
  const alpha =
    polarizabilityA0 !== undefined && polarizabilityA0 > 0
      ? polarizabilityA0
      : (ATPOL[z - 1] ?? 1e-24) / Math.pow(BOHR_RADIUS_CM, 3);

  const zThird = Math.pow(z, 1 / 3);
  const d2 = Math.sqrt((0.5 * alpha * bpol * bpol) / zThird);
  return Math.sqrt(d2);
}
