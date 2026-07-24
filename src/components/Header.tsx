import React from 'react';
import {
  Atom,
  FlaskConical,
  UploadCloud,
  Terminal,
  Sparkles,
  Server,
  Layers,
  LineChart,
  HelpCircle,
} from 'lucide-react';
import { FortranServerStatus } from '../types';

interface HeaderProps {
  activeTab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy';
  setActiveTab: (tab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy') => void;
  fortranStatus: FortranServerStatus | null;
  onLoadPreset: (presetKey: string) => void;
}


export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fortranStatus,
  onLoadPreset,
}) => {
  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Atom className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg text-white tracking-tight">ELSEPA Physics Workbench</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full">
                  v3.0 Dirac Solver
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Elastic Scattering of Electrons & Positrons by Atoms
              </p>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="hidden md:flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-medium">Quick Preset:</span>
            <select
              id="preset-selector"
              onChange={(e) => {
                if (e.target.value) {
                  onLoadPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Load Standard Benchmark --</option>
              <option value="e-gold-100kev">e⁻ + Gold (Au) @ 100 keV (Mott Scattering)</option>
              <option value="e-argon-10ev">e⁻ + Argon (Ar) @ 10 eV (Ramsauer Minimum)</option>
              <option value="e-uranium-1mev">e⁻ + Uranium (U) @ 1 MeV (Relativistic Spin)</option>
              <option value="e+-gold-100kev">e⁺ + Gold (Au) @ 100 keV (Positron Repulsion)</option>
              <option value="e-hydrogen-100ev">e⁻ + Hydrogen (H) @ 100 eV (Standard Atomic)</option>
              <option value="e-xenon-10kev">e⁻ + Xenon (Xe) @ 10 keV (Spin Polarization)</option>
            </select>

            {/* Server Fortran Execution Badge */}
            <div
              id="fortran-status-badge"
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                fortranStatus?.hasGFortran
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}
              title={fortranStatus?.versionInfo || 'Fortran compiler status'}
            >
              <Server className="w-3.5 h-3.5" />
              <span>
                {fortranStatus?.hasGFortran ? 'gfortran Native' : 'Dirac TS Engine'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 pt-1 border-t border-slate-800/80">
          <button
            id="tab-workbench"
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'workbench'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>Atomic Workbench</span>
          </button>

          <button
            id="tab-molecular"
            onClick={() => setActiveTab('molecular')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'molecular'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Molecular Mode (ELSCATM)</span>
          </button>

          <button
            id="tab-sweep"
            onClick={() => setActiveTab('sweep')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'sweep'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Energy Spectrum Sweep</span>
          </button>

          <button
            id="tab-saved"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'saved'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Saved Runs & Comparison</span>
          </button>

          <button
            id="tab-datasets"
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'datasets'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Datasets</span>
          </button>

          <button
            id="tab-deploy"
            onClick={() => setActiveTab('deploy')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'deploy'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Fortran Source & Render Deploy</span>
          </button>
        </div>

      </div>
    </header>
  );
};
