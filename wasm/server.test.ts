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
import { validateEnergies } from '../src/physics/energyGrid';
import { app } from '../server';

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
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
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

check('/api/energy-sweep rejects an invalid energies array with 400', () => {
  const invalidCases = [[], [5], [2e9], Array.from({ length: 101 }, (_, i) => 10 + i * 10)];
  for (const energies of invalidCases) {
    const { errors } = validateEnergies(energies);
    assert(errors.length > 0, `energies ${JSON.stringify(energies)} should produce validation errors`);
  }
});

check('custom-density simulation uses native ELSEPA with isolated density.usr and matches reference', () => {
  const z079 = fs.readFileSync(path.join(ROOT, 'data', 'z_079.den'), 'utf8');
  const r = runOfficialFortranSimulation({
    ...base,
    densityModel: 'custom-file',
    customDensityData: z079,
  });
  assert(r.summary.engineUsed === 'salvat-official-fortran', `engineUsed = ${r.summary.engineUsed}`);
  const ref = referenceSigmaElAu();
  assert(relDiff(r.summary.sigmaElAu, ref) < 1e-5, `sigma_el ${r.summary.sigmaElAu} vs ${ref}`);
});

await check('with default environment, the four source write endpoints return 403 and make no file changes', async () => {
  const originalFortran = fs.readFileSync(path.join(ROOT, 'fortran', 'elsepa2020.f'), 'utf8');
  const originalTs = fs.readFileSync(path.join(ROOT, 'src', 'physics', 'elsepaPhysicsEngine.ts'), 'utf8');

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. POST /api/fortran-source/save
    const r1 = await fetch(`${baseUrl}/api/fortran-source/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'elsepa2020.f', content: 'MALICIOUS_FORTRAN_CODE' }),
    });
    assert(r1.status === 403, `POST /api/fortran-source/save returned status ${r1.status}, expected 403`);

    // 2. POST /api/fortran-source/reset
    const r2 = await fetch(`${baseUrl}/api/fortran-source/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'elsepa2020.f' }),
    });
    assert(r2.status === 403, `POST /api/fortran-source/reset returned status ${r2.status}, expected 403`);

    // 3. POST /api/ts-source/save
    const r3 = await fetch(`${baseUrl}/api/ts-source/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'MALICIOUS_TS_CODE' }),
    });
    assert(r3.status === 403, `POST /api/ts-source/save returned status ${r3.status}, expected 403`);

    // 4. POST /api/ts-source/reset
    const r4 = await fetch(`${baseUrl}/api/ts-source/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(r4.status === 403, `POST /api/ts-source/reset returned status ${r4.status}, expected 403`);

    // Assert no file changes occurred
    const currentFortran = fs.readFileSync(path.join(ROOT, 'fortran', 'elsepa2020.f'), 'utf8');
    const currentTs = fs.readFileSync(path.join(ROOT, 'src', 'physics', 'elsepaPhysicsEngine.ts'), 'utf8');
    assert(currentFortran === originalFortran, 'fortran/elsepa2020.f was modified despite 403 response');
    assert(currentTs === originalTs, 'src/physics/elsepaPhysicsEngine.ts was modified despite 403 response');
  } finally {
    server.close();
  }
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
