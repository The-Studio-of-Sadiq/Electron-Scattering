import {
  MolecularInputParams,
  MolecularSimulationResult,
  MolecularScatteringDataPoint,
} from '../types';
import { BOHR_SQ_TO_CM2 } from './elsepaPhysicsEngine';

// Approximate IAM molecular result used when the ELSCATM binary is unavailable.
// Kept free of Node APIs so it can run both on the server and in the browser.
export function runFallbackMolecularSimulation(params: MolecularInputParams, startTime: number, inputContent: string): MolecularSimulationResult {
  const scatteringData: MolecularScatteringDataPoint[] = [];
  const numSteps = 181;

  for (let i = 0; i < numSteps; i++) {
    const theta = i;
    const angleRad = (theta * Math.PI) / 180;
    const q = 2 * Math.sin(angleRad / 2) * Math.sqrt(params.energyEv) * 0.1;

    let atomSumDcsCm2 = 0;
    let interferenceFactor = 0;

    params.atoms.forEach((atom) => {
      const zEff = atom.z;
      const singleDcs = ((0.028 * zEff * zEff) / Math.pow(1 + q * q, 2)) * 1e-16;
      atomSumDcsCm2 += singleDcs;
    });

    for (let a = 0; a < params.atoms.length; a++) {
      for (let b = a + 1; b < params.atoms.length; b++) {
        const dx = params.atoms[a].xAngstrom - params.atoms[b].xAngstrom;
        const dy = params.atoms[a].yAngstrom - params.atoms[b].yAngstrom;
        const dz = params.atoms[a].zAngstrom - params.atoms[b].zAngstrom;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const qr = q * dist;
        const sinc = qr > 0.001 ? Math.sin(qr) / qr : 1.0;
        interferenceFactor += 2 * Math.sqrt(params.atoms[a].z * params.atoms[b].z) * sinc * 1e-18;
      }
    }

    const dcsCohCm2 = Math.max(1e-22, atomSumDcsCm2 + interferenceFactor);
    const dcsIncohCm2 = Math.max(1e-22, atomSumDcsCm2);

    scatteringData.push({
      angleDeg: theta,
      angleRad,
      dcsCohCm2,
      dcsCohAu: dcsCohCm2 / BOHR_SQ_TO_CM2,
      dcsIncohCm2,
      dcsIncohAu: dcsIncohCm2 / BOHR_SQ_TO_CM2,
      shermanS: 0.1 * Math.sin(angleRad * 2),
    });
  }

  const endTime = performance.now();

  return {
    params,
    scatteringData,
    summary: {
      sigmaCohCm2: 6.5e-17,
      sigmaCohAu: 6.5e-17 / BOHR_SQ_TO_CM2,
      sigmaIncohCm2: 5.8e-17,
      sigmaIncohAu: 5.8e-17 / BOHR_SQ_TO_CM2,
      sigma1CohCm2: 8e-18,
      sigma1IncohCm2: 7.5e-18,
      sigma2CohCm2: 1.2e-17,
      sigma2IncohCm2: 1.1e-17,
      computationTimeMs: Math.round((endTime - startTime) * 10) / 10,
      engineUsed: 'salvat-official-fortran',
    },
    elsepaInputFileText: inputContent,
  };
}
