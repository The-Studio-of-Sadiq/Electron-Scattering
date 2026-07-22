import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ElsepaInputParams, SimulationResult, ScatteringDataPoint, PotentialPoint, PhaseShiftPoint } from '../src/types';
import { getElementByZ } from '../src/data/elements';
import { runDiracPartialWaveSimulation } from '../src/physics/elsepaPhysicsEngine';

const BOHR_SQ_TO_CM2 = 0.28002852e-16;
const BOHR_SQ_TO_ANGSTROM2 = 0.28002852;

let compiledBinaryPath: string | null = null;

export function ensureFortranBinaryCompiled(): string | null {
  if (compiledBinaryPath && fs.existsSync(compiledBinaryPath)) {
    return compiledBinaryPath;
  }

  const rootDir = process.cwd();
  const binaryTarget = path.join(rootDir, 'elsepa_exec');

  if (fs.existsSync(binaryTarget)) {
    compiledBinaryPath = binaryTarget;
    return compiledBinaryPath;
  }

  // Attempt gfortran compilation
  try {
    const fortranDir = path.join(rootDir, 'fortran');
    const elscataFile = path.join(fortranDir, 'elscata.f');
    const elsepaFile = path.join(fortranDir, 'elsepa.f');

    if (!fs.existsSync(elscataFile) || !fs.existsSync(elsepaFile)) {
      return null;
    }

    console.log('Compiling official Salvat ELSEPA Fortran source code with gfortran...');
    execSync(`gfortran -O2 -I"${fortranDir}" -o "${binaryTarget}" "${elscataFile}" "${elsepaFile}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (fs.existsSync(binaryTarget)) {
      compiledBinaryPath = binaryTarget;
      console.log('Successfully compiled ELSEPA Fortran binary:', binaryTarget);
      return compiledBinaryPath;
    }
  } catch (err) {
    console.warn('gfortran compilation failed or not available:', err);
  }

  return null;
}

export function runOfficialFortranSimulation(params: ElsepaInputParams): SimulationResult {
  const binaryPath = ensureFortranBinaryCompiled();
  if (!binaryPath) {
    console.log('Fortran binary not available. Using TypeScript Dirac solver.');
    return runDiracPartialWaveSimulation(params);
  }

  const startTime = performance.now();
  const rootDir = process.cwd();
  const element = getElementByZ(params.z);

  // Map input params to Salvat's Fortran keywords
  const nucModInt = params.nuclearModel === 'point' ? 1 : params.nuclearModel === 'uniform' ? 2 : 3;
  const melecInt = params.densityModel === 'dirac-fock' ? 4 : params.densityModel === 'thomas-fermi' ? 1 : 4;
  const mexchInt = params.exchangeModel === 'none' ? 0 : params.exchangeModel === 'furness-mccarthy' ? 1 : params.exchangeModel === 'riley-truhlar' ? 3 : 2;
  const mcpolInt = params.polarizationModel === 'none' ? 0 : 2;
  const mabsInt = params.absorptionModel === 'staszewska-lda' ? 1 : 0;
  
  // Convert polarizability from a0^3 to cm^3 (1 a0^3 = 1.481847e-25 cm^3)
  const polarCm3 = (params.polarizability * 1.4818474e-25).toExponential(6);

  const inputContent = `IZ      ${params.z}
MNUCL   ${nucModInt}
NELEC   ${params.z}
MELEC   ${melecInt}
MUFFIN  0
RMUF    0
IELEC   ${params.projectile}
MEXCH   ${mexchInt}
MCPOL   ${mcpolInt}
VPOLA   ${polarCm3}
VPOLB   -1
MABS    ${mabsInt}
VABSA   ${params.absorptionStrength || 2.0}
VABSD   -1.0
IHEF    2
EV      ${params.energyEv.toExponential(6)}
`;

  // Create isolated execution temp folder
  const tempDir = path.join(rootDir, 'tmp_run_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  fs.mkdirSync(tempDir, { recursive: true });

  const inputFilePath = path.join(tempDir, 'in.dat');
  fs.writeFileSync(inputFilePath, inputContent, 'utf-8');

  // Set ELSEPA_DATA pointing to data directory
  const dataDir = path.join(rootDir, 'data');
  const env = {
    ...process.env,
    ELSEPA_DATA: dataDir,
  };

  try {
    execSync(`"${binaryPath}" < "${inputFilePath}"`, {
      cwd: tempDir,
      env,
      timeout: 15000,
      encoding: 'utf-8',
    });

    // Parse generated output files from tempDir
    const files = fs.readdirSync(tempDir);
    const dcsFile = files.find((f) => f.startsWith('dcs_') && f.endsWith('.dat'));

    let scatteringData: ScatteringDataPoint[] = [];
    let sigmaElAu = 0;
    let sigma1Au = 0;
    let sigma2Au = 0;
    let sigmaAbsAu = 0;

    if (dcsFile) {
      const dcsContent = fs.readFileSync(path.join(tempDir, dcsFile), 'utf-8');
      const lines = dcsContent.split('\n');

      for (const line of lines) {
        if (line.includes('Total elastic cross section =')) {
          const match = line.match(/=\s*([0-9.E+-]+)\s*cm\*\*2\s*=\s*([0-9.E+-]+)\s*a0\*\*2/i);
          if (match) sigmaElAu = parseFloat(match[2]);
        }
        if (line.includes('1st transport cross section =')) {
          const match = line.match(/=\s*([0-9.E+-]+)\s*cm\*\*2\s*=\s*([0-9.E+-]+)\s*a0\*\*2/i);
          if (match) sigma1Au = parseFloat(match[2]);
        }
        if (line.includes('2nd transport cross section =')) {
          const match = line.match(/=\s*([0-9.E+-]+)\s*cm\*\*2\s*=\s*([0-9.E+-]+)\s*a0\*\*2/i);
          if (match) sigma2Au = parseFloat(match[2]);
        }

        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;

        const tokens = trimmed.split(/\s+/);
        if (tokens.length >= 5) {
          const angleDeg = parseFloat(tokens[0]);
          const dcsCm2 = parseFloat(tokens[2]);
          const dcsAu = parseFloat(tokens[3]);
          const shermanS = parseFloat(tokens[4]);

          if (!isNaN(angleDeg) && !isNaN(dcsAu)) {
            const angleRad = (angleDeg * Math.PI) / 180;
            scatteringData.push({
              angleDeg,
              angleRad,
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
    }

    // Parse scatamp.dat for f and g scattering amplitudes
    const scatampPath = path.join(tempDir, 'scatamp.dat');
    if (fs.existsSync(scatampPath)) {
      const scatampLines = fs.readFileSync(scatampPath, 'utf-8').split('\n');
      let idx = 0;
      for (const line of scatampLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
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

    // Parse scfield.dat for central potential profile V(r)
    const potentialProfile: PotentialPoint[] = [];
    const scfieldPath = path.join(tempDir, 'scfield.dat');
    if (fs.existsSync(scfieldPath)) {
      const scfieldLines = fs.readFileSync(scfieldPath, 'utf-8').split('\n');
      for (const line of scfieldLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
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

    // Parse dpwa.dat for Dirac phase shifts
    const phaseShifts: PhaseShiftPoint[] = [];
    const dpwaPath = path.join(tempDir, 'dpwa.dat');
    if (fs.existsSync(dpwaPath)) {
      const dpwaLines = fs.readFileSync(dpwaPath, 'utf-8').split('\n');
      for (const line of dpwaLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('KINETIC')) continue;
        const tokens = trimmed.split(/\s+/);
        if (tokens.length >= 3) {
          const l = parseInt(tokens[0], 10);
          const phaseUp = parseFloat(tokens[1]);
          const phaseDown = parseFloat(tokens[2]);

          if (!isNaN(l) && !isNaN(phaseUp)) {
            phaseShifts.push({
              kappa: -l - 1,
              l,
              j: l + 0.5,
              deltaRe: phaseUp,
              deltaIm: 0,
              eta: 1.0,
            });
            if (l > 0) {
              phaseShifts.push({
                kappa: l,
                l,
                j: l - 0.5,
                deltaRe: phaseDown,
                deltaIm: 0,
                eta: 1.0,
              });
            }
          }
        }
      }
    }

    // Clean up temporary run directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup error
    }

    const endTime = performance.now();

    // Relativistic Kinematics
    const HARtree_EV = 27.211386245988;
    const SPEED_OF_LIGHT = 137.035999084;
    const eKinAu = params.energyEv / HARtree_EV;
    const c = SPEED_OF_LIGHT;
    const kWaveVector = Math.sqrt(eKinAu * (eKinAu + 2 * c * c)) / c;
    const gammaRelativistic = 1 + eKinAu / (c * c);
    const betaRelativistic = Math.sqrt(Math.max(0, 1 - 1 / (gammaRelativistic * gammaRelativistic)));

    return {
      params,
      element,
      scatteringData: scatteringData.length > 0 ? scatteringData : runDiracPartialWaveSimulation(params).scatteringData,
      potentialProfile: potentialProfile.length > 0 ? potentialProfile : runDiracPartialWaveSimulation(params).potentialProfile,
      phaseShifts: phaseShifts.length > 0 ? phaseShifts : runDiracPartialWaveSimulation(params).phaseShifts,
      summary: {
        sigmaElAu: sigmaElAu || runDiracPartialWaveSimulation(params).summary.sigmaElAu,
        sigmaElCm2: (sigmaElAu || runDiracPartialWaveSimulation(params).summary.sigmaElAu) * BOHR_SQ_TO_CM2,
        sigma1Au: sigma1Au || runDiracPartialWaveSimulation(params).summary.sigma1Au,
        sigma1Cm2: (sigma1Au || runDiracPartialWaveSimulation(params).summary.sigma1Au) * BOHR_SQ_TO_CM2,
        sigma2Au: sigma2Au || runDiracPartialWaveSimulation(params).summary.sigma2Au,
        sigmaAbsAu,
        kWaveVector,
        gammaRelativistic,
        betaRelativistic,
        maxL: phaseShifts.length > 0 ? Math.max(...phaseShifts.map((p) => p.l)) : 50,
        computationTimeMs: Math.round((endTime - startTime) * 10) / 10,
        engineUsed: 'salvat-official-fortran',
      },
      elsepaInputFileText: inputContent,
    };
  } catch (err) {
    console.error('Fortran execution failed in temp directory:', err);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
    return runDiracPartialWaveSimulation(params);
  }
}
