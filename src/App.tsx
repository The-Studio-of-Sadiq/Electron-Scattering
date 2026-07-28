import React, { useState, useEffect } from 'react';
import { ElsepaInputParams, SimulationResult, UploadedDataset, FortranServerStatus, SavedSimulationRun } from './types';
import { Header } from './components/Header';
import { InputGuiForm } from './components/InputGuiForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { EnergySweepViewer } from './components/EnergySweepViewer';
import { DatasetUploadPanel } from './components/DatasetUploadPanel';
import { RenderDeploymentModal } from './components/RenderDeploymentModal';
import { MolecularWorkbench } from './components/MolecularWorkbench';
import { SavedRunsManager } from './components/SavedRunsManager';
import { PhysicsGuide } from './components/PhysicsGuide';
import { getElementByZ } from './data/elements';
import { saveAtomicSimulationRun } from './utils/localStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy' | 'physics'>('workbench');

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('elsepa_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('elsepa_theme', next);
      return next;
    });
  };


  // Default initial simulation parameters (Gold Au Z=79, 100 keV electron)
  const [params, setParams] = useState<ElsepaInputParams>({
    z: 79,
    projectile: -1, // Electron
    energyEv: 100000, // 100 keV
    massNumber: 196.97,
    nuclearModel: 'fermi',
    fermiC: 6.55,
    fermiT: 0.5229,
    densityModel: 'dirac-fock',
    exchangeModel: 'furness-mccarthy',
    polarizationModel: 'buckingham',
    polarizability: 36.0,
    cutoffRadius: 1.7,
    absorptionModel: 'none',
    minAngle: 0,
    maxAngle: 180,
    angleStep: 1.0,
  });

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [fortranStatus, setFortranStatus] = useState<FortranServerStatus | null>(null);
  const [uploadedDatasets, setUploadedDatasets] = useState<UploadedDataset[]>([]);

  // Fetch Fortran status on mount
  useEffect(() => {
    fetch('/api/fortran-status')
      .then((res) => res.json())
      .then((status) => setFortranStatus(status))
      .catch((err) => console.warn('Fortran status check failed:', err));

    fetch('/api/datasets')
      .then((res) => res.json())
      .then((data) => setUploadedDatasets(data))
      .catch((err) => console.warn('Fetch datasets failed:', err));

    // Run initial benchmark simulation
    runSimulation(params);
  }, []);

  const runSimulation = async (inputParams: ElsepaInputParams) => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputParams),
      });

      if (res.ok) {
        const result: SimulationResult = await res.json();
        setSimulationResult(result);
        saveAtomicSimulationRun(result);
      } else {

        console.error('Simulation server error');
      }
    } catch (err) {
      console.error('Simulation request failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleLoadPreset = (presetKey: string) => {
    let newP: ElsepaInputParams = { ...params };

    if (presetKey === 'e-gold-100kev') {
      const el = getElementByZ(79);
      newP = {
        ...params,
        z: 79,
        projectile: -1,
        energyEv: 100000,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
        nuclearModel: 'fermi',
      };
    } else if (presetKey === 'e-argon-10ev') {
      const el = getElementByZ(18);
      newP = {
        ...params,
        z: 18,
        projectile: -1,
        energyEv: 10,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
        exchangeModel: 'furness-mccarthy',
        polarizationModel: 'buckingham',
      };
    } else if (presetKey === 'e-uranium-1mev') {
      const el = getElementByZ(92);
      newP = {
        ...params,
        z: 92,
        projectile: -1,
        energyEv: 1000000,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
        nuclearModel: 'fermi',
      };
    } else if (presetKey === 'e+-gold-100kev') {
      const el = getElementByZ(79);
      newP = {
        ...params,
        z: 79,
        projectile: 1, // Positron
        energyEv: 100000,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
        exchangeModel: 'none',
      };
    } else if (presetKey === 'e-hydrogen-100ev') {
      const el = getElementByZ(1);
      newP = {
        ...params,
        z: 1,
        projectile: -1,
        energyEv: 100,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
        nuclearModel: 'point',
      };
    } else if (presetKey === 'e-xenon-10kev') {
      const el = getElementByZ(54);
      newP = {
        ...params,
        z: 54,
        projectile: -1,
        energyEv: 10000,
        massNumber: el.atomicMass,
        polarizability: el.polarizability,
        cutoffRadius: el.cutoffRadius,
      };
    }

    setParams(newP);
    runSimulation(newP);
  };

  const handleCloneToWorkbench = (run: SavedSimulationRun) => {
    if (run.type === 'atomic' && run.atomicResult?.params) {
      setParams(run.atomicResult.params);
      setActiveTab('workbench');
      runSimulation(run.atomicResult.params);
    } else if (run.type === 'molecular' && run.molecularResult) {
      setActiveTab('molecular');
    } else if (run.atomicResult?.params) {
      setParams(run.atomicResult.params);
      setActiveTab('workbench');
      runSimulation(run.atomicResult.params);
    }
  };

  const getMatchingPresetKey = (p: ElsepaInputParams): string => {
    if (p.z === 79 && p.projectile === -1 && p.energyEv === 100000 && p.nuclearModel === 'fermi') return 'e-gold-100kev';
    if (p.z === 18 && p.projectile === -1 && p.energyEv === 10 && p.exchangeModel === 'furness-mccarthy' && p.polarizationModel === 'buckingham') return 'e-argon-10ev';
    if (p.z === 92 && p.projectile === -1 && p.energyEv === 1000000 && p.nuclearModel === 'fermi') return 'e-uranium-1mev';
    if (p.z === 79 && p.projectile === 1 && p.energyEv === 100000 && p.exchangeModel === 'none') return 'e+-gold-100kev';
    if (p.z === 1 && p.projectile === -1 && p.energyEv === 100 && p.nuclearModel === 'point') return 'e-hydrogen-100ev';
    if (p.z === 54 && p.projectile === -1 && p.energyEv === 10000) return 'e-xenon-10kev';
    return 'custom';
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors overflow-x-hidden ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fortranStatus={fortranStatus}
        onLoadPreset={handleLoadPreset}
        activePresetKey={getMatchingPresetKey(params)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-6">
        {activeTab === 'workbench' && (
          <div className="flex flex-col gap-6">
            <InputGuiForm
              params={params}
              setParams={setParams}
              onRunSimulation={() => runSimulation(params)}
              isSimulating={isSimulating}
              theme={theme}
            />

            <ResultsDashboard
              result={simulationResult}
              uploadedDatasets={uploadedDatasets}
            />
          </div>
        )}

        {activeTab === 'molecular' && <MolecularWorkbench />}

        {activeTab === 'sweep' && <EnergySweepViewer baseParams={params} />}

        {activeTab === 'saved' && (
          <SavedRunsManager onCloneToWorkbench={handleCloneToWorkbench} />
        )}

        {activeTab === 'datasets' && (

          <DatasetUploadPanel
            uploadedDatasets={uploadedDatasets}
            setUploadedDatasets={setUploadedDatasets}
            onSelectOverlay={() => setActiveTab('workbench')}
          />
        )}

        {activeTab === 'deploy' && (
          <RenderDeploymentModal fortranStatus={fortranStatus} />
        )}

        {activeTab === 'physics' && (
          <PhysicsGuide theme={theme} />
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t py-4 px-4 sm:px-6 text-center text-xs transition-colors ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-600'
          : 'bg-slate-900 border-slate-800/80 text-slate-400'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-2">
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
            © Created by Golam Kuadir Khan Prince (Undergraduate Student, Dept. of Electrical and Electronic Engineering, HSTU), Professor Dr. Md. Mahabub Hossain (Faculty, Dept. of Electronics and Communication Engineering, HSTU), Pankaj Bhowmik (Faculty, Dept. of Computer Science and Engineering, HSTU) and HSTU Research Society
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between w-full text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 gap-1">
            <span>
              Electron Scattering Simulator • ELSEPA Dirac Scattering Engine
            </span>
            <span className="font-mono">
              Salvat, Jablonski, Powell Physics Benchmarks
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
