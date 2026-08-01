import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Cpu,
  Layers,
  FileCode,
  Download,
  Info,
  Check,
  FlaskConical,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MolecularInputParams, MolecularSimulationResult, MolecularAtom } from '../types';
import { getElementByZ } from '../data/elements';
import { saveMolecularSimulationRun } from '../utils/localStorage';
import { MathTex, LaTeXText } from './LaTeX';

interface MolecularWorkbenchProps {
  onSimulationComplete?: (result: MolecularSimulationResult) => void;
  openPeriodicTableForIndex?: (index: number) => void;
  enginePreference?: 'gfortran' | 'typescript';
}

const PRESET_MOLECULES: Record<string, { name: string; polarizability: number; atoms: MolecularAtom[] }> = {
  water: {
    name: 'Water (H₂O)',
    polarizability: 1.457e-24,
    atoms: [
      { z: 8, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 1, xAngstrom: 0.9572, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 1, xAngstrom: -0.24, yAngstrom: 0.9266, zAngstrom: 0.0 },
    ],
  },
  co2: {
    name: 'Carbon Dioxide (CO₂)',
    polarizability: 2.91e-24,
    atoms: [
      { z: 6, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 8, xAngstrom: 1.162, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 8, xAngstrom: -1.162, yAngstrom: 0.0, zAngstrom: 0.0 },
    ],
  },
  methane: {
    name: 'Methane (CH₄)',
    polarizability: 2.59e-24,
    atoms: [
      { z: 6, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 1, xAngstrom: 0.629, yAngstrom: 0.629, zAngstrom: 0.629 },
      { z: 1, xAngstrom: -0.629, yAngstrom: -0.629, zAngstrom: 0.629 },
      { z: 1, xAngstrom: -0.629, yAngstrom: 0.629, zAngstrom: -0.629 },
      { z: 1, xAngstrom: 0.629, yAngstrom: -0.629, zAngstrom: -0.629 },
    ],
  },
  nitrogen: {
    name: 'Nitrogen Gas (N₂)',
    polarizability: 1.74e-24,
    atoms: [
      { z: 7, xAngstrom: -0.549, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 7, xAngstrom: 0.549, yAngstrom: 0.0, zAngstrom: 0.0 },
    ],
  },
  benzene: {
    name: 'Benzene (C₆H₆)',
    polarizability: 1.0e-23,
    atoms: [
      { z: 6, xAngstrom: 1.399, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 6, xAngstrom: 0.6995, yAngstrom: 1.2115, zAngstrom: 0.0 },
      { z: 6, xAngstrom: -0.6995, yAngstrom: 1.2115, zAngstrom: 0.0 },
      { z: 6, xAngstrom: -1.399, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 6, xAngstrom: -0.6995, yAngstrom: -1.2115, zAngstrom: 0.0 },
      { z: 6, xAngstrom: 0.6995, yAngstrom: -1.2115, zAngstrom: 0.0 },
      { z: 1, xAngstrom: 2.479, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 1, xAngstrom: 1.2395, yAngstrom: 2.1469, zAngstrom: 0.0 },
      { z: 1, xAngstrom: -1.2395, yAngstrom: 2.1469, zAngstrom: 0.0 },
      { z: 1, xAngstrom: -2.479, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 1, xAngstrom: -1.2395, yAngstrom: -2.1469, zAngstrom: 0.0 },
      { z: 1, xAngstrom: 1.2395, yAngstrom: -2.1469, zAngstrom: 0.0 },
    ],
  },
  uf6: {
    name: 'Uranium Hexafluoride (UF₆)',
    polarizability: 8.0e-24,
    atoms: [
      { z: 92, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 9, xAngstrom: 1.996, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 9, xAngstrom: -1.996, yAngstrom: 0.0, zAngstrom: 0.0 },
      { z: 9, xAngstrom: 0.0, yAngstrom: 1.996, zAngstrom: 0.0 },
      { z: 9, xAngstrom: 0.0, yAngstrom: -1.996, zAngstrom: 0.0 },
      { z: 9, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: 1.996 },
      { z: 9, xAngstrom: 0.0, yAngstrom: 0.0, zAngstrom: -1.996 },
    ],
  },
};

export const MolecularWorkbench: React.FC<MolecularWorkbenchProps> = ({
  onSimulationComplete,
  enginePreference = 'gfortran',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('water');
  const [moleculeName, setMoleculeName] = useState<string>('Water (H₂O)');
  const [polarizability, setPolarizability] = useState<number>(1.457e-24);
  const [atoms, setAtoms] = useState<MolecularAtom[]>(PRESET_MOLECULES.water.atoms);

  const [projectile, setProjectile] = useState<-1 | 1>(-1);
  const [energyEv, setEnergyEv] = useState<number>(1000); // 1 keV
  const [exchangeModel, setExchangeModel] = useState<any>('furness-mccarthy');
  const [polarizationModel, setPolarizationModel] = useState<any>('buckingham');
  const [absorptionModel, setAbsorptionModel] = useState<any>('staszewska-lda');
  const [absorptionStrength, setAbsorptionStrength] = useState<number>(2.0);
  const [excitationEnergy, setExcitationEnergy] = useState<number>(6.20);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<MolecularSimulationResult | null>(null);
  const [showLogScale, setShowLogScale] = useState<boolean>(true);
  const [savedNotification, setSavedNotification] = useState<boolean>(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    if (PRESET_MOLECULES[key]) {
      setMoleculeName(PRESET_MOLECULES[key].name);
      setPolarizability(PRESET_MOLECULES[key].polarizability);
      setAtoms(PRESET_MOLECULES[key].atoms);
    }
  };

  const handleAddAtom = () => {
    setAtoms([
      ...atoms,
      { z: 1, xAngstrom: 1.0, yAngstrom: 0.0, zAngstrom: 0.0 },
    ]);
  };

  const handleRemoveAtom = (index: number) => {
    if (atoms.length <= 1) return;
    setAtoms(atoms.filter((_, i) => i !== index));
  };

  const handleAtomChange = (index: number, field: keyof MolecularAtom, val: number) => {
    const updated = [...atoms];
    updated[index] = { ...updated[index], [field]: val };
    setAtoms(updated);
  };

  const handleRunSimulation = async () => {
    setIsLoading(true);
    setSavedNotification(false);

    const params: MolecularInputParams & { forceEngine?: string } = {
      moleculeName,
      atoms,
      projectile,
      energyEv,
      exchangeModel,
      polarizationModel,
      polarizability,
      absorptionModel,
      absorptionStrength,
      excitationEnergy,
      forceEngine: enginePreference,
    };

    try {
      const response = await fetch('/api/simulate-molecule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to run molecular simulation');
      }

      const data: MolecularSimulationResult = await response.json();
      setSimResult(data);

      // Save automatically to local storage history
      saveMolecularSimulationRun(data);
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 3000);

      if (onSimulationComplete) {
        onSimulationComplete(data);
      }
    } catch (err) {
      console.error('Molecular simulation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToLocalStorage = () => {
    if (!simResult) return;
    saveMolecularSimulationRun(simResult, `${simResult.params.moleculeName} (Saved Run)`);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 3000);
  };

  const handleDownloadCsv = () => {
    if (!simResult) return;
    const headers = 'Angle_deg,Coherent_DCS_cm2_sr,Incoherent_DCS_cm2_sr,Coherent_DCS_a02_sr,Incoherent_DCS_a02_sr\n';
    const rows = simResult.scatteringData
      .map((p) => `${p.angleDeg},${p.dcsCohCm2},${p.dcsIncohCm2},${p.dcsCohAu},${p.dcsIncohAu}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELSCATM_${simResult.params.moleculeName.replace(/\s+/g, '_')}_${simResult.params.energyEv}eV_DCS.csv`;
    a.click();
  };

  const handleDownloadJson = () => {
    if (!simResult) return;
    const jsonStr = JSON.stringify(simResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELSCATM_${simResult.params.moleculeName.replace(/\s+/g, '_')}_${simResult.params.energyEv}eV_Result.json`;
    a.click();
  };

  return (
    <div id="molecular-workbench-container" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm uppercase tracking-wider mb-1">
            <FlaskConical className="w-4 h-4" />
            <span>ELSCATM Molecular Scattering Solver</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Single-Scattering Independent-Atom Molecular Dirac Solver
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-3xl">
            Calculates orientation-averaged coherent interference differential cross sections (DCS), spin polarization, and molecular total cross sections using Salvat's official compiled Fortran <code className="text-indigo-300 font-mono">elscatm</code> engine.
          </p>
        </div>

        <button
          id="run-molecular-sim-btn"
          onClick={handleRunSimulation}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-lg shadow-lg flex items-center space-x-2 transition-all disabled:opacity-50 shrink-0"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Running ELSCATM Fortran...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Molecular Fortran Solver</span>
            </>
          )}
        </button>
      </div>

      {/* Grid: Inputs and Molecular Geometry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Preset & Molecule Builder Column (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Molecular Geometry & Structure</span>
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">
              {atoms.length} Atoms
            </span>
          </div>

          {/* Molecule Preset Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 block">Preset Molecule Structure</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(PRESET_MOLECULES).map(([key, item]) => (
                <button
                  key={key}
                  id={`preset-mol-${key}`}
                  onClick={() => handleSelectPreset(key)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                    selectedPreset === key
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* Molecule Name & Polarizability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Molecule Name</label>
              <input
                type="text"
                value={moleculeName}
                onChange={(e) => setMoleculeName(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                <span>Dipole Polarizability</span>
                <MathTex math="\alpha_d" />
                <span>(</span>
                <MathTex math="\text{cm}^3" />
                <span>)</span>
              </label>
              <input
                type="number"
                step="1e-25"
                value={polarizability}
                onChange={(e) => setPolarizability(parseFloat(e.target.value) || 1e-24)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Atom Coordinates Table */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">Atomic Composition & Cartesian Coordinates (Å)</label>
              <button
                id="add-atom-btn"
                onClick={handleAddAtom}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-300 flex items-center space-x-1 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Atom</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 font-semibold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2 border-b">#</th>
                    <th className="p-2 border-b">Element (Z)</th>
                    <th className="p-2 border-b">X (Å)</th>
                    <th className="p-2 border-b">Y (Å)</th>
                    <th className="p-2 border-b">Z (Å)</th>
                    <th className="p-2 border-b text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atoms.map((atom, idx) => {
                    const elData = getElementByZ(atom.z);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min={1}
                              max={103}
                              value={atom.z}
                              onChange={(e) => handleAtomChange(idx, 'z', parseInt(e.target.value) || 1)}
                              className="w-14 p-1 bg-white border border-slate-300 rounded font-bold text-center text-xs text-indigo-700"
                            />
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[100px]">
                              {elData.name} ({elData.symbol})
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={atom.xAngstrom}
                            onChange={(e) => handleAtomChange(idx, 'xAngstrom', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={atom.yAngstrom}
                            onChange={(e) => handleAtomChange(idx, 'yAngstrom', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={atom.zAngstrom}
                            onChange={(e) => handleAtomChange(idx, 'zAngstrom', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveAtom(idx)}
                            disabled={atoms.length <= 1}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Physics & Projectile Parameters Column (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>Beam & Physics Potentials</span>
            </h3>
          </div>

          {/* Projectile & Energy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Projectile</label>
              <select
                value={projectile}
                onChange={(e) => setProjectile(parseInt(e.target.value) as any)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value={-1}>Electron (e⁻)</option>
                <option value={1}>Positron (e⁺)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Kinetic Energy (eV)</label>
              <input
                type="number"
                value={energyEv}
                onChange={(e) => setEnergyEv(parseFloat(e.target.value) || 1000)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 font-bold"
              />
            </div>
          </div>

          {/* Exchange & Polarization */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Exchange Potential</label>
              <select
                value={exchangeModel}
                onChange={(e) => setExchangeModel(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              >
                <option value="furness-mccarthy">Furness-McCarthy (FM)</option>
                <option value="riley-truhlar">Riley-Truhlar (RT)</option>
                <option value="none">No Exchange</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Correlation-Polarization</label>
              <select
                value={polarizationModel}
                onChange={(e) => setPolarizationModel(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              >
                <option value="buckingham">Buckingham Potential (Molecular α)</option>
                <option value="none">No Polarization</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Absorption Potential</label>
              <select
                value={absorptionModel}
                onChange={(e) => setAbsorptionModel(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              >
                <option value="staszewska-lda">Staszewska LDA Absorption</option>
                <option value="none">No Absorption</option>
              </select>
            </div>

            {absorptionModel === 'staszewska-lda' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Strength (VABSA)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={absorptionStrength}
                    onChange={(e) => setAbsorptionStrength(parseFloat(e.target.value) || 2.0)}
                    className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Excitation Δ (eV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={excitationEnergy}
                    onChange={(e) => setExcitationEnergy(parseFloat(e.target.value) || 6.2)}
                    className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick info */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex items-start space-x-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              The ELSCATM module computes phase shifts for each constituent atom with Dirac-Fock potential and performs orientation-averaged spherical wave expansion for single-scattering molecular interference.
            </span>
          </div>
        </div>
      </div>

      {/* Saved Notification Toast */}
      {savedNotification && (
        <div className="bg-emerald-600 text-white p-3 rounded-lg shadow-md text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>Simulation successful & automatically saved to Local Storage history!</span>
          </div>
        </div>
      )}

      {/* Results Dashboard */}
      {simResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-xs uppercase">
                  Molecular Results
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Runtime: {simResult.summary.computationTimeMs} ms
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {simResult.params.moleculeName} Elastic Scattering Cross Section
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-save-molecular-run"
                onClick={handleSaveToLocalStorage}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all"
                title="Save molecular run parameters and results to browser LocalStorage history"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save to History</span>
              </button>

              <div className="relative">
                <button
                  id="btn-download-molecular-data"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Data</span>
                </button>

                {showDownloadMenu && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 font-sans text-xs">
                    <button
                      id="btn-export-mol-csv"
                      onClick={() => {
                        handleDownloadCsv();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-800 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-bold">Export CSV Dataset</div>
                        <div className="text-[10px] text-slate-500">Coherent & incoherent DCS table</div>
                      </div>
                    </button>

                    <button
                      id="btn-export-mol-json"
                      onClick={() => {
                        handleDownloadJson();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-slate-800 flex items-center gap-2 border-t border-slate-100"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="font-bold">Export JSON File</div>
                        <div className="text-[10px] text-slate-500">Full parameters & physics data</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowLogScale(!showLogScale)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  showLogScale
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {showLogScale ? 'Log Scale (Y)' : 'Linear Scale'}
              </button>
            </div>
          </div>

          {/* Integrated Cross Section Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <span>Coherent Total</span>
                <MathTex math="\sigma_{\text{coh}}" />
              </div>
              <div className="text-lg font-black text-indigo-700 font-mono mt-1">
                {simResult.summary.sigmaCohCm2.toExponential(3)} cm²
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {simResult.summary.sigmaCohAu.toFixed(2)} a₀²
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <span>Incoherent Sum</span>
                <MathTex math="\sigma_{\text{incoh}}" />
              </div>
              <div className="text-lg font-black text-emerald-700 font-mono mt-1">
                {simResult.summary.sigmaIncohCm2.toExponential(3)} cm²
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {simResult.summary.sigmaIncohAu.toFixed(2)} a₀²
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <span>1st Transport</span>
                <MathTex math="\sigma_1" />
              </div>
              <div className="text-lg font-black text-slate-800 font-mono mt-1">
                {(simResult.summary.sigma1CohCm2 || 0).toExponential(3)} cm²
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <span>2nd Transport</span>
                <MathTex math="\sigma_2" />
              </div>
              <div className="text-lg font-black text-slate-800 font-mono mt-1">
                {(simResult.summary.sigma2CohCm2 || 0).toExponential(3)} cm²
              </div>
            </div>
          </div>

          {/* Recharts Chart: Coherent Interference DCS vs Incoherent Atom Sum */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
              <h4 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <LaTeXText text="Differential Cross Section DCS $\frac{d\sigma}{d\Omega}$ ($\text{cm}^2/\text{sr}$) vs Scattering Angle $\theta$ ($\text{deg}$)" />
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                Molecular interference diffraction fringes vs independent atom sum
              </span>
            </div>

            <div className="h-80 w-full bg-slate-50/50 p-2 rounded-lg border border-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simResult.scatteringData} margin={{ top: 15, right: 30, left: 65, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="angleDeg"
                    label={{ value: 'Scattering Angle θ (deg)', position: 'insideBottom', offset: -15, fill: '#64748b', style: { fontSize: '12px' } }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    scale={showLogScale ? 'log' : 'linear'}
                    domain={['auto', 'auto']}
                    tickFormatter={(tick) => tick.toExponential(1)}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'DCS dσ/dΩ (cm²/sr)', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle', fontSize: '12px' }, fill: '#64748b' }}
                  />
                  <Tooltip
                    formatter={(val: number) => [val.toExponential(4) + ' cm²/sr', '']}
                    labelFormatter={(label) => `Angle θ: ${label}°`}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="dcsCohCm2"
                    name="Coherent Molecular Interference DCS"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dcsIncohCm2"
                    name="Incoherent Independent Atom Sum DCS"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fortran Input File Preview */}
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>Generated Fortran Input File (ELSCATM in.dat)</span>
            </h4>
            <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto border border-slate-800 max-h-48 overflow-y-auto">
              {simResult.elsepaInputFileText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
