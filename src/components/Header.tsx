import React, { useState, useEffect } from 'react';
import {
  Atom,
  FlaskConical,
  UploadCloud,
  Terminal,
  Sparkles,
  Server,
  Layers,
  LineChart,
  Sun,
  Moon,
  Smartphone,
} from 'lucide-react';
import { FortranServerStatus } from '../types';

interface HeaderProps {
  activeTab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy';
  setActiveTab: (tab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy') => void;
  fortranStatus: FortranServerStatus | null;
  onLoadPreset: (presetKey: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fortranStatus,
  onLoadPreset,
  theme,
  onToggleTheme,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };
  return (
    <header
      id="app-header"
      className={`border-b sticky top-0 z-50 shadow-md transition-colors ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 border rounded-xl ${
                theme === 'light'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                  : 'bg-indigo-600/30 border-indigo-500/40 text-indigo-400'
              }`}
            >
              <Atom className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1
                  className={`font-bold text-lg tracking-tight ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Electron Scattering Simulator
                </h1>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                    theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                  }`}
                >
                  ELSEPA v3.0
                </span>
              </div>
              <p
                className={`text-xs ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Elastic Scattering of Electrons & Positrons by Atoms
              </p>
            </div>
          </div>

          {/* Quick Preset Selector & Theme Toggle */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2">
              <span
                className={`text-xs font-medium ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Preset:
              </span>
              <select
                id="preset-selector"
                onChange={(e) => {
                  if (e.target.value) {
                    onLoadPreset(e.target.value);
                    e.target.value = '';
                  }
                }}
                className={`text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none border ${
                  theme === 'light'
                    ? 'bg-slate-50 text-slate-800 border-slate-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
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
                    ? theme === 'light'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : theme === 'light'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
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

            {/* PWA Install Button */}
            {isInstallable && (
              <button
                id="btn-install-pwa"
                onClick={handleInstallClick}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center space-x-1 transition-all animate-bounce"
                title="Install Electron Scattering Simulator as desktop/mobile app"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              id="btn-toggle-theme"
              onClick={onToggleTheme}
              className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1.5 ${
                theme === 'light'
                  ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex space-x-1 overflow-x-auto pb-2 pt-1 border-t ${
            theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          <button
            id="tab-workbench"
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'workbench'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Fortran Source & Deploy</span>
          </button>
        </div>
      </div>
    </header>
  );
};
