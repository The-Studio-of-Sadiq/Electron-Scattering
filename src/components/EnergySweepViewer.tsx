import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { LineChart as LineChartIcon, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { ElsepaInputParams, EnergySweepPoint } from '../types';
import { LaTeXText } from './LaTeX';
import {
  DEFAULT_SWEEP_ENERGIES,
  logGrid,
  parseEnergyList,
  validateEnergies,
} from '../physics/energyGrid';

interface EnergySweepViewerProps {
  baseParams: ElsepaInputParams;
  enginePreference?: 'gfortran' | 'typescript';
}

type GridMode = 'default' | 'log' | 'custom';

export const EnergySweepViewer: React.FC<EnergySweepViewerProps> = ({
  baseParams,
  enginePreference = 'gfortran',
}) => {
  const [sweepPoints, setSweepPoints] = useState<EnergySweepPoint[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);

  const [gridMode, setGridMode] = useState<GridMode>('default');
  const [minEv, setMinEv] = useState<number>(10);
  const [maxEv, setMaxEv] = useState<number>(1000000);
  const [numPoints, setNumPoints] = useState<number>(16);
  const [customListText, setCustomListText] = useState<string>(
    '10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000'
  );

  const validationResult = useMemo(() => {
    if (gridMode === 'default') {
      return validateEnergies(DEFAULT_SWEEP_ENERGIES);
    }
    if (gridMode === 'log') {
      if (!Number.isFinite(minEv) || !Number.isFinite(maxEv) || !Number.isFinite(numPoints)) {
        return { energies: [], errors: ['Emin, Emax, and number of points must be valid numbers.'] };
      }
      if (minEv <= 0 || maxEv <= 0) {
        return { energies: [], errors: ['Emin and Emax must be strictly positive.'] };
      }
      if (minEv >= maxEv) {
        return { energies: [], errors: [`Emin (${minEv} eV) must be less than Emax (${maxEv} eV).`] };
      }
      if (numPoints < 1 || !Number.isInteger(numPoints)) {
        return { energies: [], errors: ['Number of points must be a positive integer.'] };
      }
      try {
        const grid = logGrid(minEv, maxEv, numPoints);
        return validateEnergies(grid);
      } catch (err: any) {
        return { energies: [], errors: [err?.message || 'Failed to compute logarithmic grid.'] };
      }
    }
    // gridMode === 'custom'
    const parsed = parseEnergyList(customListText);
    return validateEnergies(parsed);
  }, [gridMode, minEv, maxEv, numPoints, customListText]);

  const formatEnergy = (ev: number): string => {
    if (ev >= 1e6) return `${(ev / 1e6).toPrecision(4).replace(/\.?0+$/, '')} MeV`;
    if (ev >= 1e3) return `${(ev / 1e3).toPrecision(4).replace(/\.?0+$/, '')} keV`;
    return `${ev} eV`;
  };

  const previewString = useMemo(() => {
    const list = validationResult.energies;
    if (list.length === 0) return 'No valid energy points';
    if (list.length <= 6) {
      return list.map(formatEnergy).join(', ');
    }
    const first3 = list.slice(0, 3).map(formatEnergy).join(', ');
    const last3 = list.slice(-3).map(formatEnergy).join(', ');
    return `${first3}, … (${list.length - 6} more) …, ${last3}`;
  }, [validationResult.energies]);

  const isInvalid = validationResult.errors.length > 0 || validationResult.energies.length === 0;
  const isCustomDensityMissing =
    baseParams.densityModel === 'custom-file' && !baseParams.customDensityData;

  const handleRunSweep = async () => {
    if (isInvalid || isCustomDensityMissing) return;
    setIsSweeping(true);
    setSweepError(null);

    try {
      const res = await fetch('/api/energy-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { ...baseParams, forceEngine: enginePreference },
          energies: validationResult.energies,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Energy sweep failed (${res.status})`);
      setSweepPoints(data);
    } catch (err: any) {
      console.error('Energy sweep fetch error:', err);
      setSweepError(err?.message || 'Energy sweep failed');
    } finally {
      setIsSweeping(false);
    }
  };

  return (
    <div id="energy-sweep-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-2">
          <LineChartIcon className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-bold text-base text-slate-800">Energy Spectrum Cross Section Sweep</h3>
            <p className="text-xs text-slate-500">
              <LaTeXText text="Computes integrated cross sections ($\sigma_{\text{el}}$, $\sigma_1$, $\sigma_2$) across kinetic energy $E$." />
            </p>
          </div>
        </div>

        <button
          id="btn-run-energy-sweep"
          onClick={handleRunSweep}
          disabled={isSweeping || isInvalid || isCustomDensityMissing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-md font-semibold text-xs shadow-lg shadow-indigo-200 flex items-center space-x-2 disabled:opacity-50 transition-all"
        >
          {isSweeping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>
            {isSweeping
              ? 'Computing Spectrum...'
              : `Run Energy Sweep (${validationResult.energies.length} ${validationResult.energies.length === 1 ? 'energy' : 'energies'})`}
          </span>
        </button>
      </div>

      {/* Grid Configuration Controls */}
      <div id="energy-grid-controls" className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">Grid Selection:</span>
          <div className="flex flex-wrap gap-1.5" id="grid-mode-selector">
            <button
              type="button"
              onClick={() => setGridMode('default')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                gridMode === 'default'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Default (16 energies, 10 eV - 1 MeV)
            </button>
            <button
              type="button"
              onClick={() => setGridMode('log')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                gridMode === 'log'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Logarithmic range
            </button>
            <button
              type="button"
              onClick={() => setGridMode('custom')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                gridMode === 'custom'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Custom list
            </button>
          </div>
        </div>

        {gridMode === 'log' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-200">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Emin (eV, ≥ 10):
              </label>
              <input
                id="input-sweep-emin"
                type="number"
                min="10"
                max="1000000000"
                value={minEv}
                onChange={(e) => setMinEv(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Emax (eV, ≤ 1e9):
              </label>
              <input
                id="input-sweep-emax"
                type="number"
                min="10"
                max="1000000000"
                value={maxEv}
                onChange={(e) => setMaxEv(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Number of points (1–100):
              </label>
              <input
                id="input-sweep-npoints"
                type="number"
                min="1"
                max="100"
                value={numPoints}
                onChange={(e) => setNumPoints(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        )}

        {gridMode === 'custom' && (
          <div className="pt-2.5 border-t border-slate-200">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Custom Energy List (separated by commas, spaces, semicolons, or newlines):
            </label>
            <textarea
              id="textarea-sweep-energies"
              rows={3}
              value={customListText}
              onChange={(e) => setCustomListText(e.target.value)}
              placeholder="e.g. 10, 25, 50, 100, 250, 500, 1e3, 5e3, 1e4, 1e5"
              className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Supports standard decimals and exponential format (e.g. 1e3, 2.5e4, 1E6). Limits: 10 eV to 1e9 eV (1 GeV), 1 to 100 points.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="font-semibold">Grid Preview:</span>
            <span className="font-mono bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
              {validationResult.energies.length} {validationResult.energies.length === 1 ? 'point' : 'points'}
            </span>
            <span className="text-slate-500 truncate max-w-md" title={previewString}>
              ({previewString})
            </span>
          </div>
        </div>

        {validationResult.errors.length > 0 && (
          <div id="grid-validation-errors" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              {validationResult.errors.map((err, i) => (
                <span key={i}>{err}</span>
              ))}
            </div>
          </div>
        )}

        {isCustomDensityMissing && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2 text-xs">
            * Please upload a custom electron density table in the main parameters above before running the energy sweep.
          </div>
        )}
      </div>

      {sweepError && (
        <div id="energy-sweep-error" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-4 py-2.5 text-xs">
          {sweepError}
        </div>
      )}

      {sweepPoints.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <LineChartIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-semibold">No sweep dataset generated yet.</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Click "Run Energy Sweep" above to trace cross sections across energy points.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sweepPoints} margin={{ top: 15, right: 30, left: 60, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="energyEv"
                scale="log"
                domain={['auto', 'auto']}
                stroke="#64748b"
                tickFormatter={(val) => (val >= 1e6 ? `${val / 1e6} MeV` : val >= 1e3 ? `${val / 1e3} keV` : `${val} eV`)}
                label={{ value: 'Kinetic Energy E (eV)', position: 'insideBottom', offset: -15, fill: '#64748b' }}
              />
              <YAxis
                scale="log"
                domain={['auto', 'auto']}
                stroke="#64748b"
                label={{ value: 'Cross Section σ (a0²)', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle' }, fill: '#64748b' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => [typeof val === 'number' ? val.toFixed(3) : val, 'a0²']}
                labelFormatter={(e) => `Energy E = ${e} eV`}
              />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
              <Line type="monotone" dataKey="sigmaElAu" name="Total Elastic σ_el" stroke="#4f46e5" strokeWidth={2.5} dot={true} />
              <Line type="monotone" dataKey="sigma1Au" name="1st Transport σ_1 (Momentum)" stroke="#10b981" strokeWidth={2} dot={true} />
              <Line type="monotone" dataKey="sigma2Au" name="2nd Transport σ_2 (Viscosity)" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="3 3" dot={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
