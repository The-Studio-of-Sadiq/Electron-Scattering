// Benchmark: wall time of the WebAssembly ELSEPA versus native gfortran ELSEPA
// on the same input decks. Each WebAssembly run includes creating a fresh module
// instance (as the app's worker does); each native run includes starting the
// process and writing its output files. Reports the median of RUNS runs.
//
//   NATIVE_ELSCATA=... NATIVE_ELSCATM=... npx tsx wasm/benchmark.ts
//
// Without the native binaries only the WebAssembly times are reported.
import os from 'os';
import { buildAtomicInput } from '../src/physics/elsepaFortranIO';
import { Program, base, native, read, runNative, runWasm } from './harness';

const RUNS = Number(process.env.BENCH_RUNS || 5);

const cases: Array<[string, Program, string]> = [
  ['H, e-, 1 keV', 'atomic', buildAtomicInput({ ...base, z: 1, massNumber: 1.008 })],
  ['Au, e-, 1 keV', 'atomic', buildAtomicInput(base)],
  ['Au, e-, 100 keV', 'atomic', buildAtomicInput({ ...base, energyEv: 1e5 })],
  ['Au, e-, 1 keV, Buckingham polarization', 'atomic', buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 })],
  ['Au, e-, 1 keV, LDA absorption', 'atomic', buildAtomicInput({ ...base, absorptionModel: 'staszewska-lda' })],
  ['Hg, e-, 100 eV + 1 keV (official example)', 'atomic', read('wasm/tests/official_hg_lda_abs.in')],
  ['H2O, e-, 100 + 200 eV (official example)', 'molecular', read('wasm/tests/official_h2o.in')],
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`);

async function time(fn: () => unknown | Promise<unknown>): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await fn();
    out.push(performance.now() - t0);
  }
  return out;
}

console.log(`Machine: ${os.cpus()[0]?.model} (${os.cpus().length} threads), ${os.platform()} ${os.release()}, Node ${process.version}`);
console.log(`Median of ${RUNS} runs per case.\n`);
console.log('| Case | WebAssembly | Native gfortran | Ratio (WASM / native) |');
console.log('|---|---|---|---|');
for (const [name, program, input] of cases) {
  const wasm = median(await time(() => runWasm(program, input)));
  const binary = native[program];
  const nat = binary ? median(await time(() => runNative(binary, input))) : NaN;
  console.log(`| ${name} | ${fmt(wasm)} | ${binary ? fmt(nat) : 'n/a'} | ${binary ? (wasm / nat).toFixed(2) : 'n/a'} |`);
}
