// Density editor tests: pure numerical tools, file parsing/serialization,
// WebAssembly esfield/scfield reader, and MELEC 4 vs MELEC 5 round-trip parity.
// Runs without gfortran using WebAssembly.
//
//   npx tsx wasm/density.test.ts
//
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT, base, runWasm } from './harness';
import { parseDensityFile, checkCustomDensity, parseEsfield, MAX_DENSITY_POINTS, MIN_DENSITY_POINTS } from '../src/physics/densityFile';
import {
  DensityPoint,
  integrateDensity,
  normalizeDensity,
  ionizeDensity,
  radialScaleDensity,
  truncateDensity,
  smoothDensity,
  mixDensities,
  dragEditDensity,
  formatDensityForElsepa,
  parseTextToDensityPoints,
  calculateDensityStats,
} from '../src/physics/densityTools';
import { buildAtomicInput, parseAtomicOutputs } from '../src/physics/elsepaFortranIO';

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

const goldRaw = fs.readFileSync(path.join(ROOT, 'data', 'z_079.den'), 'latin1');

// ==========================================
// 1. Integration of data/z_079.den (~79.006)
// ==========================================

await check('density: integration of data/z_079.den gives ~79.006', () => {
  const { points, errors, electrons } = parseTextToDensityPoints(goldRaw);
  assert(errors.length === 0, `errors: ${errors.join('; ')}`);
  assert(points.length === 777, `expected 777 points, got ${points.length}`);
  const integrated = integrateDensity(points);
  assert(
    Math.abs(integrated - 79.006) < 0.005,
    `expected integrated electrons ~79.006, got ${integrated.toFixed(4)}`
  );
  assert(
    Math.abs(electrons - 79.006) < 0.005,
    `expected parsed electrons ~79.006, got ${electrons.toFixed(4)}`
  );
});

// ==========================================
// 2. Normalize gives exactly target N (rel 1e-9)
// ==========================================

await check('density: normalize gives exactly target N (rel error < 1e-9)', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const targets = [79.0, 78.0, 10.5, 1.0];
  for (const targetN of targets) {
    const norm = normalizeDensity(points, targetN);
    const n = integrateDensity(norm);
    const relErr = Math.abs(n - targetN) / targetN;
    assert(
      relErr < 1e-9,
      `target ${targetN}: expected rel error < 1e-9, got ${relErr.toExponential(4)} (n=${n})`
    );
  }
});

// ==========================================
// 3. Radial scale keeps N within 1e-3
// ==========================================

await check('density: radial scale keeps N within 1e-3', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const nOrig = integrateDensity(points);
  const scaleFactors = [0.8, 0.95, 1.05, 1.25, 1.5];
  for (const s of scaleFactors) {
    const scaled = radialScaleDensity(points, s);
    assert(scaled.length === points.length, 'grid length preserved');
    const nScaled = integrateDensity(scaled);
    const relErr = Math.abs(nScaled - nOrig) / nOrig;
    assert(
      relErr < 1e-3,
      `scale ${s}: expected rel error < 1e-3, got ${relErr.toExponential(4)} (orig=${nOrig}, scaled=${nScaled})`
    );
    assert(scaled.every((p) => p.rho > 0 && p.r > 0), 'all rho and r positive');
  }
});

// ==========================================
// 4. Ionize removes q within 1e-3 and keeps rho > 0
// ==========================================

await check('density: ionize removes q within 1e-3 and keeps rho > 0', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const nOrig = integrateDensity(points);
  for (const q of [1, 2, 3]) {
    const ionized = ionizeDensity(points, q);
    const nIon = integrateDensity(ionized);
    const expected = nOrig - q;
    const relErr = Math.abs(nIon - expected) / expected;
    assert(
      relErr < 1e-3,
      `ionize q=${q}: expected ${expected.toFixed(4)}, got ${nIon.toFixed(4)} (relErr=${relErr.toExponential(4)})`
    );
    assert(ionized.every((p) => p.rho > 0 && Number.isFinite(p.rho)), 'all rho > 0 and finite');
    // Valence electrons attenuated more than core electrons
    const coreRatio = ionized[0].rho / points[0].rho;
    const outerRatio = ionized[ionized.length - 1].rho / points[points.length - 1].rho;
    assert(Math.abs(coreRatio - 1) < 1e-4, `core electrons preserved (ratio=${coreRatio})`);
    assert(outerRatio < 0.1, `valence electrons attenuated (ratio=${outerRatio})`);
  }
});

// ==========================================
// 5. Truncate / smooth / mix keep rho > 0 and grid increasing
// ==========================================

await check('density: ionize with negative q adds |q| electrons in the outer region', () => {
  const pts = parseTextToDensityPoints(fs.readFileSync(path.join(ROOT, 'data', 'z_017.den'), 'latin1')).points;
  const n0 = integrateDensity(pts);
  const anion = ionizeDensity(pts, -1);
  const n1 = integrateDensity(anion);
  assert(Math.abs(n1 - n0 - 1) < 1e-9, `added ${n1 - n0}, expected 1`);
  assert(anion.every((p) => p.rho > 0 && Number.isFinite(p.rho)), 'non-positive density');
  assert(Math.abs(anion[0].rho / pts[0].rho - 1) < 1e-6, 'core density changed');
});

await check('density: truncate, smooth, mix keep rho > 0 and grid strictly increasing', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const isStrictlyIncreasing = (pts: DensityPoint[]) =>
    pts.every((p, i) => i === 0 || p.r > pts[i - 1].r);

  // Truncate
  const truncated = truncateDensity(points, 10.0);
  assert(truncated.every((p) => p.rho > 0), 'truncate: all rho > 0');
  assert(isStrictlyIncreasing(truncated), 'truncate: r strictly increasing');
  assert(truncated.length === points.length, 'truncate: preserves grid count');

  // Smooth
  for (const k of [3, 5, 7]) {
    const smoothed = smoothDensity(points, k);
    assert(smoothed.every((p) => p.rho > 0), `smooth k=${k}: all rho > 0`);
    assert(isStrictlyIncreasing(smoothed), `smooth k=${k}: r strictly increasing`);
    assert(smoothed.length === points.length, `smooth k=${k}: preserves grid count`);
  }

  // Mix
  const arRaw = fs.readFileSync(path.join(ROOT, 'data', 'z_018.den'), 'latin1');
  const arPts = parseTextToDensityPoints(arRaw).points;
  for (const w of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    const mixed = mixDensities(points, arPts, w);
    assert(mixed.every((p) => p.rho > 0), `mix w=${w}: all rho > 0`);
    assert(isStrictlyIncreasing(mixed), `mix w=${w}: r strictly increasing`);
  }
});

// ==========================================
// 6. Drag edit changes only the neighbourhood
// ==========================================

await check('density: drag edit changes only the neighbourhood around centerR', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const centerR = 1.0;
  const deltaLog = 0.5;
  const sigma = 0.4;
  const edited = dragEditDensity(points, centerR, deltaLog, sigma);

  assert(edited.length === points.length, 'length preserved');
  assert(edited.every((p) => p.rho > 0), 'all rho > 0');

  // Near centerR: density changed substantially
  const nearPoint = edited.reduce((best, p) =>
    Math.abs(p.r - centerR) < Math.abs(best.r - centerR) ? p : best
  );
  const origNearPoint = points.find((p) => p.r === nearPoint.r)!;
  const ratioNear = nearPoint.rho / origNearPoint.rho;
  assert(Math.abs(ratioNear - Math.exp(deltaLog)) < 0.1, `peak modified (ratio=${ratioNear})`);

  // Far from centerR: density virtually identical (within 0.1%)
  const farPoints = edited.filter((p) => Math.abs(Math.log(p.r / centerR)) > 3.5 * sigma);
  assert(farPoints.length > 50, 'far points exist');
  for (const fp of farPoints) {
    const orig = points.find((p) => p.r === fp.r)!;
    const relDiff = Math.abs(fp.rho - orig.rho) / orig.rho;
    assert(relDiff < 1e-3, `far point at r=${fp.r} unchanged (relDiff=${relDiff})`);
  }
});

// ==========================================
// 7. Serialize -> parseDensityFile round trip has no errors and passes checkCustomDensity
// ==========================================

await check('density: serialize -> parseDensityFile round trip has no errors and passes checkCustomDensity', () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const normPoints = normalizeDensity(points, 79);
  const serialized = formatDensityForElsepa(normPoints, {
    z: 79,
    q: 0,
    nelec: 79,
    element: 'Gold',
    source: 'unit test',
    edits: ['normalize to 79'],
  });

  const parsed = parseDensityFile(serialized, 'roundtrip.den');
  assert(parsed.errors.length === 0, `round trip errors: ${parsed.errors.join('; ')}`);
  assert(parsed.points === points.length, `points count matched: ${parsed.points}`);
  assert(Math.abs(parsed.electrons - 79) < 1e-6, `electrons matched: ${parsed.electrons}`);

  const checkRes = checkCustomDensity({
    densityModel: 'custom-file',
    customDensityData: serialized,
    customDensityName: 'roundtrip.den',
  });
  assert(!checkRes.error, `checkCustomDensity returned error: ${checkRes.error}`);
  assert(!!checkRes.data && checkRes.data.startsWith(' #'), 'valid data returned');
});

// ==========================================
// 8. esfield.dat reader gives N = NELEC (within 1e-3) for Au MELEC 4 and Au+ MELEC 3
// ==========================================

await check('density: esfield.dat reader gives N = NELEC (within 1e-3) for Au MELEC 4 and Au+ MELEC 3', async () => {
  // Case A: Au (Z=79, neutral) MELEC 4
  const auInput = buildAtomicInput({
    ...base,
    z: 79,
    ionCharge: 0,
    densityModel: 'dirac-fock',
    energyEv: 100,
    minAngle: 0,
    maxAngle: 180,
    angleStep: 90,
    absorptionModel: 'none',
    polarizationModel: 'none',
  });
  const auFiles = await runWasm('atomic', auInput, true);
  const auPts = parseEsfield(auFiles);
  assert(auPts.length > 50, `expected >50 points from au field, got ${auPts.length}`);
  const auN = integrateDensity(auPts);
  const auRelErr = Math.abs(auN - 79) / 79;
  assert(
    auRelErr < 1e-3,
    `Au MELEC 4: expected N=79 within 1e-3, got ${auN.toFixed(4)} (relErr=${auRelErr.toExponential(4)})`
  );

  // Case B: Au+ (Z=79, q=1, NELEC=78) MELEC 3 (DHFS)
  const auPlusInput = buildAtomicInput({
    ...base,
    z: 79,
    ionCharge: 1,
    densityModel: 'dhfs',
    energyEv: 100,
    minAngle: 0,
    maxAngle: 180,
    angleStep: 90,
    absorptionModel: 'none',
    polarizationModel: 'none',
  });
  const auPlusFiles = await runWasm('atomic', auPlusInput, true);
  const auPlusPts = parseEsfield(auPlusFiles);
  assert(auPlusPts.length > 50, `expected >50 points from au+ field, got ${auPlusPts.length}`);
  const auPlusN = integrateDensity(auPlusPts);
  const auPlusRelErr = Math.abs(auPlusN - 78) / 78;
  assert(
    auPlusRelErr < 1e-3,
    `Au+ MELEC 3: expected N=78 within 1e-3, got ${auPlusN.toFixed(4)} (relErr=${auPlusRelErr.toExponential(4)})`
  );
});

// ==========================================
// 9. WebAssembly run with Au DF table round-tripped through editor gives same DCS / totCS as MELEC 4 within 1e-4
// ==========================================

await check('density: round-tripped Au DF table reproduces MELEC 4 total cross section within 1e-4', async () => {
  const { points } = parseTextToDensityPoints(goldRaw);
  const normPoints = normalizeDensity(points, 79);
  const serialized = formatDensityForElsepa(normPoints, {
    z: 79,
    q: 0,
    nelec: 79,
    element: 'Gold',
    source: 'DF table normalized',
  });

  // Run 1: MELEC 4 (Dirac-Fock table from /database/z_079.den)
  const melec4Input = buildAtomicInput({ ...base, z: 79, densityModel: 'dirac-fock' });
  const melec4Files = await runWasm('atomic', melec4Input, true);
  const melec4Res = parseAtomicOutputs(base, melec4Files, '', 0);
  assert(melec4Res, 'MELEC 4 failed to parse');
  const melec4Tot = melec4Res.summary.sigmaElAu;

  // Run 2: MELEC 5 (custom-file using serialized density.usr)
  const melec5Input = buildAtomicInput({
    ...base,
    z: 79,
    densityModel: 'custom-file',
    customDensityData: serialized,
    customDensityName: 'z_079_edited.den',
  });
  const melec5Files = await runWasm('atomic', melec5Input, true, { 'density.usr': serialized });
  const melec5Res = parseAtomicOutputs(base, melec5Files, '', 0);
  assert(melec5Res, 'MELEC 5 failed to parse');
  const melec5Tot = melec5Res.summary.sigmaElAu;

  const relDiff = Math.abs(melec4Tot - melec5Tot) / melec4Tot;
  assert(
    relDiff < 1e-4,
    `expected MELEC 4 (${melec4Tot}) and MELEC 5 (${melec5Tot}) to match within 1e-4, got relDiff=${relDiff.toExponential(4)}`
  );
});

// ==========================================
// 10. Bounds & limits audit: ELSEPA 2021 reads at most NDIN - 1 = 999 points
// ==========================================

await check('density: limits 999 points and MIN_DENSITY_POINTS = 5', () => {
  assert(MAX_DENSITY_POINTS === 999, `MAX_DENSITY_POINTS should be 999, got ${MAX_DENSITY_POINTS}`);
  assert(MIN_DENSITY_POINTS === 5, `MIN_DENSITY_POINTS should be 5, got ${MIN_DENSITY_POINTS}`);
});

// The limit is checked on the real engine: a 999-point density runs, a 1000-point one makes ELSEPA stop.
await check('density: ELSEPA 2021 accepts 999 density points and rejects 1000', async () => {
  const table = (n: number) => {
    // Au-like density, rho = A exp(-r/a) on a log grid, normalized to 79 electrons by the trapezoid rule.
    const r = Array.from({ length: n }, (_, i) => 1e-5 * Math.pow(50 / 1e-5, i / (n - 1)));
    const raw = r.map((x) => Math.exp(-x / 0.3));
    let sum = 0;
    for (let i = 0; i < n - 1; i++) sum += 0.5 * (raw[i] * r[i] ** 2 + raw[i + 1] * r[i + 1] ** 2) * (r[i + 1] - r[i]);
    const scale = 79 / (4 * Math.PI * sum);
    const rows = r.map((x, i) => ` ${x.toExponential(8)}  ${(raw[i] * scale).toExponential(8)}`);
    return [' # test', ' # test', ' #  R  RHO', ...rows, ''].join(String.fromCharCode(10));
  };
  const deck = (text: string) => buildAtomicInput({ ...base, densityModel: 'custom-file', customDensityData: text });
  // On "File is too large" ELSEPA stops after writing only the header of the DCS file.
  const complete = (files: Record<string, string>) =>
    Object.entries(files).some(([f, text]) => f.startsWith('dcs_') && text.includes('Total elastic cross section'));
  const ok = await runWasm('atomic', deck(table(999)), false, { 'density.usr': table(999) });
  assert(complete(ok), '999 points: no complete DCS output');
  const tooMany = await runWasm('atomic', deck(table(1000)), false, { 'density.usr': table(1000) });
  assert(!complete(tooMany), '1000 points: ELSEPA produced a complete DCS');
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll density checks passed');
process.exit(failures ? 1 : 0);
