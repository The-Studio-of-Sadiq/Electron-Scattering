// Regenerates validations/T* reference tables from native ELSEPA 2021 binaries.
// Used by CI workflow_dispatch job "references".
//
// Usage: NATIVE_ELSCATA=... NATIVE_ELSCATM=... npx tsx wasm/make-references.ts

import fs from 'fs';
import path from 'path';
import { buildAtomicInput } from '../src/physics/elsepaFortranIO';
import { Program, ROOT, base, native, read, runNative } from './harness';

const elscata = native.atomic;
const elscatm = native.molecular;

if (!elscata || !elscatm) {
  console.error('Error: NATIVE_ELSCATA and NATIVE_ELSCATM environment variables must be set.');
  process.exit(1);
}

interface Case {
  dir: string;
  program: Program;
  input: string;
  inFilename?: string;
  // If targetFile is given (T1-T17), map the primary dcs file to it.
  targetFile?: string;
}

const defsT1toT17: Array<[string, number, -1 | 1, number]> = [
  ['T1-4', 1, -1, 1e3],
  ['T4-6', 29, -1, 1e3],
  ['T7-9', 29, -1, 1e5],
  ['T10-12', 79, -1, 1e3],
  ['T13-15', 79, -1, 1e5],
  ['T16', 29, 1, 1e3],
  ['T17', 29, 1, 1e5],
];

const cases: Case[] = [
  ...defsT1toT17.map(([dir, z, projectile, energyEv]): Case => {
    const vd = path.join(ROOT, 'validations', dir);
    const existingDat = fs.readdirSync(vd).find((f) => f.endsWith('.dat'))!;
    return {
      dir,
      program: 'atomic',
      input: buildAtomicInput({
        ...base,
        z,
        projectile,
        energyEv,
        exchangeModel: projectile < 0 ? 'furness-mccarthy' : 'none',
      }),
      targetFile: existingDat,
    };
  }),
  {
    dir: 'T18',
    program: 'atomic',
    input: buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 }),
    inFilename: 'elscata.in',
  },
  {
    dir: 'T19',
    program: 'atomic',
    input: buildAtomicInput({ ...base, z: 80, massNumber: 200.59, polarizationModel: 'buckingham', polarizability: 33.9 }),
    inFilename: 'elscata.in',
  },
  {
    dir: 'T20',
    program: 'atomic',
    input: buildAtomicInput({
      ...base,
      z: 29,
      massNumber: 63.546,
      projectile: 1,
      energyEv: 500,
      exchangeModel: 'none',
      polarizationModel: 'buckingham',
      polarizability: 42.5,
    }),
    inFilename: 'elscata.in',
  },
  {
    dir: 'T21',
    program: 'atomic',
    input: buildAtomicInput({ ...base, absorptionModel: 'staszewska-lda' }),
    inFilename: 'elscata.in',
  },
  {
    dir: 'T22',
    program: 'atomic',
    input: read('wasm/tests/official_hg_lda_abs.in'),
    inFilename: 'elscata.in',
  },
  {
    dir: 'T23',
    program: 'molecular',
    input: read('wasm/tests/official_h2o.in'),
    inFilename: 'elscatm.in',
  },
];

console.log('Regenerating reference tables in validations/ with ELSEPA 2021...');

for (const c of cases) {
  const binary = c.program === 'atomic' ? elscata : elscatm;
  console.log(`Running ${c.dir} (${c.program})...`);
  const outFiles = runNative(binary, c.input, false);
  const targetDir = path.join(ROOT, 'validations', c.dir);
  fs.mkdirSync(targetDir, { recursive: true });

  if (c.inFilename) {
    fs.writeFileSync(path.join(targetDir, c.inFilename), c.input, 'utf8');
  }

  if (c.targetFile) {
    const dcsName = Object.keys(outFiles).find((f) => f.startsWith('dcs_'));
    if (!dcsName || !outFiles[dcsName]) {
      throw new Error(`No DCS output produced for ${c.dir}`);
    }
    fs.writeFileSync(path.join(targetDir, c.targetFile), outFiles[dcsName], 'utf8');
    console.log(`  -> wrote ${c.targetFile}`);
  } else {
    for (const [name, content] of Object.entries(outFiles)) {
      if (name.endsWith('.dat')) {
        fs.writeFileSync(path.join(targetDir, name), content, 'utf8');
        console.log(`  -> wrote ${name}`);
      }
    }
  }
}

fs.writeFileSync(path.join(ROOT, 'validations', 'ENGINE.txt'), 'elsepa-2020\n', 'utf8');
console.log('Wrote validations/ENGINE.txt ("elsepa-2020")');
console.log('Done!');
