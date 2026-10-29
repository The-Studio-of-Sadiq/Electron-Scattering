// Output test: the app must read every quantity ELSEPA computes, and each
// model option in the interface must reach ELSEPA. Runs the WebAssembly build,
// so it needs no compiler.
//
//   npx tsx wasm/outputs.test.ts
import { buildAtomicInput, parseAtomicOutputs } from '../src/physics/elsepaFortranIO';
import { ElsepaInputParams } from '../src/types';
import { base, runWasm } from './harness';

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
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

async function simulate(params: ElsepaInputParams) {
  const input = buildAtomicInput(params);
  const files = await runWasm('atomic', input, true);
  const result = parseAtomicOutputs(params, files, input, 0);
  assert(result, 'no result parsed');
  const dcs = files[Object.keys(files).find((f) => f.startsWith('dcs_'))!];
  return { result, dcs };
}

const headerValue = (text: string, label: string) =>
  Number(text.match(new RegExp(`${label} = \\S+ cm\\*\\*2 = (\\S+) a0\\*\\*2`))![1]);

await check('absorption cross section is read from the ELSEPA output', async () => {
  const { result, dcs } = await simulate({ ...base, absorptionModel: 'staszewska-lda' });
  const expected = headerValue(dcs, 'Absorption cross section');
  assert(expected > 0, 'ELSEPA printed no absorption cross section');
  assert(result.summary.sigmaAbsAu === expected, `sigma_abs ${result.summary.sigmaAbsAu} vs ${expected}`);
});

await check('absorption: complex phase shifts from dpwai.dat (eta < 1)', async () => {
  const { result } = await simulate({ ...base, absorptionModel: 'staszewska-lda' });
  assert(result.phaseShifts.length > 10, `${result.phaseShifts.length} phase shifts`);
  assert(result.phaseShifts.some((p) => p.deltaIm > 0 && p.eta < 1), 'no absorptive phase shifts');
});

await check('no absorption: sigma_abs = 0 and real phase shifts', async () => {
  const { result } = await simulate(base);
  assert(result.summary.sigmaAbsAu === 0, `sigma_abs ${result.summary.sigmaAbsAu}`);
  assert(result.phaseShifts.length > 10 && result.phaseShifts.every((p) => p.eta === 1), 'unexpected phase shifts');
});

for (const absorptionModel of ['none', 'staszewska-lda'] as const) {
  await check(`spin functions T, U from f and g (absorption: ${absorptionModel})`, async () => {
    const { result } = await simulate({ ...base, absorptionModel });
    let worstS = 0;
    let worstNorm = 0;
    for (const p of result.scatteringData) {
      assert(Number.isFinite(p.spinT) && Number.isFinite(p.spinU), `T/U missing at ${p.angleDeg} deg`);
      const d = p.reF ** 2 + p.imF ** 2 + p.reG ** 2 + p.imG ** 2;
      const sFromAmplitudes = (-2 * (p.imF * p.reG - p.reF * p.imG)) / d;
      worstS = Math.max(worstS, Math.abs(sFromAmplitudes - p.shermanS));
      worstNorm = Math.max(worstNorm, Math.abs(p.shermanS ** 2 + p.spinT ** 2 + p.spinU ** 2 - 1));
    }
    // ELSEPA prints S and f, g with 6 significant digits.
    assert(worstS < 1e-5, `S from f, g differs from ELSEPA's Sherman function by ${worstS}`);
    assert(worstNorm < 1e-4, `S^2 + T^2 + U^2 deviates from 1 by ${worstNorm}`);
  });
}

const options: Array<[string, Partial<ElsepaInputParams>, RegExp]> = [
  ['positive ion (Au+, q = 1)', { ionCharge: 1 }, /Number of electrons = 78\b/],
  ['muffin-tin model (Cu in a solid)', { z: 29, massNumber: 63.546, muffinTin: true }, /Muffin-tin model: Rmt =/],
  ['muffin-tin radius set by the user', { z: 29, massNumber: 63.546, muffinTin: true, muffinTinRadiusAngstrom: 1.2 }, /Rmt = 1\.20000E-08 cm/],
  ['LDA correlation-polarization', { z: 80, energyEv: 100, polarizationModel: 'lda' }, /Correlation-polarization potential \(LDA\)/],
  ['Helm nuclear model', { energyEv: 1e5, nuclearModel: 'helm' }, /Helm's Uu distribution/],
  ['Thomas-Fermi-Dirac density', { densityModel: 'thomas-fermi-dirac' }, /analytical TFD model/],
  ['Dirac-Hartree-Fock-Slater density', { densityModel: 'dhfs' }, /analytical DHFS model/],
  ['Thomas-Fermi-Moliere density', { densityModel: 'thomas-fermi' }, /analytical TFM model/],
  ['Dirac-Fock density (default)', {}, /Read from file z_079\.den/],
];
await check('ELSEPA warnings are passed on (ion: angular limit of the DCS)', async () => {
  const { result } = await simulate({ ...base, ionCharge: 1 });
  const w = result.elsepaWarnings || [];
  assert(w.some((s) => /only for THETA \.gt\./.test(s)), `warnings: ${JSON.stringify(w)}`);
  const neutral = await simulate(base);
  assert(!(neutral.result.elsepaWarnings || []).length, `neutral atom warnings: ${JSON.stringify(neutral.result.elsepaWarnings)}`);
});

for (const [name, change, expected] of options) {
  await check(`option reaches ELSEPA: ${name}`, async () => {
    const { result, dcs } = await simulate({ ...base, ...change });
    assert(expected.test(dcs), `ELSEPA header does not show ${expected}`);
    assert(result.summary.sigmaElAu > 0, 'no cross section');
  });
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
