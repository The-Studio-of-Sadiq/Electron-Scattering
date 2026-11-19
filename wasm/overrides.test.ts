// Overrides & anions test: tests nuclear parameter overrides (ATWGHT, NUCRAD, NUCSKN),
// negative ion support (anions, NELEC > IZ), and patch idempotence/robustness.
// Runs without gfortran using WebAssembly.
//
//   npx tsx wasm/overrides.test.ts
//
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildAtomicInput, parseAtomicOutputs } from '../src/physics/elsepaFortranIO';
import { ELAW, elsepaDefaultNuclear } from '../src/data/elsepaTables';
import { validateAngularGrid, interpolatePoint, integratePartialCrossSection } from '../src/physics/angularGrid';
import { base, runWasm, read, ROOT } from './harness';

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

const NUMBER = /[-+]?\d+\.\d+[ED][-+]\d+/gi;
const REL_TOL = 1e-5;
const SHERMAN_ABS_TOL = 1e-9;

interface Value {
  value: number;
  sherman: boolean;
  estimate: boolean;
  line: string;
}

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

function compareDcs(a: string, b: string): { ok: boolean; maxRel: number; error?: string } {
  const x = values(a);
  const y = values(b);
  if (x.length === 0) return { ok: false, maxRel: Infinity, error: 'no numbers in output' };
  if (x.length !== y.length) return { ok: false, maxRel: Infinity, error: `${x.length} vs ${y.length} values` };

  let maxRel = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i].estimate) {
      continue;
    }
    if (x[i].sherman) {
      const diff = Math.abs(x[i].value - y[i].value);
      const rowEstimate = x[i + 1]?.estimate ? Math.max(x[i + 1].value, y[i + 1].value) : 0;
      if (diff > Math.max(SHERMAN_ABS_TOL, rowEstimate)) {
        const rel = diff / Math.max(Math.abs(x[i].value), Math.abs(y[i].value), 1e-300);
        if (rel > REL_TOL) {
          return { ok: false, maxRel: rel, error: `Sherman ${x[i].value} vs ${y[i].value} in line "${x[i].line}"` };
        }
      }
      continue;
    }
    const scale = Math.max(Math.abs(x[i].value), Math.abs(y[i].value));
    if (scale < 1e-30) continue;
    const rel = Math.abs(x[i].value - y[i].value) / scale;
    if (rel > maxRel) {
      maxRel = rel;
    }
  }
  return { ok: maxRel <= REL_TOL, maxRel };
}

// ==========================================
// 1. Patch Script Tests (Idempotence & Anchor Failure)
// ==========================================

await check('patch: idempotence on repeated runs and failure on missing anchor', () => {
  const patchScript = path.join(ROOT, 'wasm', 'patch-elsepa.mjs');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elsepa-patch-test-'));

  try {
    const srcDir = path.join(tempDir, 'src');
    const outDir = path.join(tempDir, 'out');
    fs.mkdirSync(srcDir, { recursive: true });

    // Copy official fortran files to srcDir
    for (const f of ['elscata.f', 'elscatm.f', 'elsepa2020.f', 'radial.f']) {
      fs.copyFileSync(path.join(ROOT, 'fortran', f), path.join(srcDir, f));
    }

    // Run 1
    execSync(`node "${patchScript}" "${srcDir}" "${outDir}"`, { encoding: 'utf-8' });
    const elscata1 = fs.readFileSync(path.join(outDir, 'elscata.f'), 'utf-8');
    const elsepa1 = fs.readFileSync(path.join(outDir, 'elsepa2020.f'), 'utf-8');

    // Run 2 into same outDir (idempotent)
    execSync(`node "${patchScript}" "${srcDir}" "${outDir}"`, { encoding: 'utf-8' });
    const elscata2 = fs.readFileSync(path.join(outDir, 'elscata.f'), 'utf-8');
    const elsepa2 = fs.readFileSync(path.join(outDir, 'elsepa2020.f'), 'utf-8');

    assert(elscata1 === elscata2, 'elscata.f changed on second run');
    assert(elsepa1 === elsepa2, 'elsepa2020.f changed on second run');

    // Run 3 where source is already patched
    const outDir2 = path.join(tempDir, 'out2');
    execSync(`node "${patchScript}" "${outDir}" "${outDir2}"`, { encoding: 'utf-8' });
    const elscata3 = fs.readFileSync(path.join(outDir2, 'elscata.f'), 'utf-8');
    assert(elscata1 === elscata3, 'elscata.f changed when source was already patched');

    // Anchor failure test: remove anchor from unpatched file
    const badSrcDir = path.join(tempDir, 'badSrc');
    const badOutDir = path.join(tempDir, 'badOut');
    fs.mkdirSync(badSrcDir, { recursive: true });
    for (const f of ['elscata.f', 'elscatm.f', 'elsepa2020.f', 'radial.f']) {
      fs.copyFileSync(path.join(ROOT, 'fortran', f), path.join(badSrcDir, f));
    }
    // Corrupt an anchor
    const corruptedElsepa = fs.readFileSync(path.join(badSrcDir, 'elsepa2020.f'), 'utf-8')
      .replace("STOP 'EFIELD: Negative ion.'", "STOP 'CORRUPTED'");
    fs.writeFileSync(path.join(badSrcDir, 'elsepa2020.f'), corruptedElsepa, 'utf-8');

    let exitedWith1 = false;
    try {
      execSync(`node "${patchScript}" "${badSrcDir}" "${badOutDir}"`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      if (err.status === 1) exitedWith1 = true;
    }
    assert(exitedWith1, 'patch script did not exit with code 1 on missing anchor');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ==========================================
// 2. Default Deck & Official Hg Parity Test
// ==========================================

await check('default deck: Au e- 1 keV gives total elastic cross section 8.94335 a0^2', async () => {
  const files = await runWasm('atomic', buildAtomicInput(base));
  const dcs = Object.values(files)[0];
  assert(dcs, 'no DCS file produced');
  const m = dcs.match(/Total elastic cross section =.*?=\s*([0-9.+-EedD]+)\s*a0\*\*2/);
  assert(m, 'total elastic cross section not found in output');
  const sigmaEl = parseFloat(m[1]);
  assert(Math.abs(sigmaEl - 8.94335) < 1e-4, `expected 8.94335 a0^2, got ${sigmaEl}`);
});

await check('official Hg LDA abs matches validations/official-2021/dcs_1p000e03.dat within tolerance', async () => {
  const files = await runWasm('atomic', read('wasm/tests/official_hg_lda_abs.in'));
  const dcs = files['dcs_1p000e03.dat'];
  assert(dcs, 'dcs_1p000e03.dat was not generated');
  const ref = read('validations/official-2021/dcs_1p000e03.dat');
  const cmp = compareDcs(dcs, ref);
  assert(cmp.ok, `DCS comparison failed: ${cmp.error || `max rel diff ${cmp.maxRel}`}`);
});

// ==========================================
// 3. Nuclear Overrides (NUCRAD, NUCSKN, ATWGHT)
// ==========================================

await check('nuclear overrides: NUCRAD 7.0 and NUCSKN 0.7 for Au Fermi model at 100 keV', async () => {
  const defaultDeck = [
    'IZ      79',
    'MNUCL   3',
    'MELEC   4',
    'IELEC  -1',
    'MEXCH   1',
    'MCPOL   0',
    'MABS    0',
    'IHEF    1',
    'EV      1.000E5',
    '',
  ].join('\n');
  const defaultFiles = await runWasm('atomic', defaultDeck);
  const defaultDcs = Object.values(defaultFiles)[0];

  const overrideDeck = [
    'IZ      79',
    'MNUCL   3',
    'MELEC   4',
    'IELEC  -1',
    'MEXCH   1',
    'MCPOL   0',
    'MABS    0',
    'IHEF    1',
    'NUCRAD  7.0',
    'NUCSKN  0.7',
    'EV      1.000E5',
    '',
  ].join('\n');
  const overrideFiles = await runWasm('atomic', overrideDeck);
  const overrideDcs = Object.values(overrideFiles)[0];
  assert(overrideDcs, 'no override DCS output generated');

  assert(
    /Average radius =\s*7\.00000E-13\s*cm/.test(overrideDcs),
    'Average radius was not printed as 7.00000E-13 cm'
  );
  assert(
    /Skin thickness =\s*7\.00000E-14\s*cm/.test(overrideDcs),
    'Skin thickness was not printed as 7.00000E-14 cm'
  );
  assert(
    overrideDcs.includes('Nuclear parameters overridden by the user (ELSEPA extension)'),
    'override header notification line is missing from DCS output'
  );

  // Assert DCS differs from default run
  const defaultVals = values(defaultDcs);
  const overrideVals = values(overrideDcs);
  let differs = false;
  for (let i = 0; i < Math.min(defaultVals.length, overrideVals.length); i++) {
    if (Math.abs(defaultVals[i].value - overrideVals[i].value) > 1e-4) {
      differs = true;
      break;
    }
  }
  assert(differs, 'override DCS did not differ from default DCS');
});

await check('nuclear overrides: ATWGHT 250 updates atomic weight and nuclear radius', async () => {
  const deck = [
    'IZ      79',
    'MNUCL   3',
    'MELEC   4',
    'IELEC  -1',
    'MEXCH   1',
    'MCPOL   0',
    'MABS    0',
    'IHEF    1',
    'ATWGHT  250.0',
    'EV      1.000E5',
    '',
  ].join('\n');
  const files = await runWasm('atomic', deck);
  const dcs = Object.values(files)[0];
  assert(dcs, 'no DCS file produced');

  assert(
    /atomic weight =\s*2\.50000E\+02\s*g\/mol/.test(dcs),
    'atomic weight was not overridden to 2.50000E+02 g/mol'
  );

  // Expected radius for Fermi: 1.07 * 250^(1/3) fm = 1.07 * 6.299605 * 1e-13 cm = 6.74058E-13 cm
  const mRad = dcs.match(/Average radius =\s*([0-9.+-EedD]+)\s*cm/);
  assert(mRad, 'Average radius not found');
  const rad = parseFloat(mRad[1]);
  assert(Math.abs(rad - 6.74058e-13) / 6.74058e-13 < 1e-4, `Average radius ${rad} vs expected 6.74058e-13`);

  assert(
    dcs.includes('Nuclear parameters overridden by the user (ELSEPA extension)'),
    'override header notification line is missing'
  );
});

// ==========================================
// 4. Negative Ions (Anions: Cl- and O-)
// ==========================================

const anions: Array<{ name: string; z: number; nelec: number; melec: number; densityName: string }> = [
  { name: 'Cl-', z: 17, nelec: 18, melec: 4, densityName: 'Dirac-Fock' },
  { name: 'Cl-', z: 17, nelec: 18, melec: 3, densityName: 'DHFS' },
  { name: 'O-', z: 8, nelec: 9, melec: 4, densityName: 'Dirac-Fock' },
  { name: 'O-', z: 8, nelec: 9, melec: 3, densityName: 'DHFS' },
];

for (const { name, z, nelec, melec, densityName } of anions) {
  await check(`anion: ${name} (Z=${z}, NELEC=${nelec}, ${densityName}) at 1 keV completes with finite cross section`, async () => {
    const deck = [
      `IZ      ${z}`,
      `NELEC   ${nelec}`,
      'MNUCL   3',
      `MELEC   ${melec}`,
      'IELEC  -1',
      'MEXCH   1',
      'MCPOL   0',
      'MABS    0',
      'IHEF    1',
      'EV      1.000E3',
      '',
    ].join('\n');
    const files = await runWasm('atomic', deck);
    const dcs = Object.values(files)[0];
    assert(dcs, `no DCS file produced for ${name} (${densityName})`);

    const m = dcs.match(/Total elastic cross section =.*?=\s*([0-9.+-EedD]+)\s*a0\*\*2/);
    assert(m, `Total elastic cross section not found for ${name} (${densityName})`);
    const sigmaEl = parseFloat(m[1]);
    assert(Number.isFinite(sigmaEl) && sigmaEl > 0, `invalid sigma_el ${sigmaEl} for ${name} (${densityName})`);

    // Verify table has rows
    const tableVals = values(dcs);
    assert(tableVals.length > 50, `expected table rows, found only ${tableVals.length} values`);

    console.log(`      ${name} (${densityName}, 1 keV e-): sigma_el = ${sigmaEl.toFixed(5)} a0^2`);
  });
}

// ==========================================
// 5. Molecular Program ELSCATM
// ==========================================

await check('molecular: official ELSCATM H2O example still runs', async () => {
  const files = await runWasm('molecular', read('wasm/tests/official_h2o.in'));
  const dcs = files['dcs_5p000e02.dat'];
  assert(dcs, 'dcs_5p000e02.dat was not produced by ELSCATM');
  const m = dcs.match(/total cs:\s*([0-9.+-EedD]+)/i);
  assert(m, 'Total cross section not found in ELSCATM output');
  const cs = parseFloat(m[1]);
  assert(Number.isFinite(cs) && cs > 0, `invalid cross section ${cs}`);
  console.log(`      H2O (ELSCATM, 500 eV e-): coherent total cs = ${cs.toExponential(5)} cm^2`);
});

// ==========================================
// 6. Deck Snapshots & Keyword Overrides
// ==========================================

await check('deck snapshots unchanged without overrides', () => {
  const expectedBase = 'IZ     79\nMNUCL  3\nNELEC  79\nMELEC  4\nMUFFIN 0\nRMUF   0\nIELEC  -1\nMEXCH  1\nMCPOL  0\nVPOLA  0.00000e+0\nVPOLB  -1\nMABS   0\nVABSA  -1\nVABSD  -1.0\nIHEF   2\nEV     1.00000e+3\n';
  const expectedT18 = 'IZ     79\nMNUCL  3\nNELEC  79\nMELEC  4\nMUFFIN 0\nRMUF   0\nIELEC  -1\nMEXCH  1\nMCPOL  1\nVPOLA  5.33465e-24\nVPOLB  -1\nMABS   0\nVABSA  -1\nVABSD  -1.0\nIHEF   2\nEV     1.00000e+3\n';

  assert(buildAtomicInput(base) === expectedBase, 'base deck differs from captured snapshot');
  assert(
    buildAtomicInput({ ...base, polarizationModel: 'buckingham', polarizability: 36 }) === expectedT18,
    'T18 deck differs from captured snapshot'
  );
});

await check('overrides emit ATWGHT, NUCRAD, NUCSKN, VPOLB before EV', () => {
  const deck = buildAtomicInput({
    ...base,
    atomicWeightOverride: 200.5,
    nuclearRadiusFm: 7.15,
    nuclearSkinFm: 0.62,
    polarizationModel: 'buckingham',
    polarizability: 36,
    polarizationCutoffA0: 2.0,
  });

  assert(deck.includes('ATWGHT 200.5'), 'missing ATWGHT');
  assert(deck.includes('NUCRAD 7.15'), 'missing NUCRAD');
  assert(deck.includes('NUCSKN 0.62'), 'missing NUCSKN');
  assert(deck.includes('VPOLB'), 'missing VPOLB');
  assert(!deck.includes('VPOLB  -1'), 'VPOLB not mapped');

  const idxAt = deck.indexOf('ATWGHT');
  const idxRad = deck.indexOf('NUCRAD');
  const idxSkn = deck.indexOf('NUCSKN');
  const idxEv = deck.indexOf('EV');
  assert(idxAt < idxEv && idxRad < idxEv && idxSkn < idxEv, 'override keywords must appear before EV');
});

await check('r_c mapping: Au e- 1 keV Buckingham alpha 36 with polarizationCutoffA0 = 2.0 runs in WebAssembly and Bpol matches formula', async () => {
  const deck = buildAtomicInput({
    ...base,
    polarizationModel: 'buckingham',
    polarizability: 36,
    polarizationCutoffA0: 2.0,
  });
  const files = await runWasm('atomic', deck);
  const dcs = Object.values(files)[0];
  assert(dcs, 'no DCS produced');
  const m = dcs.match(/Bpol =\s*([0-9.+-EedD]+)/);
  assert(m, 'Bpol not found in DCS output');
  const bpolActual = parseFloat(m[1]);
  const bpolExpected = Math.pow(2.0, 2) * Math.sqrt((2 * Math.pow(79, 1 / 3)) / 36);
  const relDiff = Math.abs(bpolActual - bpolExpected) / bpolExpected;
  assert(relDiff < 1e-4, `Bpol ${bpolActual} vs expected ${bpolExpected} (rel diff ${relDiff})`);
});

await check('negative q builds NELEC = Z - q', () => {
  const anionDeck = buildAtomicInput({ ...base, z: 17, ionCharge: -2 });
  assert(anionDeck.includes('NELEC  19'), 'expected NELEC 19 for Z=17, q=-2');

  const cationDeck = buildAtomicInput({ ...base, z: 17, ionCharge: 2 });
  assert(cationDeck.includes('NELEC  15'), 'expected NELEC 15 for Z=17, q=2');
});

await check('elsepaDefaultNuclear for Au Fermi matches ELSEPA printed Average radius', () => {
  const def = elsepaDefaultNuclear(79, 'fermi');
  assert(def.radiusFm !== null, 'radiusFm is null');
  const expectedRadiusFm = 1.07 * Math.pow(ELAW[78], 1 / 3);
  assert(Math.abs(def.radiusFm - expectedRadiusFm) < 1e-9, `radius ${def.radiusFm} vs expected ${expectedRadiusFm}`);
  // ELSEPA prints Average radius = 6.22555E-13 cm = 6.22555 fm
  const printedCm = 6.22555e-13;
  const defCm = def.radiusFm * 1e-13;
  const relDiff = Math.abs(defCm - printedCm) / printedCm;
  assert(relDiff < 1e-4, `Average radius in cm ${defCm} vs printed ${printedCm}`);
});

await check('angularGrid: validation, resampling, and partial cross section', async () => {
  // Invalid grids rejected
  assert(validateAngularGrid(-1, 100, 1) !== null, 'accepted negative minAngle');
  assert(validateAngularGrid(100, 50, 1) !== null, 'accepted min >= max');
  assert(validateAngularGrid(0, 180, 0) !== null, 'accepted step <= 0');
  assert(validateAngularGrid(0, 180, 0.005) !== null, 'accepted > 10,000 points');
  assert(validateAngularGrid(0, 180, 1) === null, 'rejected valid grid');

  // Run base to get ELSEPA's own output
  const files = await runWasm('atomic', buildAtomicInput(base));
  const parsed = parseAtomicOutputs(base, files, buildAtomicInput(base), 0);
  assert(parsed, 'failed to parse base output');
  const data = parsed.scatteringData;
  assert(data.length > 50, 'not enough data points');

  // Resampling at ELSEPA grid points reproduces the values
  for (const idx of [5, 20, 50, 80]) {
    const orig = data[idx];
    const resampled = interpolatePoint(data, orig.angleDeg);
    assert(Math.abs(resampled.dcsAu - orig.dcsAu) < 1e-7, `DCS at ${orig.angleDeg}° differs: ${resampled.dcsAu} vs ${orig.dcsAu}`);
    assert(Math.abs(resampled.shermanS - orig.shermanS) < 1e-7, `Sherman at ${orig.angleDeg}° differs: ${resampled.shermanS} vs ${orig.shermanS}`);
  }

  // Full-range partial cross section equals total elastic cross section within 1e-3
  const partialSigma = integratePartialCrossSection(data, 0, 180);
  const totalSigma = parsed.summary.sigmaElAu;
  assert(Math.abs(partialSigma - totalSigma) < 1e-3, `partial sigma ${partialSigma} vs total ${totalSigma}`);

  // When customAngularGrid is enabled in parseAtomicOutputs, sigmaElRangeAu is exposed
  const customParsed = parseAtomicOutputs(
    { ...base, customAngularGrid: true, minAngle: 10, maxAngle: 170, angleStep: 2 },
    files,
    buildAtomicInput(base),
    0
  );
  assert(customParsed?.summary.sigmaElRangeAu !== undefined, 'sigmaElRangeAu missing when customAngularGrid is true');
  assert(customParsed.scatteringData.length === 81, `expected 81 points for [10, 170] step 2, got ${customParsed.scatteringData.length}`);
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
