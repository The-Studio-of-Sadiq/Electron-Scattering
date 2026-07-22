/**
 * ELSEPA Physics Workbench Types
 */

export type ProjectileType = -1 | 1; // -1: Electron, +1: Positron

export type NuclearModel = 'point' | 'uniform' | 'fermi';

export type ElectronDensityModel = 'dirac-fock' | 'thomas-fermi' | 'custom-file';

export type ExchangeModel = 'none' | 'furness-mccarthy' | 'riley-truhlar' | 'free-electron-gas';

export type PolarizationModel = 'none' | 'buckingham';

export type AbsorptionModel = 'none' | 'staszewska-lda';

export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  atomicMass: number; // amu
  polarizability: number; // static dipole polarizability in a_0^3
  cutoffRadius: number; // r_c in a_0
  electronConfig: string;
  group: string;
  // Analytical Dirac-Fock screening parameters A_i, alpha_i (3 terms)
  diracFockA: [number, number, number];
  diracFockAlpha: [number, number, number];
}

export interface ElsepaInputParams {
  z: number; // Atomic number Z (1..103)
  projectile: ProjectileType; // -1 for e-, +1 for e+
  energyEv: number; // Kinetic energy in eV
  massNumber: number; // Mass number A (e.g. 197 for Au)
  nuclearModel: NuclearModel;
  fermiC?: number; // Half-density radius in fm (if Fermi model)
  fermiT?: number; // Skin thickness parameter in fm (default ~0.5229 fm)
  densityModel: ElectronDensityModel;
  customDensityFile?: string; // filename or raw content if uploaded
  exchangeModel: ExchangeModel;
  polarizationModel: PolarizationModel;
  polarizability: number; // alpha_d in a_0^3
  cutoffRadius: number; // r_c in a_0
  absorptionModel: AbsorptionModel;
  absorptionStrength?: number; // multiplier parameter W_0
  minAngle: number; // degrees, e.g. 0
  maxAngle: number; // degrees, e.g. 180
  angleStep: number; // degrees, e.g. 1.0 or 0.5
}

export interface ScatteringDataPoint {
  angleDeg: number; // Angle in degrees
  angleRad: number; // Angle in radians
  dcsAu: number; // DCS in a_0^2/sr
  dcsCm2: number; // DCS in cm^2/sr (1 a_0^2 = 2.80028e-17 cm^2)
  dcsAngstrom2: number; // DCS in Å^2/sr
  shermanS: number; // Spin polarization Sherman function S(theta)
  spinT: number; // T(theta) spin rotation
  spinU: number; // U(theta) spin rotation
  reF: number; // Re f(theta)
  imF: number; // Im f(theta)
  reG: number; // Re g(theta)
  imG: number; // Im g(theta)
}

export interface PotentialPoint {
  r: number; // Radius in a_0
  vNuc: number; // Nuclear electrostatic potential in Hartree (E_h)
  vEl: number; // Electronic electrostatic potential in E_h
  vTotalElectrostatic: number; // Total electrostatic V_s = V_nuc + V_el
  vExchange: number; // V_ex in E_h
  vPolarization: number; // V_pol in E_h
  wAbsorption: number; // Imaginary absorption W(r) in E_h
  vTotalReal: number; // Real part of optical potential V_tot = V_s + V_ex + V_pol
}

export interface PhaseShiftPoint {
  kappa: number; // Relativistic angular momentum quantum number kappa
  l: number; // Orbital angular momentum l
  j: number; // Total angular momentum j = l ± 1/2
  deltaRe: number; // Real part of phase shift in radians
  deltaIm: number; // Imaginary part of phase shift (eta = exp(-2 Im delta))
  eta: number; // Inelasticity factor eta_kappa
}

export interface EnergySweepPoint {
  energyEv: number;
  sigmaElAu: number; // Total elastic cross section in a_0^2
  sigmaElCm2: number; // Total elastic cross section in cm^2
  sigma1Au: number; // 1st Transport cross section (momentum transfer) in a_0^2
  sigma2Au: number; // 2nd Transport cross section (viscosity) in a_0^2
  sigmaAbsAu: number; // Absorption cross section in a_0^2
  shermanPeakMin: number; // Min value of S(theta)
  shermanPeakMax: number; // Max value of S(theta)
}

export interface SimulationResult {
  params: ElsepaInputParams;
  element: ElementData;
  scatteringData: ScatteringDataPoint[];
  potentialProfile: PotentialPoint[];
  phaseShifts: PhaseShiftPoint[];
  energySweep?: EnergySweepPoint[];
  summary: {
    sigmaElAu: number;
    sigmaElCm2: number;
    sigma1Au: number;
    sigma1Cm2: number;
    sigma2Au: number;
    sigmaAbsAu: number;
    kWaveVector: number; // in a_0^-1
    gammaRelativistic: number;
    betaRelativistic: number;
    maxL: number;
    computationTimeMs: number;
    engineUsed: 'salvat-official-fortran' | 'fortran-native' | 'typescript-dirac-solver';
  };
  elsepaInputFileText: string;
}

export interface UploadedDataset {
  id: string;
  filename: string;
  originalName: string;
  uploadDate: string;
  sizeBytes: number;
  type: 'dcs-comparison' | 'custom-density' | 'custom-potential';
  dataPointsCount: number;
  parsedData: Array<{ x: number; y: number; label?: string }>;
  headerText: string;
}

export interface FortranServerStatus {
  hasGFortran: boolean;
  hasElsepaBinary: boolean;
  versionInfo?: string;
  gfortranPath?: string;
}
