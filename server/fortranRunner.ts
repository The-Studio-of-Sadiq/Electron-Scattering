import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ElsepaInputParams, SimulationResult, MolecularInputParams, MolecularSimulationResult, EnergySweepPoint } from '../src/types';

import { runDiracPartialWaveSimulation, runEnergySweep } from '../src/physics/elsepaPhysicsEngine';
import { runFallbackMolecularSimulation } from '../src/physics/molecularFallback';
import {
  FortranOutputFiles,
  buildAtomicInput,
  parseAtomicOutputs,
  buildMolecularInput,
  parseMolecularOutputs,
  toSweepPoint,
} from '../src/physics/elsepaFortranIO';

const wantsTypeScript = (params: any) => params?.forceEngine === 'typescript' || params?.forceEngine === 'ts';

// ELSEPA reports invalid input with a STOP message and writes no DCS file.
function elsepaFailure(err: any): Error {
  const detail = [err?.stdout, err?.stderr].map((x) => (x || '').toString().trim()).filter(Boolean).join('\n');
  const lastLines = detail.split('\n').slice(-3).join(' ').trim();
  return new Error(`ELSEPA produced no DCS table${lastLines ? `: ${lastLines}` : ''}`);
}

function readOutputFiles(dir: string): FortranOutputFiles {
  const files: FortranOutputFiles = {};
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.dat')) files[name] = fs.readFileSync(path.join(dir, name), 'utf-8');
  }
  return files;
}

let compiledBinaryPath: string | null = null;
let gfortranChecked = false;
let gfortranAvailable = false;

function checkGFortranAvailable(): boolean {
  if (gfortranChecked) return gfortranAvailable;
  try {
    execSync('gfortran --version', { stdio: 'ignore', timeout: 2000 });
    gfortranAvailable = true;
  } catch {
    gfortranAvailable = false;
  }
  gfortranChecked = true;
  return gfortranAvailable;
}

function checkAndCleanBinary(binaryPath: string): boolean {
  if (!fs.existsSync(binaryPath)) return false;

  try {
    fs.chmodSync(binaryPath, 0o755);
    execSync(`"${binaryPath}" < /dev/null`, {
      timeout: 1000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (e: any) {
    const stderr = (e.stderr || '').toString();
    const msg = (e.message || '').toString();
    const status = e.status;

    if (
      status === 126 ||
      status === 127 ||
      msg.includes('Exec format error') ||
      stderr.includes('Exec format error') ||
      e.code === 'ENOEXEC'
    ) {
      console.warn(`Binary ${binaryPath} cannot be executed on this architecture (Exec format error). Removing...`);
      try { fs.unlinkSync(binaryPath); } catch (_) {}
      return false;
    }

    if (status === 0 || status === 1 || status === 2) {
      return true;
    }

    try { fs.unlinkSync(binaryPath); } catch (_) {}
    return false;
  }
}

export function ensureFortranBinaryCompiled(): string | null {
  if (compiledBinaryPath && fs.existsSync(compiledBinaryPath)) {
    return compiledBinaryPath;
  }

  const rootDir = process.cwd();
  const binaryTarget = path.join(rootDir, 'elsepa_exec');

  if (fs.existsSync(binaryTarget)) {
    if (checkAndCleanBinary(binaryTarget)) {
      compiledBinaryPath = binaryTarget;
      return compiledBinaryPath;
    }
  }

  if (!checkGFortranAvailable()) {
    return null;
  }

  // Attempt gfortran compilation if available
  try {
    const fortranDir = path.join(rootDir, 'fortran');
    const elscataFile = path.join(fortranDir, 'elscata.f');
    const elsepaFile = path.join(fortranDir, 'elsepa.f');

    if (!fs.existsSync(elscataFile) || !fs.existsSync(elsepaFile)) {
      return null;
    }

    console.log('Compiling official Salvat ELSEPA Fortran source code with gfortran...');
    execSync(`gfortran -O2 -I"${fortranDir}" -o "${binaryTarget}" "${elscataFile}" "${elsepaFile}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (checkAndCleanBinary(binaryTarget)) {
      compiledBinaryPath = binaryTarget;
      console.log('Successfully compiled ELSEPA Fortran binary:', binaryTarget);
      return compiledBinaryPath;
    }
  } catch (err: any) {
    console.warn('gfortran compilation not available or failed:', err?.message || err);
  }

  return null;
}

export function runOfficialFortranSimulation(params: ElsepaInputParams): SimulationResult {
  if (wantsTypeScript(params)) {
    return runDiracPartialWaveSimulation(params);
  }

  // Never substitute the approximate TypeScript model for ELSEPA: callers get an
  // error instead (the browser then runs ELSEPA as WebAssembly).
  const binaryPath = ensureFortranBinaryCompiled();
  if (!binaryPath) {
    throw new Error('Native ELSEPA (ELSCATA) is not available on this server');
  }

  const startTime = performance.now();
  const rootDir = process.cwd();
  const inputContent = buildAtomicInput(params);

  // Create isolated execution temp folder
  const tempDir = path.join(rootDir, 'tmp_run_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  fs.mkdirSync(tempDir, { recursive: true });

  const inputFilePath = path.join(tempDir, 'in.dat');
  fs.writeFileSync(inputFilePath, inputContent, 'utf-8');

  // Set ELSEPA_DATA pointing to data directory
  const env = {
    ...process.env,
    ELSEPA_DATA: path.join(rootDir, 'data'),
  };

  try {
    fs.chmodSync(binaryPath, 0o755);
  } catch (e) {}

  let result: SimulationResult | null = null;
  let failure: any;
  try {
    execSync(`"${binaryPath}" < "${inputFilePath}"`, {
      cwd: tempDir,
      env,
      timeout: 15000,
      encoding: 'utf-8',
    });
    result = parseAtomicOutputs(params, readOutputFiles(tempDir), inputContent, performance.now() - startTime);
  } catch (err) {
    failure = err;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
  if (!result) throw elsepaFailure(failure);
  return result;
}

export function runOfficialEnergySweep(params: ElsepaInputParams, energiesEv: number[]): EnergySweepPoint[] {
  if (wantsTypeScript(params)) {
    return runEnergySweep(params, energiesEv);
  }
  return energiesEv.map((energyEv) => toSweepPoint(energyEv, runOfficialFortranSimulation({ ...params, energyEv })));
}

let compiledMolBinaryPath: string | null = null;

export function ensureElscatmBinaryCompiled(): string | null {
  if (compiledMolBinaryPath && fs.existsSync(compiledMolBinaryPath)) {
    return compiledMolBinaryPath;
  }

  const rootDir = process.cwd();
  const binaryTarget = path.join(rootDir, 'elscatm_exec');

  if (fs.existsSync(binaryTarget)) {
    if (checkAndCleanBinary(binaryTarget)) {
      compiledMolBinaryPath = binaryTarget;
      return compiledMolBinaryPath;
    }
  }

  if (!checkGFortranAvailable()) {
    return null;
  }

  try {
    const fortranDir = path.join(rootDir, 'fortran');
    const elscatmFile = path.join(fortranDir, 'elscatm.f');
    const elsepaFile = path.join(fortranDir, 'elsepa.f');

    if (!fs.existsSync(elscatmFile) || !fs.existsSync(elsepaFile)) {
      return null;
    }

    console.log('Compiling official Salvat ELSCATM Fortran source code with gfortran...');
    execSync(`gfortran -O2 -I"${fortranDir}" -o "${binaryTarget}" "${elscatmFile}" "${elsepaFile}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (checkAndCleanBinary(binaryTarget)) {
      compiledMolBinaryPath = binaryTarget;
      console.log('Successfully compiled ELSCATM Fortran binary:', binaryTarget);
      return compiledMolBinaryPath;
    }
  } catch (err: any) {
    console.warn('ELSCATM gfortran compilation not available or failed:', err?.message || err);
  }

  return null;
}

export function runOfficialMolecularFortranSimulation(params: MolecularInputParams): MolecularSimulationResult {
  const startTime = performance.now();

  if (wantsTypeScript(params)) {
    return runFallbackMolecularSimulation(params, startTime, '');
  }

  const binaryPath = ensureElscatmBinaryCompiled();
  const rootDir = process.cwd();
  const inputContent = buildMolecularInput(params);

  if (!binaryPath) {
    throw new Error('Native ELSEPA (ELSCATM) is not available on this server');
  }

  const tempDir = path.join(rootDir, `tmp_mol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputFilePath = path.join(tempDir, 'in_mol.dat');
  fs.writeFileSync(inputFilePath, inputContent, 'utf-8');

  const dataDir = path.join(rootDir, 'data');
  const env = {
    ...process.env,
    ELSEPA_DATA: fs.existsSync(dataDir) ? dataDir : rootDir,
  };

  try {
    fs.chmodSync(binaryPath, 0o755);
  } catch (e) {}

  let result: MolecularSimulationResult | null = null;
  let failure: any;
  try {
    execSync(`"${binaryPath}" < "${inputFilePath}"`, {
      cwd: tempDir,
      env,
      timeout: 30000,
      encoding: 'utf-8',
    });
    result = parseMolecularOutputs(params, readOutputFiles(tempDir), inputContent, performance.now() - startTime);
  } catch (err) {
    failure = err;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
  if (!result) throw elsepaFailure(failure);
  return result;
}

// ============================================================================
// FORTRAN SOURCE CODE FILE MANAGEMENT & RECOMPILATION ENGINE
// ============================================================================

const FORTRAN_DIR = path.join(process.cwd(), 'fortran');
const ORIGINALS_DIR = path.join(FORTRAN_DIR, '.originals');
const TS_ENGINE_PATH = path.join(process.cwd(), 'src', 'physics', 'elsepaPhysicsEngine.ts');
const TS_ORIGINAL_PATH = path.join(ORIGINALS_DIR, 'elsepaPhysicsEngine.ts');

export function initFortranOriginals(): void {
  try {
    if (!fs.existsSync(ORIGINALS_DIR)) {
      fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
    }
    if (fs.existsSync(FORTRAN_DIR)) {
      const files = fs.readdirSync(FORTRAN_DIR);
      for (const f of files) {
        if (f.endsWith('.f')) {
          const srcPath = path.join(FORTRAN_DIR, f);
          const origPath = path.join(ORIGINALS_DIR, f);
          if (!fs.existsSync(origPath) && fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, origPath);
          }
        }
      }
    }
    if (fs.existsSync(TS_ENGINE_PATH) && !fs.existsSync(TS_ORIGINAL_PATH)) {
      fs.copyFileSync(TS_ENGINE_PATH, TS_ORIGINAL_PATH);
    }
  } catch (err) {
    console.warn('Error initializing Fortran/TS originals backup:', err);
  }
}

export function getFortranFileList() {
  initFortranOriginals();
  try {
    if (!fs.existsSync(FORTRAN_DIR)) return [];
    const files = fs.readdirSync(FORTRAN_DIR).filter((f) => f.endsWith('.f'));
    return files.map((filename) => {
      const filePath = path.join(FORTRAN_DIR, filename);
      const origPath = path.join(ORIGINALS_DIR, filename);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      let modified = false;
      if (fs.existsSync(origPath)) {
        const origContent = fs.readFileSync(origPath, 'utf-8');
        modified = content !== origContent;
      }

      return {
        name: filename,
        lineCount: content.split('\n').length,
        sizeBytes: stats.size,
        modified,
      };
    });
  } catch (err) {
    console.error('Error getting Fortran file list:', err);
    return [];
  }
}

export function getFortranFileContent(filename: string) {
  initFortranOriginals();
  const safeFilename = path.basename(filename);
  const filePath = path.join(FORTRAN_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fortran file ${safeFilename} does not exist`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const origPath = path.join(ORIGINALS_DIR, safeFilename);
  let modified = false;
  if (fs.existsSync(origPath)) {
    const origContent = fs.readFileSync(origPath, 'utf-8');
    modified = content !== origContent;
  }
  return {
    name: safeFilename,
    content,
    modified,
  };
}

export function saveFortranFileContent(filename: string, content: string) {
  initFortranOriginals();
  const safeFilename = path.basename(filename);
  const filePath = path.join(FORTRAN_DIR, safeFilename);
  fs.writeFileSync(filePath, content, 'utf-8');

  // Invalidate compiled binaries cache
  compiledBinaryPath = null;
  compiledMolBinaryPath = null;
  const rootDir = process.cwd();
  try { fs.unlinkSync(path.join(rootDir, 'elsepa_exec')); } catch (_) {}
  try { fs.unlinkSync(path.join(rootDir, 'elscatm_exec')); } catch (_) {}

  // Attempt re-compilation immediately and return compilation log
  return triggerFortranCompilation();
}

export function resetFortranFilesToOriginal(filename?: string) {
  initFortranOriginals();
  if (filename) {
    const safeFilename = path.basename(filename);
    const origPath = path.join(ORIGINALS_DIR, safeFilename);
    const filePath = path.join(FORTRAN_DIR, safeFilename);
    if (fs.existsSync(origPath)) {
      fs.copyFileSync(origPath, filePath);
    }
  } else {
    if (fs.existsSync(ORIGINALS_DIR)) {
      const origFiles = fs.readdirSync(ORIGINALS_DIR);
      for (const f of origFiles) {
        if (f.endsWith('.f')) {
          fs.copyFileSync(path.join(ORIGINALS_DIR, f), path.join(FORTRAN_DIR, f));
        }
      }
    }
  }

  // Invalidate compiled binaries cache
  compiledBinaryPath = null;
  compiledMolBinaryPath = null;
  const rootDir = process.cwd();
  try { fs.unlinkSync(path.join(rootDir, 'elsepa_exec')); } catch (_) {}
  try { fs.unlinkSync(path.join(rootDir, 'elscatm_exec')); } catch (_) {}

  return triggerFortranCompilation();
}

export function triggerFortranCompilation() {
  const rootDir = process.cwd();
  const fortranDir = path.join(rootDir, 'fortran');
  const atomicTarget = path.join(rootDir, 'elsepa_exec');
  const molTarget = path.join(rootDir, 'elscatm_exec');

  let logs = `[Fortran Build Manager] Starting gfortran compilation sweep...\n`;

  if (!checkGFortranAvailable()) {
    logs += `[WARN] gfortran compiler binary not detected in runtime environment.\n`;
    logs += `[INFO] Fortran source files updated successfully on disk.\n`;
    logs += `[INFO] When running simulations without gfortran, ELSEPA runs as WebAssembly in the browser instead.\n`;
    return {
      success: true,
      compiled: false,
      hasGFortran: false,
      logs,
    };
  }

  let atomicOk = false;
  let molOk = false;

  try {
    logs += `[gfortran] Compiling Atomic ELSEPA executable (elsepa_exec)...\n`;
    const atomicOutput = execSync(
      `gfortran -O2 -I"${fortranDir}" -o "${atomicTarget}" "${path.join(fortranDir, 'elscata.f')}" "${path.join(fortranDir, 'elsepa.f')}"`,
      { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (atomicOutput) logs += atomicOutput + '\n';
    if (checkAndCleanBinary(atomicTarget)) {
      compiledBinaryPath = atomicTarget;
      atomicOk = true;
      logs += `[SUCCESS] Atomic ELSEPA binary compiled successfully (${atomicTarget})\n`;
    }
  } catch (err: any) {
    const errMsg = err?.stderr?.toString() || err?.stdout?.toString() || err?.message || 'Unknown compile error';
    logs += `[ERROR] Atomic ELSEPA compilation failed:\n${errMsg}\n`;
  }

  try {
    logs += `[gfortran] Compiling Molecular ELSCATM executable (elscatm_exec)...\n`;
    const molOutput = execSync(
      `gfortran -O2 -I"${fortranDir}" -o "${molTarget}" "${path.join(fortranDir, 'elscatm.f')}" "${path.join(fortranDir, 'elsepa.f')}"`,
      { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (molOutput) logs += molOutput + '\n';
    if (checkAndCleanBinary(molTarget)) {
      compiledMolBinaryPath = molTarget;
      molOk = true;
      logs += `[SUCCESS] Molecular ELSCATM binary compiled successfully (${molTarget})\n`;
    }
  } catch (err: any) {
    const errMsg = err?.stderr?.toString() || err?.stdout?.toString() || err?.message || 'Unknown compile error';
    logs += `[ERROR] Molecular ELSCATM compilation failed:\n${errMsg}\n`;
  }

  const compiled = atomicOk || molOk;
  return {
    success: compiled,
    compiled,
    hasGFortran: true,
    logs,
  };
}

// ============================================================================
// TYPESCRIPT PHYSICS ENGINE FILE MANAGEMENT
// ============================================================================

export function getTsEngineContent() {
  initFortranOriginals();
  if (!fs.existsSync(TS_ENGINE_PATH)) {
    throw new Error('TypeScript physics engine file does not exist');
  }
  const content = fs.readFileSync(TS_ENGINE_PATH, 'utf-8');
  let modified = false;
  if (fs.existsSync(TS_ORIGINAL_PATH)) {
    const origContent = fs.readFileSync(TS_ORIGINAL_PATH, 'utf-8');
    modified = content !== origContent;
  }
  return {
    name: 'elsepaPhysicsEngine.ts',
    content,
    modified,
  };
}

export function saveTsEngineContent(content: string) {
  initFortranOriginals();
  fs.writeFileSync(TS_ENGINE_PATH, content, 'utf-8');
  return {
    success: true,
    logs: `[TypeScript Engine] Successfully saved elsepaPhysicsEngine.ts to disk.\nNext simulation runs using the TS Approximation engine will use the updated model.\n`,
  };
}

export function resetTsEngineContent() {
  initFortranOriginals();
  if (fs.existsSync(TS_ORIGINAL_PATH)) {
    fs.copyFileSync(TS_ORIGINAL_PATH, TS_ENGINE_PATH);
  }
  return {
    success: true,
    logs: `[TypeScript Engine] Successfully restored elsepaPhysicsEngine.ts to the original approximate model.\n`,
  };
}

