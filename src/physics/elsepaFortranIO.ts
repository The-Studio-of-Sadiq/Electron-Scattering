import {
  ElsepaInputParams,
  SimulationResult,
  ScatteringDataPoint,
  PotentialPoint,
  PhaseShiftPoint,
  MolecularInputParams,
  MolecularSimulationResult,
  MolecularScatteringDataPoint,
} from '../types';
import { getElementByZ } from '../data/elements';
import { BOHR_SQ_TO_CM2, BOHR_SQ_TO_ANGSTROM2, HARtree_EV, SPEED_OF_LIGHT } from './elsepaPhysicsEngine';

// Input builders and output parsers for Salvat's ELSCATA / ELSCATM programs.
// Free of Node APIs: shared by the native-binary server runner and the
// in-browser WebAssembly build. Output files are passed as {filename: text}.

export type FortranOutputFiles = Record<string, string>;

export function buildAtomicInput(params: ElsepaInputParams): string {
  // Map input params to Salvat's Fortran keywords
  const nucModInt = params.nuclearModel === 'point' ? 1 : params.nuclearModel === 'uniform' ? 2 : 3;
  const melecInt = params.densityModel === 'dirac-fock' ? 4 : params.densityModel === 'thomas-fermi' ? 1 : 4;
  const mexchInt = params.exchangeModel === 'none' ? 0 : params.exchangeModel === 'furness-mccarthy' ? 1 : params.exchangeModel === 'riley-truhlar' ? 3 : 2;
  // ELSCATA codes: MCPOL 0=none, 1=Buckingham, 2=LDA
  const mcpolInt = params.polarizationModel === 'buckingham' ? 1 : 0;
  const mabsInt = params.absorptionModel === 'staszewska-lda' ? 1 : 0;

  // Convert polarizability from a0^3 to cm^3 (1 a0^3 = 1.481847e-25 cm^3)
  const polarCm3 = (params.polarizability * 1.4818474e-25).toExponential(5);

  return [
    keywordLine('IZ', params.z),
    keywordLine('MNUCL', nucModInt),
    keywordLine('NELEC', params.z),
    keywordLine('MELEC', melecInt),
    keywordLine('MUFFIN', 0),
    keywordLine('RMUF', 0),
    keywordLine('IELEC', params.projectile),
    keywordLine('MEXCH', mexchInt),
    keywordLine('MCPOL', mcpolInt),
    keywordLine('VPOLA', polarCm3),
    keywordLine('VPOLB', -1),
    keywordLine('MABS', mabsInt),
    keywordLine('VABSA', params.absorptionStrength || 2.0),
    keywordLine('VABSD', '-1.0'),
    keywordLine('IHEF', 2),
    keywordLine('EV', params.energyEv.toExponential(5)),
  ].join('\n') + '\n';
}

// ELSCATA reads each line as READ(5,'(A6,1X,A12)'): keyword in columns 1-6 and
// the value in columns 8-19, so values must start at column 8 and fit 12 chars.
function keywordLine(keyword: string, value: number | string): string {
  const text = String(value);
  if (text.length > 12) throw new Error(`ELSEPA input value for ${keyword} is longer than 12 characters: ${text}`);
  return `${keyword.padEnd(6)} ${text}`;
}

const isDataLine = (trimmed: string) => !!trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-');

/** Parses ELSCATA output files. Returns null when no DCS table was produced. */
export function parseAtomicOutputs(
  params: ElsepaInputParams,
  files: FortranOutputFiles,
  inputContent: string,
  computationTimeMs: number
): SimulationResult | null {
  const dcsFile = Object.keys(files).find((f) => f.startsWith('dcs_') && f.endsWith('.dat'));
  if (!dcsFile) return null;

  const scatteringData: ScatteringDataPoint[] = [];
  let sigmaElAu = 0;
  let sigma1Au = 0;
  let sigma2Au = 0;
  const sigmaAbsAu = 0;

  for (const line of files[dcsFile].split('\n')) {
    const csMatch = line.match(/=\s*([0-9.E+-]+)\s*cm\*\*2\s*=\s*([0-9.E+-]+)\s*a0\*\*2/i);
    if (csMatch) {
      if (line.includes('Total elastic cross section =')) sigmaElAu = parseFloat(csMatch[2]);
      if (line.includes('1st transport cross section =')) sigma1Au = parseFloat(csMatch[2]);
      if (line.includes('2nd transport cross section =')) sigma2Au = parseFloat(csMatch[2]);
    }

    const trimmed = line.trim();
    if (!isDataLine(trimmed)) continue;

    const tokens = trimmed.split(/\s+/);
    if (tokens.length >= 5) {
      const angleDeg = parseFloat(tokens[0]);
      const dcsCm2 = parseFloat(tokens[2]);
      const dcsAu = parseFloat(tokens[3]);
      const shermanS = parseFloat(tokens[4]);

      if (!isNaN(angleDeg) && !isNaN(dcsAu)) {
        scatteringData.push({
          angleDeg,
          angleRad: (angleDeg * Math.PI) / 180,
          dcsAu,
          dcsCm2,
          dcsAngstrom2: dcsAu * BOHR_SQ_TO_ANGSTROM2,
          shermanS: isNaN(shermanS) ? 0 : shermanS,
          spinT: 1.0,
          spinU: 0.0,
          reF: 0,
          imF: 0,
          reG: 0,
          imG: 0,
        });
      }
    }
  }

  // scatamp.dat: f and g scattering amplitudes
  if (files['scatamp.dat']) {
    let idx = 0;
    for (const line of files['scatamp.dat'].split('\n')) {
      const trimmed = line.trim();
      if (!isDataLine(trimmed)) continue;
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 6 && idx < scatteringData.length) {
        scatteringData[idx].reF = parseFloat(tokens[2]);
        scatteringData[idx].imF = parseFloat(tokens[3]);
        scatteringData[idx].reG = parseFloat(tokens[4]);
        scatteringData[idx].imG = parseFloat(tokens[5]);
        idx++;
      }
    }
  }

  // scfield.dat: central potential profile V(r)
  const potentialProfile: PotentialPoint[] = [];
  if (files['scfield.dat']) {
    for (const line of files['scfield.dat'].split('\n')) {
      const trimmed = line.trim();
      if (!isDataLine(trimmed)) continue;
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 8) {
        const r = parseFloat(tokens[1]);
        const rvTotal = parseFloat(tokens[2]);
        const rvSt = parseFloat(tokens[3]);
        const rvEx = parseFloat(tokens[4]);
        const rvPol = parseFloat(tokens[5]);
        const rvAbs = parseFloat(tokens[6]);

        if (!isNaN(r) && r > 0) {
          potentialProfile.push({
            r,
            vNuc: rvSt / r,
            vEl: 0,
            vTotalElectrostatic: rvSt / r,
            vExchange: rvEx / r,
            vPolarization: rvPol / r,
            wAbsorption: rvAbs / r,
            vTotalReal: rvTotal / r,
          });
        }
      }
    }
  }

  // dpwa.dat: Dirac phase shifts
  const phaseShifts: PhaseShiftPoint[] = [];
  if (files['dpwa.dat']) {
    for (const line of files['dpwa.dat'].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('KINETIC')) continue;
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 3) {
        const l = parseInt(tokens[0], 10);
        const phaseUp = parseFloat(tokens[1]);
        const phaseDown = parseFloat(tokens[2]);

        if (!isNaN(l) && !isNaN(phaseUp)) {
          phaseShifts.push({ kappa: -l - 1, l, j: l + 0.5, deltaRe: phaseUp, deltaIm: 0, eta: 1.0 });
          if (l > 0) {
            phaseShifts.push({ kappa: l, l, j: l - 0.5, deltaRe: phaseDown, deltaIm: 0, eta: 1.0 });
          }
        }
      }
    }
  }

  // Relativistic Kinematics
  const eKinAu = params.energyEv / HARtree_EV;
  const c = SPEED_OF_LIGHT;
  const kWaveVector = Math.sqrt(eKinAu * (eKinAu + 2 * c * c)) / c;
  const gammaRelativistic = 1 + eKinAu / (c * c);
  const betaRelativistic = Math.sqrt(Math.max(0, 1 - 1 / (gammaRelativistic * gammaRelativistic)));

  // ELSEPA writes the header before computing; a STOP mid-run leaves no table.
  if (scatteringData.length === 0 || !sigmaElAu) return null;

  return {
    params,
    element: getElementByZ(params.z),
    scatteringData,
    potentialProfile,
    phaseShifts,
    summary: {
      sigmaElAu,
      sigmaElCm2: sigmaElAu * BOHR_SQ_TO_CM2,
      sigma1Au,
      sigma1Cm2: sigma1Au * BOHR_SQ_TO_CM2,
      sigma2Au,
      sigmaAbsAu,
      kWaveVector,
      gammaRelativistic,
      betaRelativistic,
      maxL: phaseShifts.length > 0 ? Math.max(...phaseShifts.map((p) => p.l)) : 50,
      computationTimeMs: Math.round(computationTimeMs * 10) / 10,
      engineUsed: 'salvat-official-fortran',
    },
    elsepaInputFileText: inputContent,
  };
}

export function buildMolecularInput(params: MolecularInputParams): string {
  const mexchInt = params.exchangeModel === 'none' ? 0 : params.exchangeModel === 'furness-mccarthy' ? 1 : params.exchangeModel === 'riley-truhlar' ? 3 : 2;
  // ELSCATM codes: MCPOL 0=none, 1=Buckingham, 2=LDA
  const mcpolInt = params.polarizationModel === 'buckingham' ? 1 : 0;
  const mabsInt = params.absorptionModel === 'staszewska-lda' ? 1 : 0;
  const vabsA = params.absorptionStrength ?? 2.0;
  const fExce = params.excitationEnergy ?? 6.20;

  const atomsLines = params.atoms
    .map((a) => {
      const xCm = (a.xAngstrom * 1e-8).toExponential(5);
      const yCm = (a.yAngstrom * 1e-8).toExponential(5);
      const zCm = (a.zAngstrom * 1e-8).toExponential(5);
      return `${a.z} ${xCm} ${yCm} ${zCm}`;
    })
    .join('\n');

  const molName = params.moleculeName.substring(0, 35) || 'Molecule';

  return `${molName}
${params.atoms.length}
${atomsLines}
${mexchInt}
${mcpolInt} ${params.polarizability.toExponential(5)}
${mabsInt} ${vabsA.toFixed(2)} ${fExce.toFixed(2)}
${params.projectile}
${params.energyEv.toFixed(1)}
`;
}

/** Parses ELSCATM output files. Returns null when no DCS table was produced. */
export function parseMolecularOutputs(
  params: MolecularInputParams,
  files: FortranOutputFiles,
  inputContent: string,
  computationTimeMs: number
): MolecularSimulationResult | null {
  // ELSCATM also writes per-atom tables (dcs_008.dat, ...); the molecular one is named by energy.
  const dcsFile = Object.keys(files).find((f) => /^dcs_\dp\d{3}e[+-]?\d+\.dat$/.test(f));
  if (!dcsFile) return null;

  // e.g. " # 1st transport cs: 6.4218050E-18  6.4119211E-18" -> [coherent, incoherent]
  const csPair = (line: string): [number, number] | null => {
    const m = line.match(/cs:\s*([0-9.E+-]+)\s+([0-9.E+-]+)/i);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  };

  const scatteringData: MolecularScatteringDataPoint[] = [];
  let sigmaCohCm2 = 0;
  let sigmaIncohCm2 = 0;
  let sigma1CohCm2 = 0;
  let sigma1IncohCm2 = 0;
  let sigma2CohCm2 = 0;
  let sigma2IncohCm2 = 0;

  for (const line of files[dcsFile].split('\n')) {
    const trimmed = line.trim();
    const pair = csPair(trimmed);
    if (pair && trimmed.includes('total cs:')) [sigmaCohCm2, sigmaIncohCm2] = pair;
    else if (pair && trimmed.includes('1st transport cs:')) [sigma1CohCm2, sigma1IncohCm2] = pair;
    else if (pair && trimmed.includes('2nd transport cs:')) [sigma2CohCm2, sigma2IncohCm2] = pair;

    if (!isDataLine(trimmed)) continue;
    const tokens = trimmed.split(/\s+/);
    if (tokens.length >= 5) {
      const theta = parseFloat(tokens[0]);
      const dcsCoh = parseFloat(tokens[2]);
      const dcsIncoh = parseFloat(tokens[3]);
      const sherman = parseFloat(tokens[4]);

      if (!isNaN(theta) && !isNaN(dcsCoh)) {
        scatteringData.push({
          angleDeg: theta,
          angleRad: (theta * Math.PI) / 180,
          dcsCohCm2: dcsCoh,
          dcsCohAu: dcsCoh / BOHR_SQ_TO_CM2,
          dcsIncohCm2: dcsIncoh,
          dcsIncohAu: dcsIncoh / BOHR_SQ_TO_CM2,
          shermanS: isNaN(sherman) ? 0 : sherman,
        });
      }
    }
  }

  if (scatteringData.length === 0) return null;

  return {
    params,
    scatteringData,
    summary: {
      sigmaCohCm2,
      sigmaCohAu: sigmaCohCm2 / BOHR_SQ_TO_CM2,
      sigmaIncohCm2,
      sigmaIncohAu: sigmaIncohCm2 / BOHR_SQ_TO_CM2,
      sigma1CohCm2,
      sigma1IncohCm2,
      sigma2CohCm2,
      sigma2IncohCm2,
      computationTimeMs: Math.round(computationTimeMs * 10) / 10,
      engineUsed: 'salvat-official-fortran',
    },
    elsepaInputFileText: inputContent,
  };
}
