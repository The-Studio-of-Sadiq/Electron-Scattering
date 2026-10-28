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
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildAtomicInput } from '../src/physics/elsepaFortranIO';
import { ElsepaInputParams } from '../src/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM_DIR = path.join(ROOT, 'public', 'elsepa');
const DATA_DIR = path.join(ROOT, 'data');
const REL_TOL = 1e-5; // output is printed with 6 significant digits

type Program = 'atomic' | 'molecular';
type Files = Record<string, string>;
interface Case {
  name: string;
  program: Program;
  input: string;
  reference?: string; // validations/ .dat to match for the first DCS file
}

const base: ElsepaInputParams = {
  z: 79, projectile: -1, energyEv: 1000, massNumber: 196.97, nuclearModel: 'fermi', fermiC: 6.55, fermiT: 0.5229,
  densityModel: 'dirac-fock', exchangeModel: 'furness-mccarthy', polarizationModel: 'none', polarizability: 0,
  cutoffRadius: 1.7, absorptionModel: 'none', minAngle: 0, maxAngle: 180, angleStep: 1,
};

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
  { name: 'app: Au e- 1 keV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 }) },
  { name: 'app: Hg e- 1 keV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, z: 80, massNumber: 200.59, polarizationModel: 'buckingham', polarizability: 33.9 }) },
  { name: 'app: Cu e+ 500 eV Buckingham', program: 'atomic', input: buildAtomicInput({ ...base, z: 29, massNumber: 63.546, projectile: 1, energyEv: 500, exchangeModel: 'none', polarizationModel: 'buckingham', polarizability: 42.5 }) },
  { name: 'app: Au e- 1 keV absorption', program: 'atomic', input: buildAtomicInput({ ...base, absorptionModel: 'staszewska-lda' }) },
  // Example inputs shipped with the official ELSEPA distribution (CPC ADUS_v1_0).
  { name: 'official: Hg e- 100 eV + 1 keV, LDA polarization + absorption', program: 'atomic', input: read('wasm/tests/official_hg_lda_abs.in') },
  { name: 'official: H2O e- 100 + 200 eV (ELSCATM)', program: 'molecular', input: read('wasm/tests/official_h2o.in') },
];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'latin1').replace(/\r/g, '');
}

async function runWasm(program: Program, input: string): Promise<Files> {
  const { default: createElsepa } = await import(pathToFileURL(path.join(WASM_DIR, 'elsepa.js')).href);
  let pos = 0;
  const module = await createElsepa({
    locateFile: (f: string) => path.join(WASM_DIR, f),
    stdin: () => (pos < input.length ? input.charCodeAt(pos++) : null),
    print: () => {},
    printErr: () => {},
  });
  try {
    module.callMain([program]);
  } catch (err: any) {
    if (err?.name !== 'ExitStatus') throw err;
  }
  const files: Files = {};
  for (const name of module.FS.readdir('/')) {
    if (name.startsWith('dcs_') && name.endsWith('.dat')) files[name] = module.FS.readFile(`/${name}`, { encoding: 'utf8' });
  }
  return files;
}

function runNative(binary: string, input: string): Files {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elsepa-'));
  try {
    execFileSync(binary, [], { cwd: dir, input, env: { ...process.env, ELSEPA_DATA: DATA_DIR }, stdio: ['pipe', 'ignore', 'pipe'] });
    const files: Files = {};
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('dcs_') && name.endsWith('.dat')) files[name] = fs.readFileSync(path.join(dir, name), 'utf8');
    }
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Sherman function S (|S| <= 1) is compared absolutely: where S is ~1e-10 the
// last printed digit is floating-point noise between libf2c and gfortran's
// libm, far below ELSEPA's own error estimate printed on the same line.
const SHERMAN_ABS_TOL = 1e-9;
const NUMBER = /[-+]?\d+\.\d+E[-+]\d+/gi;

interface Value {
  value: number;
  sherman: boolean;
  line: string;
}

// Every number in a dcs file: header cross sections plus the DCS table. In the
// table rows (THETA, MU, DCS, DCS, Sherman[, error]) column 5 is the Sherman function.
function values(text: string): Value[] {
  const out: Value[] = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const isTableRow = !line.trim().startsWith('#');
    (line.match(NUMBER) || []).forEach((tok, col) => out.push({ value: Number(tok), sherman: isTableRow && col === 4, line: line.trim() }));
  }
  return out;
}

function compare(a: string, b: string): { count: number; maxRel: number; worst?: string; error?: string } {
  const x = values(a);
  const y = values(b);
  if (x.length === 0) return { count: 0, maxRel: Infinity, error: 'no numbers in output' };
  if (x.length !== y.length) return { count: x.length, maxRel: Infinity, error: `${x.length} vs ${y.length} values` };
  let maxRel = 0;
  let worst = -1;
  let shermanFailure: string | undefined;
  for (let i = 0; i < x.length; i++) {
    if (x[i].sherman) {
      const diff = Math.abs(x[i].value - y[i].value);
      const rel = diff / Math.max(Math.abs(x[i].value), Math.abs(y[i].value), 1e-300);
      if (diff > SHERMAN_ABS_TOL && rel > REL_TOL && !shermanFailure) {
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
  if (shermanFailure) return { count: x.length, maxRel: Infinity, error: shermanFailure };
  if (worst < 0) return { count: x.length, maxRel };
  // Show the line holding the worst value so a failure is easy to interpret.
  return { count: x.length, maxRel, worst: `${x[worst].value} vs ${y[worst].value} in line "${x[worst].line}"` };
}

const native: Record<Program, string | undefined> = {
  atomic: process.env.NATIVE_ELSCATA,
  molecular: process.env.NATIVE_ELSCATM,
};
if (!native.atomic || !native.molecular) {
  console.warn('NATIVE_ELSCATA / NATIVE_ELSCATM not set: skipping WebAssembly-vs-gfortran comparisons.\n');
}

let failures = 0;
const report = (name: string, check: string, r: ReturnType<typeof compare>) => {
  const ok = !r.error && r.maxRel <= REL_TOL;
  if (!ok) failures++;
  const detail = r.error ?? `${r.count} values, max rel diff ${r.maxRel.toExponential(1)}${ok || !r.worst ? '' : `; ${r.worst}`}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} [${check}] ${detail}`);
};

for (const c of cases) {
  const wasmFiles = await runWasm(c.program, c.input);
  const names = Object.keys(wasmFiles).sort();
  if (names.length === 0) {
    failures++;
    console.log(`FAIL  ${c.name} [wasm] no dcs output`);
    continue;
  }

  if (c.reference) {
    report(c.name, 'wasm vs validations', compare(wasmFiles[names[0]], fs.readFileSync(c.reference, 'utf8')));
  }

  const binary = native[c.program];
  if (binary) {
    const nativeFiles = runNative(binary, c.input);
    const nativeNames = Object.keys(nativeFiles).sort();
    if (nativeNames.join() !== names.join()) {
      failures++;
      console.log(`FAIL  ${c.name} [wasm vs gfortran] files differ: ${names.join(',')} vs ${nativeNames.join(',')}`);
      continue;
    }
    for (const f of names) report(c.name, `wasm vs gfortran ${f}`, compare(wasmFiles[f], nativeFiles[f]));
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
