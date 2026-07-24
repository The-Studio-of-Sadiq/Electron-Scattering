import { SavedSimulationRun, SimulationResult, MolecularSimulationResult } from '../types';

const STORAGE_KEY = 'elsepa_saved_simulations_v1';

export function getSavedSimulations(): SavedSimulationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load saved simulations from localStorage:', e);
    return [];
  }
}

export function saveAtomicSimulationRun(result: SimulationResult, customTitle?: string, notes?: string): SavedSimulationRun {
  const runs = getSavedSimulations();
  const el = result.element;
  const proj = result.params.projectile === -1 ? 'e⁻' : 'e⁺';
  const defaultTitle = `${el.name} (${el.symbol}, Z=${el.z}) - ${result.params.energyEv >= 1000 ? `${(result.params.energyEv / 1000).toFixed(1)} keV` : `${result.params.energyEv} eV`} ${proj}`;

  const newRun: SavedSimulationRun = {
    id: `run_atomic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    title: customTitle || defaultTitle,
    type: 'atomic',
    atomicResult: result,
    tags: [el.symbol, `Z=${el.z}`, `${result.params.energyEv}eV`, result.params.exchangeModel],
    notes: notes || '',
  };

  runs.unshift(newRun);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (e) {
    console.warn('localStorage save warning (quota):', e);
  }
  return newRun;
}

export function saveMolecularSimulationRun(result: MolecularSimulationResult, customTitle?: string, notes?: string): SavedSimulationRun {
  const runs = getSavedSimulations();
  const proj = result.params.projectile === -1 ? 'e⁻' : 'e⁺';
  const defaultTitle = `${result.params.moleculeName} - ${result.params.energyEv >= 1000 ? `${(result.params.energyEv / 1000).toFixed(1)} keV` : `${result.params.energyEv} eV`} ${proj}`;

  const newRun: SavedSimulationRun = {
    id: `run_mol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    title: customTitle || defaultTitle,
    type: 'molecular',
    molecularResult: result,
    tags: [result.params.moleculeName, 'Molecular', `${result.params.energyEv}eV`],
    notes: notes || '',
  };

  runs.unshift(newRun);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (e) {
    console.warn('localStorage save warning (quota):', e);
  }
  return newRun;
}

export function deleteSavedSimulationRun(id: string): SavedSimulationRun[] {
  const runs = getSavedSimulations().filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (e) {
    console.error('Failed to delete saved simulation run:', e);
  }
  return runs;
}

export function clearAllSavedSimulationRuns(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved simulation runs:', e);
  }
}

export function exportSavedRunsJSON(): string {
  const runs = getSavedSimulations();
  return JSON.stringify(runs, null, 2);
}

export function importSavedRunsJSON(jsonString: string): SavedSimulationRun[] {
  try {
    const imported: SavedSimulationRun[] = JSON.parse(jsonString);
    if (Array.isArray(imported)) {
      const existing = getSavedSimulations();
      const existingIds = new Set(existing.map((r) => r.id));
      const merged = [...existing];
      imported.forEach((run) => {
        if (run.id && !existingIds.has(run.id)) {
          merged.push(run);
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.error('Invalid JSON format for import:', e);
  }
  return getSavedSimulations();
}
