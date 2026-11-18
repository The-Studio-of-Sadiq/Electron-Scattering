// Parity test: the WebAssembly ELSEPA build (public/elsepa) must reproduce
// native gfortran ELSEPA, and both must reproduce the reference tables in
// validations/.
//
//   npx tsx wasm/parity.test.ts
//
// Native binaries are taken from NATIVE_ELSCATA / NATIVE_ELSCATM (built from
// fortran/*.f with gfortran; see .github/workflows/elsepa-parity.yml). Without
// them only the WebAssembly-vs-validations checks run.
import fs from 'fs';
import path from 'path';
import { buildAtomicInput } from '../src/physics/elsepaFortranIO';
import { Program, ROOT, base, native, read, runNative, runWasm } from './harness';

const REL_TOL = 1e-5; // output is printed with 6 significant digits

const engineFile = path.join(ROOT, 'validations', 'ENGINE.txt');
const isEngine2020 = fs.existsSync(engineFile) && fs.readFileSync(engineFile, 'utf8').trim() === 'elsepa-2020';

interface Case {
  name: string;
  program: Program;
  input: string;
  reference?: string; // validations/ .dat to match for the first DCS file
  referenceDir?: string; // validations/ folder holding every dcs_*.dat under its ELSEPA name
  official2021Ref?: { file: string; path: string }; // unconditional comparison against 2021 authors' reference
  dataFiles?: Record<string, string>;
}

function validationCases(): Case[] {
  const defs: Array<[string, number, -1 | 1, number]> = [
    ['T1-4', 1, -1, 1e3], ['T4-6', 29, -1, 1e3], ['T7-9', 29, -1, 1e5], ['T10-12', 79, -1, 1e3],
    ['T13-15', 79, -1, 1e5], ['T16', 29, 1, 1e3], ['T17', 29, 1, 1e5],
  ];
  return defs.map(([dir, z, projectile, energyEv]) => {
    const vd = path.join(ROOT, 'validations', dir);
    const dat = fs.readdirSync(vd).find((f) => f.endsWith('.dat'))!;
    return {
      name: `validation ${dir}`,
      program: 'atomic',
      input: buildAtomicInput({ ...base, z, projectile, energyEv, exchangeModel: projectile < 0 ? 'furness-mccarthy' : 'none' }),
      reference: path.join(vd, dat),
    };
  });
}

const cases: Case[] = [
  ...validationCases(),
  // Inputs exactly as the app builds them, with correlation-polarization / absorption.
  { name: 'app: Au e- 1 keV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 }), referenceDir: 'T18' },
  { name: 'app: Hg e- 1 keV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, z: 80, massNumber: 200.59, polarizationModel: 'buckingham', polarizability: 33.9 }), referenceDir: 'T19' },
  { name: 'app: Cu e+ 500 eV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, z: 29, massNumber: 63.546, projectile: 1, energyEv: 500, exchangeModel: 'none', polarizationModel: 'buckingham', polarizability: 42.5 }), referenceDir: 'T20' },
  { name: 'app: Au e- 1 keV absorption', program: 'atomic', input: buildAtomicInput({ ...base, absorptionModel: 'staszewska-lda' }), referenceDir: 'T21' },
  // Example inputs shipped with the official ELSEPA 2021 distribution (elsepa-2020 package). The Hg
  // example is also compared with the authors' own output for it (an independent reference).
  {
    name: 'official: Hg e- 100 eV + 1 keV, LDA polarization + absorption',
    program: 'atomic',
    input: read('wasm/tests/official_hg_lda_abs.in'),
    referenceDir: 'T22',
    official2021Ref: { file: 'dcs_1p000e03.dat', path: path.join(ROOT, 'validations', 'official-2021', 'dcs_1p000e03.dat') },
  },
  { name: 'official: H2O e- 500 eV with absorption (ELSCATM)', program: 'molecular', input: read('wasm/tests/official_h2o.in'), referenceDir: 'T23' },
  // Model options exposed in v1.2 (checked against native gfortran when available).
  { name: 'app: Au+ e- 1 keV (ion, q = 1)', program: 'atomic', input: buildAtomicInput({ ...base, ionCharge: 1 }) },
  { name: 'app: Cu e- 1 keV muffin-tin (solid)', program: 'atomic', input: buildAtomicInput({ ...base, z: 29, massNumber: 63.546, muffinTin: true }) },
  { name: 'app: Hg e- 100 eV LDA polarization', program: 'atomic', input: buildAtomicInput({ ...base, z: 80, massNumber: 200.59, energyEv: 100, polarizationModel: 'lda' }) },
  { name: 'app: Au e- 100 keV Helm nucleus', program: 'atomic', input: buildAtomicInput({ ...base, energyEv: 1e5, nuclearModel: 'helm' }) },
  { name: 'app: Au e- 1 keV TFD density', program: 'atomic', input: buildAtomicInput({ ...base, densityModel: 'thomas-fermi-dirac' }) },
  { name: 'app: Au e- 1 keV DHFS density', program: 'atomic', input: buildAtomicInput({ ...base, densityModel: 'dhfs' }) },
  { name: 'app: Au e- 1 keV TFM density', program: 'atomic', input: buildAtomicInput({ ...base, densityModel: 'thomas-fermi' }) },
  {
    name: 'app: Au e- 1 keV, user-supplied density (z_079.den as density.usr)',
    program: 'atomic',
    input: buildAtomicInput({
      ...base,
      densityModel: 'custom-file',
      customDensityData: read('data/z_079.den'),
    }),
    dataFiles: { 'density.usr': read('data/z_079.den') },
  },
];

// Sherman function S (|S| <= 1) is compared absolutely: where S is ~1e-10 the
// last printed digit is floating-point noise between libf2c and gfortran's
// libm, far below ELSEPA's own error estimate printed on the same line.
const SHERMAN_ABS_TOL = 1e-9;
// Fortran D-format exponents: gfortran prints 1.18591D-01 where libf2c prints 1.18591E-01
// (ELSEPA uses D12.5 for the analytical density parameters).
const NUMBER = /[-+]?\d+\.\d+[ED][-+]\d+/gi;

interface Value {
  value: number;
  sherman: boolean;
  estimate: boolean; // ELSEPA's convergence-error estimate, printed with 2 significant digits
  line: string;
}

// Every number in a dcs file: header cross sections plus the DCS table. In the
// table rows (THETA, MU, DCS, DCS, Sherman[, error]) column 5 is the Sherman function
// and column 6 ELSEPA's error estimate.
function values(text: string): Value[] {
  const out: Value[] = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const isTableRow = !line.trim().startsWith('#');
    (line.match(NUMBER) || []).forEach((tok, col) =>
      out.push({
        value: Number(tok.replace(/D/i, 'E')),
        sherman: isTableRow && col === 4,
        estimate: isTableRow && col === 5,
        line: line.trim(),
      })
    );
  }
  return out;
}

function compare(a: string, b: string): { count: number; maxRel: number; differing: number; worst?: string; error?: string } {
  const x = values(a);
  const y = values(b);
  if (x.length === 0) return { count: 0, maxRel: Infinity, differing: 0, error: 'no numbers in output' };
  if (x.length !== y.length) return { count: x.length, maxRel: Infinity, differing: 0, error: `${x.length} vs ${y.length} values` };
  // Values that are not bit-identical (all within tolerance when the check passes).
  const differing = x.filter((v, i) => v.value !== y[i].value).length;
  let maxRel = 0;
  let worst = -1;
  let shermanFailure: string | undefined;
  for (let i = 0; i < x.length; i++) {
    if (x[i].estimate) {
      // An error estimate printed as a.bE-xx may differ by one unit in its last digit.
      const scale = Math.max(Math.abs(x[i].value), Math.abs(y[i].value));
      const unit = scale > 0 ? Math.pow(10, Math.floor(Math.log10(scale)) - 1) : 0;
      if (Math.abs(x[i].value - y[i].value) > unit * 1.0001 && !shermanFailure) {
        shermanFailure = `error estimate ${x[i].value} vs ${y[i].value} in line "${x[i].line}"`;
      }
      continue;
    }
    if (x[i].sherman) {
      const diff = Math.abs(x[i].value - y[i].value);
      const rel = diff / Math.max(Math.abs(x[i].value), Math.abs(y[i].value), 1e-300);
      // |S| <= 1, so ELSEPA's own error estimate for the row (next value) is a fair absolute bound
      // where convergence is poor, e.g. the smallest angles computed for an ion (Au+ at 0.5 deg).
      const rowEstimate = x[i + 1]?.estimate ? Math.max(x[i + 1].value, y[i + 1].value) : 0;
      if (diff > Math.max(SHERMAN_ABS_TOL, rowEstimate) && rel > REL_TOL && !shermanFailure) {
        shermanFailure = `Sherman ${x[i].value} vs ${y[i].value} in line "${x[i].line}"`;
      }
      continue;
    }
    const scale = Math.max(Math.abs(x[i].value), Math.abs(y[i].value));
    if (scale < 1e-30) continue;
    const rel = Math.abs(x[i].value - y[i].value) / scale;
    if (rel > maxRel) {
      maxRel = rel;
      worst = i;
    }
  }
  if (shermanFailure) return { count: x.length, maxRel: Infinity, differing, error: shermanFailure };
  if (worst < 0) return { count: x.length, maxRel, differing };
  // Show the line holding the worst value so a failure is easy to interpret.
  return { count: x.length, maxRel, differing, worst: `${x[worst].value} vs ${y[worst].value} in line "${x[worst].line}"` };
}

if (!native.atomic || !native.molecular) {
  console.warn('NATIVE_ELSCATA / NATIVE_ELSCATM not set: skipping WebAssembly-vs-gfortran comparisons.\n');
}

let failures = 0;
const report = (name: string, check: string, r: ReturnType<typeof compare>) => {
  const ok = !r.error && r.maxRel <= REL_TOL;
  if (!ok) failures++;
  const detail = r.error ?? `${r.count} values, max rel diff ${r.maxRel.toExponential(1)}, ${r.differing} not identical${ok || !r.worst ? '' : `; ${r.worst}`}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} [${check}] ${detail}`);
};

for (const c of cases) {
  const wasmFiles = await runWasm(c.program, c.input, false, c.dataFiles);
  const names = Object.keys(wasmFiles).sort();
  if (names.length === 0) {
    failures++;
    console.log(`FAIL  ${c.name} [wasm] no dcs output`);
    continue;
  }

  if (c.official2021Ref) {
    const { file, path: refPath } = c.official2021Ref;
    if (!wasmFiles[file]) {
      failures++;
      console.log(`FAIL  ${c.name} [wasm vs official-2021] missing ${file}`);
    } else {
      report(c.name, 'wasm vs official-2021', compare(wasmFiles[file], fs.readFileSync(refPath, 'utf8')));
    }
  }

  if (c.reference) {
    if (!isEngine2020) {
      console.log(`SKIP  ${c.name} [validations/T*] (validations/ENGINE.txt is not "elsepa-2020"; reference tables will be regenerated in CI)`);
    } else {
      report(c.name, 'wasm vs validations', compare(wasmFiles[names[0]], fs.readFileSync(c.reference, 'utf8')));
    }
  }
  if (c.referenceDir) {
    if (!isEngine2020) {
      console.log(`SKIP  ${c.name} [validations/${c.referenceDir}] (validations/ENGINE.txt is not "elsepa-2020"; reference tables will be regenerated in CI)`);
    } else {
      const dir = path.join(ROOT, 'validations', c.referenceDir);
      for (const f of names) {
        const ref = path.join(dir, f);
        if (!fs.existsSync(ref)) {
          failures++;
          console.log(`FAIL  ${c.name} [wasm vs validations/${c.referenceDir}] missing ${f}`);
          continue;
        }
        report(c.name, `wasm vs validations/${c.referenceDir}/${f}`, compare(wasmFiles[f], fs.readFileSync(ref, 'utf8')));
      }
    }
  }

  const binary = native[c.program];
  if (binary) {
    const nativeFiles = runNative(binary, c.input, false, c.dataFiles);
    const nativeNames = Object.keys(nativeFiles).sort();
    if (nativeNames.join() !== names.join()) {
      failures++;
      console.log(`FAIL  ${c.name} [wasm vs gfortran] files differ: ${names.join(',')} vs ${nativeNames.join(',')}`);
      continue;
    }
    for (const f of names) report(c.name, `wasm vs gfortran ${f}`, compare(wasmFiles[f], nativeFiles[f]));

    if (c.official2021Ref) {
      const { file, path: refPath } = c.official2021Ref;
      if (nativeFiles[file]) {
        report(c.name, 'gfortran vs official-2021', compare(nativeFiles[file], fs.readFileSync(refPath, 'utf8')));
      }
    }
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
