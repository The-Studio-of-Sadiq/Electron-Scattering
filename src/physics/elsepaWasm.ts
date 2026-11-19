import {
  ElsepaInputParams,
  SimulationResult,
  MolecularInputParams,
  MolecularSimulationResult,
  EnergySweepPoint,
} from '../types';
import {
  FortranOutputFiles,
  buildAtomicInput,
  parseAtomicOutputs,
  buildMolecularInput,
  parseMolecularOutputs,
  toSweepPoint,
} from './elsepaFortranIO';
import { parseEsfield } from './densityFile';
import { DensityPoint, parseTextToDensityPoints } from './densityTools';

// Browser-side runner for the official ELSEPA Fortran compiled to WebAssembly.

interface RunResponse {
  id: number;
  files?: FortranOutputFiles;
  log?: string;
  error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: RunResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./elsepaWasm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<RunResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.error) entry.reject(new Error(event.data.error));
      else entry.resolve(event.data);
    };
    worker.onerror = (event) => {
      for (const entry of pending.values()) entry.reject(new Error(event.message || 'ELSEPA worker crashed'));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

export function cancelElsepaRuns(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const entry of pending.values()) {
    entry.reject(new Error('Cancelled by user'));
  }
  pending.clear();
}

function runProgram(program: 'atomic' | 'molecular', input: string, files?: Record<string, string>): Promise<RunResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, program, input, files });
  });
}

// ELSEPA reports invalid input with a STOP message on stderr and no DCS file.
function noOutputError(log: string | undefined): Error {
  const lastLines = (log || '').trim().split('\n').slice(-3).join(' ').trim();
  return new Error(`ELSEPA produced no DCS table${lastLines ? `: ${lastLines}` : ''}`);
}

export async function runElsepaWasmRaw(program: 'atomic' | 'molecular', input: string, files?: Record<string, string>): Promise<RunResponse> {
  return runProgram(program, input, files);
}

/**
 * Runs a custom ELSEPA Fortran input deck and returns the produced output files.
 * Used for fast runs that extract atomic potentials, fields, and densities.
 */
export async function runElsepaWasmDeck(
  input: string,
  files?: Record<string, string>
): Promise<FortranOutputFiles> {
  const res = await runProgram('atomic', input, files);
  return res.files || {};
}

/**
 * Reads a preloaded file from the WebAssembly virtual file system (e.g. `/database/z_079.den`).
 */
export async function readElsepaPreloadedFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {
      resolve: (r) => {
        if (r.files && r.files[filePath]) resolve(r.files[filePath]);
        else reject(new Error(`Preloaded file not found: ${filePath}`));
      },
      reject,
    });
    getWorker().postMessage({ id, readFile: filePath });
  });
}

/**
 * Builds an ELSEPA deck optimized for fast electron density extraction.
 *
 * Ground-state electron density rho(r) in ELSEPA (subroutine EFIELD) depends
 * solely on atomic number Z, ion charge q (NELEC = Z - q), and MELEC (1..5).
 * It is completely independent of projectile energy, scattering angles,
 * polarization, or absorption.
 *
 * To minimize computation time in the WebAssembly worker:
 * - We select a kinetic energy of 100 eV with angleStep: 90, minAngle: 0, maxAngle: 180 (only 3 angles).
 *   For ions (where high-energy factorization is disallowed by ELSEPA), low energy requires
 *   very few partial waves (k is small), finishing in ~100 ms instead of many seconds.
 * - Polarization and absorption potentials are turned off ('none').
 */
export function buildFastDensityDeck(
  z: number,
  ionCharge: number = 0,
  densityModel: 'dirac-fock' | 'thomas-fermi' | 'thomas-fermi-dirac' | 'dhfs' = 'dhfs'
): string {
  return buildAtomicInput({
    z,
    ionCharge: Math.max(-z, Math.min(z, Math.round(ionCharge))),
    densityModel,
    energyEv: 100,
    projectile: -1,
    massNumber: 1,
    nuclearModel: 'point',
    exchangeModel: 'none',
    polarizationModel: 'none',
    polarizability: 0,
    cutoffRadius: 1,
    absorptionModel: 'none',
    minAngle: 0,
    maxAngle: 180,
    angleStep: 90,
  });
}

/**
 * Fetches the model radial electron density from ELSEPA for a given element,
 * charge, and model. Returns an array of { r, rho } points.
 */
export async function fetchElsepaModelDensity(
  z: number,
  ionCharge: number = 0,
  densityModel: 'dirac-fock' | 'thomas-fermi' | 'thomas-fermi-dirac' | 'dhfs' = 'dhfs'
): Promise<DensityPoint[]> {
  const q = Math.max(-z, Math.min(z, Math.round(ionCharge)));

  // For neutral Dirac-Fock (MELEC 4, q = 0), read the database table directly
  if (q === 0 && densityModel === 'dirac-fock') {
    try {
      const padZ = String(z).padStart(3, '0');
      const text = await readElsepaPreloadedFile(`/database/z_${padZ}.den`);
      const parsed = parseTextToDensityPoints(text);
      if (parsed.points.length > 0) {
        return parsed.points;
      }
    } catch (err) {
      console.warn('Direct DF table read failed, falling back to fast ELSEPA run:', err);
    }
  }

  // Fast run of ELSEPA to extract density from scfield.dat / esfield.dat
  const deck = buildFastDensityDeck(z, q, densityModel);
  const files = await runElsepaWasmDeck(deck);
  const points = parseEsfield(files);
  if (points.length === 0) {
    throw new Error(`Failed to extract electron density from ELSEPA for Z=${z}, q=${q}, model=${densityModel}`);
  }
  return points;
}


export async function runElsepaWasmAtomic(params: ElsepaInputParams): Promise<SimulationResult> {
  const start = performance.now();
  const input = buildAtomicInput(params);
  const dataFiles: Record<string, string> = {};
  if (params.densityModel === 'custom-file' && params.customDensityData) {
    dataFiles['density.usr'] = params.customDensityData;
  }
  const { files, log } = await runProgram('atomic', input, Object.keys(dataFiles).length > 0 ? dataFiles : undefined);
  const result = parseAtomicOutputs(params, files || {}, input, performance.now() - start);
  if (!result) throw noOutputError(log);
  return result;
}

export async function runElsepaWasmMolecular(params: MolecularInputParams): Promise<MolecularSimulationResult> {
  const start = performance.now();
  const input = buildMolecularInput(params);
  const { files, log } = await runProgram('molecular', input);
  const result = parseMolecularOutputs(params, files || {}, input, performance.now() - start);
  if (!result) throw noOutputError(log);
  return result;
}

export async function runElsepaWasmEnergySweep(baseParams: ElsepaInputParams, energiesEv: number[]): Promise<EnergySweepPoint[]> {
  const sweep: EnergySweepPoint[] = [];
  for (const energyEv of energiesEv) {
    sweep.push(toSweepPoint(energyEv, await runElsepaWasmAtomic({ ...baseParams, energyEv })));
  }
  return sweep;
}
