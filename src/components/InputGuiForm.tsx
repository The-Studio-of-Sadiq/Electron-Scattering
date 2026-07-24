import React, { useState } from 'react';
import {
  Atom,
  Zap,
  Shield,
  Layers,
  Compass,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Sliders,
  FileText,
} from 'lucide-react';
import { ElsepaInputParams, ElementData } from '../types';
import { getElementByZ } from '../data/elements';
import { PeriodicTableModal } from './PeriodicTableModal';

interface InputGuiFormProps {
  params: ElsepaInputParams;
  setParams: React.Dispatch<React.SetStateAction<ElsepaInputParams>>;
  onRunSimulation: () => void;
  isSimulating: boolean;
  theme?: 'dark' | 'light';
}

export const InputGuiForm: React.FC<InputGuiFormProps> = ({
  params,
  setParams,
  onRunSimulation,
  isSimulating,
  theme = 'dark',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [energyUnit, setEnergyUnit] = useState<'eV' | 'keV' | 'MeV'>('keV');

  const currentElement: ElementData = getElementByZ(params.z);

  // Convert raw energy in eV to user display value in selected unit
  const displayEnergy =
    energyUnit === 'MeV'
      ? params.energyEv / 1e6
      : energyUnit === 'keV'
      ? params.energyEv / 1e3
      : params.energyEv;

  const handleEnergyChange = (val: number) => {
    let ev = val;
    if (energyUnit === 'keV') ev = val * 1e3;
    if (energyUnit === 'MeV') ev = val * 1e6;
    setParams((prev) => ({ ...prev, energyEv: Math.max(0.1, ev) }));
  };

  const handleSelectZ = (newZ: number) => {
    const el = getElementByZ(newZ);
    setParams((prev) => ({
      ...prev,
      z: newZ,
      massNumber: el.atomicMass,
      polarizability: el.polarizability,
      cutoffRadius: el.cutoffRadius,
    }));
  };

  const isLight = theme === 'light';

  return (
    <div
      id="input-gui-form-container"
      className={
        isLight
          ? 'bg-white border border-slate-200 rounded-2xl p-5 shadow-md text-slate-900 flex flex-col gap-5 transition-colors'
          : 'bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100 flex flex-col gap-5 transition-colors'
      }
    >
      {/* Header Banner */}
      <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className={`font-bold text-base tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            ELSEPA Simulation Parameters
          </h2>
        </div>
        <button
          id="open-periodic-table-btn"
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all hover:scale-102 ${
            isLight
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Periodic Table Picker</span>
        </button>
      </div>

      {/* Grid Layout of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Target Atom Selection */}
        <div id="target-atom-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Atom className="w-4 h-4 text-indigo-400" />
                Target Atom (Z)
              </span>
              <span className="text-xs px-2 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700 font-mono">
                {currentElement.group}
              </span>
            </div>

            <div className="flex items-center space-x-3 mb-3">
              <div className="w-14 h-14 bg-indigo-950 border-2 border-indigo-500/60 rounded-xl flex flex-col items-center justify-center text-white shadow-inner">
                <span className="text-[10px] text-indigo-300 font-bold">{currentElement.z}</span>
                <span className="text-xl font-black leading-none">{currentElement.symbol}</span>
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-white">{currentElement.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {currentElement.atomicMass.toFixed(2)} amu
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[160px]" title={currentElement.electronConfig}>
                  {currentElement.electronConfig}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Atomic Number Z:</label>
                <input
                  type="number"
                  min="1"
                  max="103"
                  value={params.z}
                  onChange={(e) => handleSelectZ(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Mass Number A:</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.massNumber}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, massNumber: parseFloat(e.target.value) || 1 }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Projectile & Kinematics */}
        <div id="projectile-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Projectile & Energy
              </span>
            </div>

            {/* Projectile Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                id="btn-select-electron"
                onClick={() => setParams((prev) => ({ ...prev, projectile: -1 }))}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  params.projectile === -1
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Electron (e⁻)</span>
              </button>
              <button
                id="btn-select-positron"
                onClick={() => setParams((prev) => ({ ...prev, projectile: 1 }))}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  params.projectile === 1
                    ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Positron (e⁺)</span>
              </button>
            </div>

            {/* Kinetic Energy Input */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-slate-400">Kinetic Energy E:</label>
                <div className="flex space-x-1">
                  {(['eV', 'keV', 'MeV'] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setEnergyUnit(unit)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        energyUnit === unit
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                value={displayEnergy}
                onChange={(e) => handleEnergyChange(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Quick Energy Presets */}
            <div className="flex flex-wrap gap-1 mt-2">
              {[
                { label: '10 eV', ev: 10 },
                { label: '100 eV', ev: 100 },
                { label: '1 keV', ev: 1000 },
                { label: '10 keV', ev: 10000 },
                { label: '100 keV', ev: 100000 },
                { label: '1 MeV', ev: 1000000 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setParams((prev) => ({ ...prev, energyEv: preset.ev }))
                  }
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-slate-300 text-[10px] rounded border border-slate-700 font-mono"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Nuclear Charge Model */}
        <div id="nuclear-model-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                Nuclear Charge Model
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-[11px] text-slate-400 mb-1">Distribution Type:</label>
              <select
                value={params.nuclearModel}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, nuclearModel: e.target.value as any }))
                }
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="fermi">Fermi 2-Parameter (Smooth Density)</option>
                <option value="uniform">Uniform Sphere (R_N = 1.07 A^1/3 fm)</option>
                <option value="point">Point Charge Nucleus</option>
              </select>
            </div>

            {params.nuclearModel === 'fermi' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Half-density c (fm):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={params.fermiC || (1.07 * Math.pow(params.massNumber, 1 / 3)).toFixed(2)}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, fermiC: parseFloat(e.target.value) || 1.0 }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Skin thickness t (fm):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={params.fermiT || 0.5229}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, fermiT: parseFloat(e.target.value) || 0.5229 }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Exchange & Polarization Potentials */}
        <div id="potentials-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Exchange & Polarization
              </span>
            </div>

            <div className="mb-2">
              <label className="block text-[11px] text-slate-400 mb-1">
                Exchange Potential (Electrons):
              </label>
              <select
                disabled={params.projectile === 1}
                value={params.exchangeModel}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, exchangeModel: e.target.value as any }))
                }
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
              >
                <option value="furness-mccarthy">Furness-McCarthy Local Exchange</option>
                <option value="riley-truhlar">Riley-Truhlar Exchange</option>
                <option value="free-electron-gas">Free Electron Gas (Mittleman-Watson)</option>
                <option value="none">None (Static Electrostatic Only)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Polarizability α_d (a0³):</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.polarizability}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      polarizability: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Cutoff Radius r_c (a0):</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.cutoffRadius}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      cutoffRadius: parseFloat(e.target.value) || 1.0,
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Inelastic Absorption & Angular Grid */}
        <div id="angular-grid-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-purple-400" />
                Angular Grid & Absorption
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-[11px] text-slate-400 mb-1">Absorption Model:</label>
              <select
                value={params.absorptionModel}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, absorptionModel: e.target.value as any }))
                }
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="none">None (Pure Elastic)</option>
                <option value="staszewska-lda">Staszewska LDA Model (Inelastic Channels)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Min θ (°):</label>
                <input
                  type="number"
                  value={params.minAngle}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, minAngle: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Max θ (°):</label>
                <input
                  type="number"
                  value={params.maxAngle}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, maxAngle: parseFloat(e.target.value) || 180 }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Step Δθ (°):</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.angleStep}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, angleStep: parseFloat(e.target.value) || 1.0 }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Custom Experimental Notes & Run Metadata */}
        <div id="notes-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Experimental Notes & Metadata</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Attach custom notes, detector specs, or sample details to persist alongside this simulation run in Saved Runs Manager.
            </p>
            <textarea
              id="input-experimental-notes"
              rows={3}
              value={params.notes || ''}
              onChange={(e) => setParams((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Exp #104, 50nm Gold foil, TEM detector @ 100 keV, 300 K..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Card 7: Run Execution & Actions */}
        <div id="execution-card" className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Simulation Trigger</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Executes Dirac partial-wave solution of the radial wave equation to calculate differential cross section $d\sigma/d\Omega$ and Sherman function $S(\theta)$.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              id="btn-run-simulation"
              onClick={onRunSimulation}
              disabled={isSimulating}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSimulating ? 'Calculating Dirac Waves...' : 'Run ELSEPA Simulation'}</span>
            </button>

            <button
              id="btn-reset-params"
              onClick={() => handleSelectZ(79)}
              className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 flex items-center justify-center space-x-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Gold Benchmark</span>
            </button>
          </div>
        </div>
      </div>

      {/* Periodic Table Modal */}
      <PeriodicTableModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectZ={handleSelectZ}
        currentZ={params.z}
      />
    </div>
  );
};
