import React, { useState } from 'react';
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
import { LineChart as LineChartIcon, Play, RefreshCw } from 'lucide-react';
import { ElsepaInputParams, EnergySweepPoint } from '../types';

interface EnergySweepViewerProps {
  baseParams: ElsepaInputParams;
}

export const EnergySweepViewer: React.FC<EnergySweepViewerProps> = ({ baseParams }) => {
  const [sweepPoints, setSweepPoints] = useState<EnergySweepPoint[]>([]);
  const [isSweeping, setIsSweeping] = useState(false);

  const handleRunSweep = async () => {
    setIsSweeping(true);
    // Energies array from 10 eV to 1,000,000 eV (logarithmically spaced)
    const energies = [
      10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000,
    ];

    try {
      const res = await fetch('/api/energy-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: baseParams, energies }),
      });
      if (res.ok) {
        const data = await res.json();
        setSweepPoints(data);
      }
    } catch (err) {
      console.error('Energy sweep fetch error:', err);
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
              Computes integrated cross sections (\sigma_el, \sigma_1, \sigma_2) across kinetic energy E (10 eV to 1 MeV).
            </p>
          </div>
        </div>

        <button
          id="btn-run-energy-sweep"
          onClick={handleRunSweep}
          disabled={isSweeping}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-md font-semibold text-xs shadow-lg shadow-indigo-200 flex items-center space-x-2 disabled:opacity-50 transition-all"
        >
          {isSweeping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isSweeping ? 'Computing Spectrum...' : 'Run Energy Sweep (10 eV - 1 MeV)'}</span>
        </button>
      </div>

      {sweepPoints.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <LineChartIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-semibold">No sweep dataset generated yet.</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Click "Run Energy Sweep" above to trace cross sections across 4 orders of magnitude of electron/positron energy.
          </p>
        </div>
      ) : (
        <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sweepPoints} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="energyEv"
                scale="log"
                domain={['auto', 'auto']}
                stroke="#64748b"
                tickFormatter={(val) => (val >= 1e6 ? `${val / 1e6} MeV` : val >= 1e3 ? `${val / 1e3} keV` : `${val} eV`)}
                label={{ value: 'Kinetic Energy E (eV)', position: 'insideBottom', offset: -10, fill: '#64748b' }}
              />
              <YAxis
                scale="log"
                domain={['auto', 'auto']}
                stroke="#64748b"
                label={{ value: 'Cross Section σ (a0²)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
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
