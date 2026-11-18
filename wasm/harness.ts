// Shared helpers for the ELSEPA tests and benchmark: run the WebAssembly build
// (public/elsepa) or a native gfortran binary on an input deck and collect the
// *.dat files it writes.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { ElsepaInputParams } from '../src/types';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WASM_DIR = path.join(ROOT, 'public', 'elsepa');
export const DATA_DIR = path.join(ROOT, 'data');

export type Program = 'atomic' | 'molecular';
export type Files = Record<string, string>;

// Au, e-, 1 keV, Fermi nucleus, Dirac-Fock density, Furness-McCarthy exchange.
export const base: ElsepaInputParams = {
  z: 79, projectile: -1, energyEv: 1000, massNumber: 196.97, nuclearModel: 'fermi', fermiC: 6.55, fermiT: 0.5229,
  densityModel: 'dirac-fock', exchangeModel: 'furness-mccarthy', polarizationModel: 'none', polarizability: 0,
  cutoffRadius: 1.7, absorptionModel: 'none', minAngle: 0, maxAngle: 180, angleStep: 1,
};

export const native: Record<Program, string | undefined> = {
  atomic: process.env.NATIVE_ELSCATA,
  molecular: process.env.NATIVE_ELSCATM,
};

export function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'latin1').replace(/\r/g, '');
}

const keep = (name: string, all: boolean) => name.endsWith('.dat') && (all || name.startsWith('dcs_'));

/** Runs the WebAssembly ELSEPA on a fresh module instance, as the app's worker does. */
export async function runWasm(
  program: Program,
  input: string,
  allFiles = false,
  dataFiles?: Record<string, string>
): Promise<Files> {
  const { default: createElsepa } = await import(pathToFileURL(path.join(WASM_DIR, 'elsepa.js')).href);
  let pos = 0;
  const module = await createElsepa({
    locateFile: (f: string) => path.join(WASM_DIR, f),
    stdin: () => (pos < input.length ? input.charCodeAt(pos++) : null),
    print: () => {},
    printErr: () => {},
  });
  if (dataFiles) {
    for (const [name, text] of Object.entries(dataFiles)) {
      module.FS.writeFile('/data/' + name, text);
    }
  }
  try {
    module.callMain([program]);
  } catch (err: any) {
    if (err?.name !== 'ExitStatus') throw err;
  }
  const files: Files = {};
  for (const name of module.FS.readdir('/')) {
    if (keep(name, allFiles)) files[name] = module.FS.readFile(`/${name}`, { encoding: 'utf8' });
  }
  return files;
}

/** Runs a native ELSEPA binary in a temporary directory. */
export function runNative(
  binary: string,
  input: string,
  allFiles = false,
  dataFiles?: Record<string, string>
): Files {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elsepa-'));
  let customDataDir: string | null = null;
  if (dataFiles && Object.keys(dataFiles).length > 0) {
    customDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elsepa-data-'));
    fs.cpSync(DATA_DIR, customDataDir, { recursive: true });
    for (const [name, text] of Object.entries(dataFiles)) {
      fs.writeFileSync(path.join(customDataDir, name), text, 'utf8');
    }
  }
  try {
    execFileSync(binary, [], {
      cwd: dir,
      input,
      env: { ...process.env, ELSEPA_DATA: customDataDir || DATA_DIR },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const files: Files = {};
    for (const name of fs.readdirSync(dir)) {
      if (keep(name, allFiles)) files[name] = fs.readFileSync(path.join(dir, name), 'utf8');
    }
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    if (customDataDir) {
      try {
        fs.rmSync(customDataDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
