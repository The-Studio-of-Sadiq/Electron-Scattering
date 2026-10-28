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
} from './elsepaFortranIO';

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

function runProgram(program: 'atomic' | 'molecular', input: string): Promise<RunResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, program, input });
  });
}

// ELSEPA reports invalid input with a STOP message on stderr and no DCS file.
function noOutputError(log: string | undefined): Error {
  const lastLines = (log || '').trim().split('\n').slice(-3).join(' ').trim();
  return new Error(`ELSEPA produced no DCS table${lastLines ? `: ${lastLines}` : ''}`);
}

export async function runElsepaWasmAtomic(params: ElsepaInputParams): Promise<SimulationResult> {
  const start = performance.now();
  const input = buildAtomicInput(params);
  const { files, log } = await runProgram('atomic', input);
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
    const res = await runElsepaWasmAtomic({ ...baseParams, energyEv });
    let shermanMin = 0;
    let shermanMax = 0;
    for (const pt of res.scatteringData) {
      if (pt.shermanS < shermanMin) shermanMin = pt.shermanS;
      if (pt.shermanS > shermanMax) shermanMax = pt.shermanS;
    }
    sweep.push({
      energyEv,
      sigmaElAu: res.summary.sigmaElAu,
      sigmaElCm2: res.summary.sigmaElCm2,
      sigma1Au: res.summary.sigma1Au,
      sigma2Au: res.summary.sigma2Au,
      sigmaAbsAu: res.summary.sigmaAbsAu,
      shermanPeakMin: shermanMin,
      shermanPeakMax: shermanMax,
    });
  }
  return sweep;
}
