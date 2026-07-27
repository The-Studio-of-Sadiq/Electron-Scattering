import React, { useState, useEffect } from 'react';
import {
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
import { ElectronScatteringLogo } from './Logo';

interface HeaderProps {
  activeTab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy';
  setActiveTab: (tab: 'workbench' | 'molecular' | 'sweep' | 'saved' | 'datasets' | 'deploy') => void;
  fortranStatus: FortranServerStatus | null;
  onLoadPreset: (presetKey: string) => void;
  activePresetKey: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fortranStatus,
  onLoadPreset,
  activePresetKey,
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-2 sm:py-2.5 lg:py-0 min-h-[4rem] gap-2 lg:gap-4">
          {/* Top Bar: Logo & Title */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center space-x-2.5">
              <ElectronScatteringLogo size={38} theme={theme} />
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <h1
                    className={`font-bold text-sm sm:text-base lg:text-lg tracking-tight leading-tight ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    Electron Scattering Simulator
                  </h1>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border shrink-0 ${
                      theme === 'light'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    }`}
                  >
                    v3.0
                  </span>
                </div>
                <p
                  className={`text-[10px] sm:text-xs hidden xs:block ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Dirac Elastic Scattering • Dept. of ECE & CSE, HSTU
                </p>
              </div>
            </div>

            {/* Controls for Mobile (Install & Theme) */}
            <div className="flex items-center space-x-1.5 lg:hidden">
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="px-2 py-1 bg-indigo-600 text-white font-bold text-[10px] sm:text-xs rounded-lg flex items-center space-x-1"
                >
                  <Smartphone className="w-3 h-3" />
                  <span className="hidden xs:inline">Install</span>
                </button>
              )}
              <button
                id="btn-toggle-theme-mobile"
                onClick={onToggleTheme}
                className={`p-1.5 rounded-lg border text-xs font-bold ${
                  theme === 'light'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
                title="Toggle Dark/Light Mode"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              </button>
            </div>
          </div>

          {/* Controls & Preset Dropdown */}
          <div className="flex items-center justify-between lg:justify-end space-x-2 w-full lg:w-auto">
            <div className="flex items-center space-x-2 flex-1 lg:flex-initial">
              <span
                className={`text-[11px] sm:text-xs font-medium shrink-0 hidden sm:inline ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Preset:
              </span>
              <select
                id="preset-selector"
                value={activePresetKey}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== 'custom') {
                    onLoadPreset(e.target.value);
                  }
                }}
                className={`text-xs rounded-lg px-2 sm:px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none border w-full sm:w-auto max-w-[280px] sm:max-w-xs font-medium ${
                  theme === 'light'
                    ? 'bg-slate-50 text-slate-800 border-slate-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                <option value="custom">-- Custom Parameters --</option>
                <option value="e-gold-100kev">e⁻ + Gold (Au) @ 100 keV (Mott Scattering)</option>
                <option value="e-argon-10ev">e⁻ + Argon (Ar) @ 10 eV (Ramsauer Minimum)</option>
                <option value="e-uranium-1mev">e⁻ + Uranium (U) @ 1 MeV (Relativistic Spin)</option>
                <option value="e+-gold-100kev">e⁺ + Gold (Au) @ 100 keV (Positron Repulsion)</option>
                <option value="e-hydrogen-100ev">e⁻ + Hydrogen (H) @ 100 eV (Standard Atomic)</option>
                <option value="e-xenon-10kev">e⁻ + Xenon (Xe) @ 10 keV (Spin Polarization)</option>
              </select>
            </div>

            <div className="hidden lg:flex items-center space-x-2">
              {/* Fortran Status Badge */}
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
        </div>

        {/* Navigation Tabs */}
        <nav
          className={`flex space-x-1 overflow-x-auto pb-2 pt-1.5 border-t -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none ${
            theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
          }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            id="tab-workbench"
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'workbench'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Atomic Workbench</span>
          </button>

          <button
            id="tab-molecular"
            onClick={() => setActiveTab('molecular')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'molecular'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Molecular Mode</span>
          </button>

          <button
            id="tab-sweep"
            onClick={() => setActiveTab('sweep')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sweep'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Energy Spectrum Sweep</span>
          </button>

          <button
            id="tab-saved"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'saved'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>Saved Runs & Comparison</span>
          </button>

          <button
            id="tab-datasets"
            onClick={() => setActiveTab('datasets')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'datasets'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Upload Datasets</span>
          </button>

          <button
            id="tab-deploy"
            onClick={() => setActiveTab('deploy')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'deploy'
                ? 'bg-indigo-600 text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Fortran Source & Deploy</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
