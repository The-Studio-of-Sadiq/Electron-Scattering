// Features test: tests custom energy grid and user-supplied electron density (MELEC 5).
// Runs without gfortran using WebAssembly.
//
//   npx tsx wasm/features.test.ts
//
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAtomicInput, parseAtomicOutputs, toSweepPoint } from '../src/physics/elsepaFortranIO';
import {
  DEFAULT_SWEEP_ENERGIES,
  logGrid,
  parseEnergyList,
  validateEnergies,
} from '../src/physics/energyGrid';
import {
  parseDensityFile,
  checkElectronCountWarning,
  checkCustomDensity,
} from '../src/physics/densityFile';
import { base, runWasm, ROOT } from './harness';

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

// ==========================================
// A. Energy Grid Tests
// ==========================================

await check('energyGrid: default list has 16 energies and passes validation', () => {
  assert(DEFAULT_SWEEP_ENERGIES.length === 16, `expected 16 energies, got ${DEFAULT_SWEEP_ENERGIES.length}`);
  assert(DEFAULT_SWEEP_ENERGIES[0] === 10, 'first energy is 10 eV');
  assert(DEFAULT_SWEEP_ENERGIES[15] === 1000000, 'last energy is 1 MeV');

  const { energies, errors } = validateEnergies(DEFAULT_SWEEP_ENERGIES);
  assert(errors.length === 0, `unexpected errors: ${errors.join(', ')}`);
  assert(energies.length === 16, `expected 16 validated energies, got ${energies.length}`);
});

await check('energyGrid: logGrid generates correct endpoints and count', () => {
  const g1 = logGrid(10, 1000000, 16);
  assert(g1.length === 16, `expected 16 points, got ${g1.length}`);
  assert(g1[0] === 10, `expected start 10, got ${g1[0]}`);
  assert(g1[15] === 1000000, `expected end 1000000, got ${g1[15]}`);

  const g2 = logGrid(100, 10000, 3);
  assert(g2.length === 3, `expected 3 points, got ${g2.length}`);
  assert(g2[0] === 100, `expected 100, got ${g2[0]}`);
  assert(g2[1] === 1000, `expected 1000, got ${g2[1]}`);
  assert(g2[2] === 10000, `expected 10000, got ${g2[2]}`);

  const g3 = logGrid(500, 500, 1);
  assert(g3.length === 1 && g3[0] === 500, 'single point grid');
});

await check('energyGrid: parseEnergyList handles commas, spaces, semicolons, newlines, and 1e3/1E3', () => {
  const text = '10, 20.5  50;100\n200\t1e3 2.5E4; 1e6';
  const list = parseEnergyList(text);
  assert(list.length === 8, `expected 8 numbers, got ${list.length}`);
  assert(list[0] === 10, 'val 0');
  assert(list[1] === 20.5, 'val 1');
  assert(list[2] === 50, 'val 2');
  assert(list[3] === 100, 'val 3');
  assert(list[4] === 200, 'val 4');
  assert(list[5] === 1000, 'val 5');
  assert(list[6] === 25000, 'val 6');
  assert(list[7] === 1000000, 'val 7');
});

await check('energyGrid: validateEnergies sorts ascending and deduplicates', () => {
  const input = [5000, 100, 5000, 20, 100, 1000];
  const { energies, errors } = validateEnergies(input);
  assert(errors.length === 0, `unexpected errors: ${errors.join(', ')}`);
  assert(energies.length === 4, `expected 4 unique energies, got ${energies.length}`);
  assert(energies[0] === 20 && energies[1] === 100 && energies[2] === 1000 && energies[3] === 5000, 'sorted');
});

await check('energyGrid: validateEnergies flags every limit error', () => {
  // 1. Empty list
  const empty = validateEnergies([]);
  assert(empty.errors.some((e) => /at least 1/i.test(e)), 'empty list error');

  // 2. Below minimum (< 10 eV)
  const low = validateEnergies([9.9]);
  assert(low.errors.some((e) => /below the minimum limit/i.test(e)), 'below minimum error');

  // 3. Above maximum (> 1e9 eV)
  const high = validateEnergies([1.01e9]);
  assert(high.errors.some((e) => /exceeds the maximum limit/i.test(e)), 'above maximum error');

  // 4. Non-finite value
  const nanVal = validateEnergies([NaN, 100]);
  assert(nanVal.errors.some((e) => /finite number/i.test(e)), 'non-finite error');

  // 5. Exceeding 100 points
  const tooMany = Array.from({ length: 101 }, (_, i) => 10 + i * 10);
  const maxErr = validateEnergies(tooMany);
  assert(maxErr.errors.some((e) => /maximum allowed is 100/i.test(e)), 'too many points error');
});

// ==========================================
// B. Density File Tests
// ==========================================

const goldDenPath = path.join(ROOT, 'data', 'z_079.den');
const goldDenRaw = fs.readFileSync(goldDenPath, 'utf8');

await check('densityFile: z_079.den parses to 777 points with electrons within 0.01 of 79.006', () => {
  const res = parseDensityFile(goldDenRaw, 'z_079.den');
  assert(res.errors.length === 0, `unexpected errors: ${res.errors.join(', ')}`);
  assert(res.points === 777, `expected 777 points, got ${res.points}`);
  assert(Math.abs(res.electrons - 79.006) < 0.01, `electrons ${res.electrons} vs 79.006`);

  // Warning check: Gold neutral NELEC = 79
  const warning = checkElectronCountWarning(res.electrons, 79);
  assert(warning === null, `expected no warning for gold, got "${warning}"`);

  // Warning check when off by > 1%
  const badWarning = checkElectronCountWarning(75, 79);
  assert(badWarning !== null && badWarning.includes('>1% tolerance'), 'expected warning for off-count');
});

await check('densityFile: header/comment handling and normalized output format', () => {
  const customText = `
# Comment line 1
# Comment line 2

1.0e-4 100.0
2.0e-4 90.0
# mid-comment
3.0e-4 80.0
4.0e-4 70.0
5.0e-4 60.0
`;
  const res = parseDensityFile(customText, 'custom.den');
  assert(res.errors.length === 0, `unexpected errors: ${res.errors.join(', ')}`);
  assert(res.points === 5, `expected 5 points, got ${res.points}`);

  const lines = res.normalized.split(/\r?\n/).filter((l) => l.length > 0);
  assert(lines.length === 8, `expected 8 lines (3 headers + 5 data), got ${lines.length}`);
  assert(lines[0].startsWith(' #'), 'header line 1 starts with " #"');
  assert(lines[1].startsWith(' #') && lines[1].includes('custom.den'), 'header line 2 contains source file');
  assert(lines[2].startsWith(' #'), 'header line 3 starts with " #"');
  assert(!lines[3].startsWith('#'), 'data line 1 is not a comment');
});

await check('densityFile: accepts Fortran D exponents', () => {
  const text = `
1.0D-04 1.5D+02
2.0D-04 1.4D+02
3.0D-04 1.3D+02
4.0D-04 1.2D+02
5.0D-04 1.1D+02
`;
  const res = parseDensityFile(text, 'test.den');
  assert(res.errors.length === 0, `unexpected errors: ${res.errors.join(', ')}`);
  assert(res.points === 5, `points = ${res.points}`);
  assert(res.electrons > 0, `electrons = ${res.electrons}`);
});

await check('densityFile: flags each validation error', () => {
  // 1. Empty file
  assert(parseDensityFile('').errors.length > 0, 'empty file');

  // 2. Fewer than 5 points
  const few = '1e-4 10\n2e-4 9\n3e-4 8\n4e-4 7';
  assert(parseDensityFile(few).errors.some((e) => /at least 5/i.test(e)), 'fewer than 5 points');

  // 3. Radius not strictly positive
  const negR = '0.0 10\n2e-4 9\n3e-4 8\n4e-4 7\n5e-4 6';
  assert(parseDensityFile(negR).errors.some((e) => /strictly positive/i.test(e)), 'r <= 0');

  // 4. Radius not strictly increasing
  const decR = '1e-4 10\n1e-4 9\n3e-4 8\n4e-4 7\n5e-4 6';
  assert(parseDensityFile(decR).errors.some((e) => /strictly increasing/i.test(e)), 'r decreasing');

  // 5. Density not strictly positive (rho <= 0)
  const negRho = '1e-4 10\n2e-4 0\n3e-4 8\n4e-4 7\n5e-4 6';
  assert(parseDensityFile(negRho).errors.some((e) => /density rho must be strictly positive/i.test(e)), 'rho <= 0');

  // 6. Non-finite values
  const badNum = '1e-4 abc\n2e-4 9\n3e-4 8\n4e-4 7\n5e-4 6';
  assert(parseDensityFile(badNum).errors.some((e) => /finite numbers/i.test(e)), 'non-finite');
});

// ==========================================
// C. buildAtomicInput tests
// ==========================================

await check('buildAtomicInput: emits MELEC 5 for custom-file and throws without data', () => {
  const parsed = parseDensityFile(goldDenRaw, 'z_079.den');
  const deck = buildAtomicInput({
    ...base,
    densityModel: 'custom-file',
    customDensityData: parsed.normalized,
  });
  assert(/MELEC\s+5\b/.test(deck), `deck does not contain MELEC 5:\n${deck}`);

  let threwWithoutData = false;
  try {
    buildAtomicInput({ ...base, densityModel: 'custom-file' });
  } catch (err: any) {
    threwWithoutData = true;
    assert(/custom.*density/i.test(err.message), `unexpected error: ${err.message}`);
  }
  assert(threwWithoutData, 'did not throw when customDensityData was missing');
});

// ==========================================
// D. WebAssembly parity: custom-file vs dirac-fock
// ==========================================

await check('wasm run of base with custom-file (z_079.den) matches dirac-fock numbers exactly', async () => {
  const parsed = parseDensityFile(goldDenRaw, 'z_079.den');
  const customInput = buildAtomicInput({
    ...base,
    densityModel: 'custom-file',
    customDensityData: parsed.normalized,
  });

  // Run with custom-file density
  const customFiles = await runWasm('atomic', customInput, false, { 'density.usr': parsed.normalized });
  const customDcsKey = Object.keys(customFiles).find((f) => f.startsWith('dcs_'));
  assert(customDcsKey, 'no custom DCS output produced');
  const customDcs = customFiles[customDcsKey];

  // Run with default dirac-fock density
  const dfInput = buildAtomicInput(base);
  const dfFiles = await runWasm('atomic', dfInput);
  const dfDcsKey = Object.keys(dfFiles).find((f) => f.startsWith('dcs_'));
  assert(dfDcsKey, 'no dirac-fock DCS output produced');
  const dfDcs = dfFiles[dfDcsKey];

  // Extract numbers excluding lines starting with '#' that mention the density file
  const extractNumbers = (text: string) => {
    const nums: number[] = [];
    for (const line of text.replace(/\r/g, '').split('\n')) {
      const trimmed = line.trim();
      // Skip header lines that mention the density file name (e.g. z_079.den vs density.usr)
      if (trimmed.startsWith('#') && (trimmed.includes('Read from file') || trimmed.includes('.den') || trimmed.includes('.usr'))) {
        continue;
      }
      const matches = trimmed.match(NUMBER);
      if (matches) {
        for (const tok of matches) {
          nums.push(Number(tok.replace(/D/i, 'E')));
        }
      }
    }
    return nums;
  };

  const customNums = extractNumbers(customDcs);
  const dfNums = extractNumbers(dfDcs);

  assert(customNums.length > 100, `expected >100 numbers, got ${customNums.length}`);
  assert(customNums.length === dfNums.length, `number counts differ: ${customNums.length} vs ${dfNums.length}`);

  let differing = 0;
  for (let i = 0; i < customNums.length; i++) {
    if (customNums[i] !== dfNums[i]) {
      differing++;
    }
  }
  assert(differing === 0, `${differing} of ${customNums.length} numbers differed between custom-file and dirac-fock!`);
});

// ==========================================
// E. WebAssembly energy sweep
// ==========================================

await check('wasm sweep with energies [150, 750, 3000] returns 3 results in order', async () => {
  const sweepEnergies = [150, 750, 3000];
  const sweepResults = [];

  for (const energyEv of sweepEnergies) {
    const input = buildAtomicInput({ ...base, energyEv });
    const files = await runWasm('atomic', input);
    const result = parseAtomicOutputs({ ...base, energyEv }, files, input, 0);
    assert(result, `failed to parse output at ${energyEv} eV`);
    sweepResults.push(toSweepPoint(energyEv, result));
  }

  assert(sweepResults.length === 3, `expected 3 sweep results, got ${sweepResults.length}`);
  assert(sweepResults[0].energyEv === 150, `first energy is ${sweepResults[0].energyEv}`);
  assert(sweepResults[1].energyEv === 750, `second energy is ${sweepResults[1].energyEv}`);
  assert(sweepResults[2].energyEv === 3000, `third energy is ${sweepResults[2].energyEv}`);

  // Cross sections should be strictly positive
  for (const pt of sweepResults) {
    assert(pt.sigmaElAu > 0, `sigmaElAu for ${pt.energyEv} eV is ${pt.sigmaElAu}`);
  }
});

await check('densityFile: keeps the numbers exactly as written (no rounding before ELSEPA)', () => {
  const text = ['1.23456789012345E-04 9.87654321098765E+02', '2.0D-04 1.4D+02', '3e-4 130', '4.0E-04 1.2E+02', '5.0E-04 1.1E+02'].join('\n');
  const lines = parseDensityFile(text, 'precise.den').normalized.split('\n').filter((l) => l && !l.startsWith(' #'));
  assert(lines[0].trim() === '1.23456789012345E-04  9.87654321098765E+02', `line 1 = "${lines[0]}"`);
  assert(lines[1].trim() === '2.0E-04  1.4E+02', `D exponents become E: "${lines[1]}"`);
  assert(lines[2].trim() === '3e-4  130', `plain numbers kept: "${lines[2]}"`);
});

await check('checkCustomDensity: re-validates client data and ignores other models', () => {
  assert(!checkCustomDensity({ densityModel: 'dirac-fock' }).error, 'other models need no file');
  assert(!!checkCustomDensity({ densityModel: 'custom-file' }).error, 'missing data is rejected');
  assert(!!checkCustomDensity({ densityModel: 'custom-file', customDensityData: '1 2\n3 4' }).error, 'too few points rejected');
  const ok = checkCustomDensity({ densityModel: 'custom-file', customDensityData: fs.readFileSync(path.join(ROOT, 'data', 'z_079.den'), 'latin1') });
  assert(!ok.error && !!ok.data?.startsWith(' #'), 'valid file returns normalized text');
});

await check('energyGrid: logGrid rejects invalid arguments', () => {
  let threw = 0;
  for (const args of [[0, 100, 5], [100, 10, 5], [10, NaN, 5], [10, Infinity, 3]] as [number, number, number][]) {
    try { logGrid(...args); } catch { threw++; }
  }
  assert(threw === 4, `expected 4 errors, got ${threw}`);
  assert(logGrid(10, 100, 2.5).length === 0, 'non-integer point count gives no grid');
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
