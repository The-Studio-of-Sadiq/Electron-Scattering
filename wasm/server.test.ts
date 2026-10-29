// Server engine test: the Express server's compute paths must run native
// ELSEPA (gfortran) and must never answer with the approximate TypeScript model
// unless it is explicitly requested.
//
//   npx tsx wasm/server.test.ts
//
// Needs gfortran on PATH (the runner compiles elsepa_exec / elscatm_exec in the
// repository root on first use); see .github/workflows/elsepa-parity.yml.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runOfficialFortranSimulation,
  runOfficialMolecularFortranSimulation,
  runOfficialEnergySweep,
} from '../server/fortranRunner';
import { ElsepaInputParams, MolecularInputParams } from '../src/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const base: ElsepaInputParams = {
  z: 79, projectile: -1, energyEv: 1000, massNumber: 196.97, nuclearModel: 'fermi', fermiC: 6.55, fermiT: 0.5229,
  densityModel: 'dirac-fock', exchangeModel: 'furness-mccarthy', polarizationModel: 'none', polarizability: 0,
  cutoffRadius: 1.7, absorptionModel: 'none', minAngle: 0, maxAngle: 180, angleStep: 1,
};

const water: MolecularInputParams = {
  moleculeName: 'H2O',
  atoms: [
    { z: 8, xAngstrom: 0, yAngstrom: 0, zAngstrom: 0 },
    { z: 1, xAngstrom: 0.757, yAngstrom: 0.586, zAngstrom: 0 },
    { z: 1, xAngstrom: -0.757, yAngstrom: 0.586, zAngstrom: 0 },
  ],
  projectile: -1, energyEv: 100, exchangeModel: 'furness-mccarthy', polarizationModel: 'none', polarizability: 0,
  absorptionModel: 'none',
};

// Header value of the reference table for Au e- 1 keV (validations/T10-12).
function referenceSigmaElAu(): number {
  const text = fs.readFileSync(path.join(ROOT, 'validations', 'T10-12', 'dcs_au_1p000e03.dat'), 'utf8');
  return Number(text.match(/Total elastic cross section = \S+ cm\*\*2 = (\S+) a0\*\*2/)![1]);
}

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err: any) {
    failures++;
    console.log(`FAIL  ${name}: ${err?.message || err}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));

check('atomic run uses native ELSEPA and matches validations/T10-12', () => {
  const r = runOfficialFortranSimulation(base);
  assert(r.summary.engineUsed === 'salvat-official-fortran', `engineUsed = ${r.summary.engineUsed}`);
  const ref = referenceSigmaElAu();
  assert(relDiff(r.summary.sigmaElAu, ref) < 1e-5, `sigma_el ${r.summary.sigmaElAu} vs ${ref}`);
});

check('energy sweep runs native ELSEPA at every energy', () => {
  const sweep = runOfficialEnergySweep(base, [100, 1000, 100000]);
  assert(sweep.length === 3, `${sweep.length} points`);
  for (const pt of sweep) {
    const single = runOfficialFortranSimulation({ ...base, energyEv: pt.energyEv });
    assert(pt.sigmaElAu === single.summary.sigmaElAu, `${pt.energyEv} eV: sweep ${pt.sigmaElAu} vs single run ${single.summary.sigmaElAu}`);
  }
  assert(relDiff(sweep[1].sigmaElAu, referenceSigmaElAu()) < 1e-5, `1 keV sweep point ${sweep[1].sigmaElAu}`);
});

check('invalid input raises an error instead of returning approximate numbers', () => {
  let threw = false;
  try {
    runOfficialFortranSimulation({ ...base, energyEv: 5 }); // ELSCATA stops below 10 eV
  } catch {
    threw = true;
  }
  assert(threw, 'a 5 eV run returned a result');
});

check('molecular run uses native ELSCATM', () => {
  const r = runOfficialMolecularFortranSimulation(water);
  assert(r.summary.engineUsed === 'salvat-official-fortran', `engineUsed = ${r.summary.engineUsed}`);
  assert(r.scatteringData.length > 100, `${r.scatteringData.length} angles`);
});

check('TypeScript model is used only when requested, and labelled as such', () => {
  const a = runOfficialFortranSimulation({ ...base, forceEngine: 'typescript' } as any);
  assert(a.summary.engineUsed === 'typescript-dirac-solver', `atomic engineUsed = ${a.summary.engineUsed}`);
  const m = runOfficialMolecularFortranSimulation({ ...water, forceEngine: 'typescript' } as any);
  assert(m.summary.engineUsed === 'typescript-dirac-solver', `molecular engineUsed = ${m.summary.engineUsed}`);
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
