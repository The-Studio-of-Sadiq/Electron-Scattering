import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  Download,
  Upload,
  Play,
  Layers,
  Sparkles,
  Check,
  FileJson,
  X,
  Search,
  CheckSquare,
  Square,
  Plus,
  Percent,
  ArrowRightLeft,
  FileText,
  Copy,
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
import { SavedSimulationRun } from '../types';
import { MathTex, LaTeXText } from './LaTeX';
import {
  getSavedSimulations,
  deleteSavedSimulationRun,
  clearAllSavedSimulationRuns,
  exportSavedRunsJSON,
  importSavedRunsJSON,
  saveAtomicSimulationRun,
  saveMolecularSimulationRun,
} from '../utils/localStorage';
import { getElementByZ } from '../data/elements';

interface SavedRunsManagerProps {
  onLoadRunToActiveView?: (run: SavedSimulationRun) => void;
  onCloneToWorkbench?: (run: SavedSimulationRun) => void;
}

const LINE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const SavedRunsManager: React.FC<SavedRunsManagerProps> = ({
  onLoadRunToActiveView,
  onCloneToWorkbench,
}) => {
  const [runs, setRuns] = useState<SavedSimulationRun[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showLogScale, setShowLogScale] = useState<boolean>(true);
  const [plotVariable, setPlotVariable] = useState<'dcs' | 'sherman'>('dcs');
  const [compareMode, setCompareMode] = useState<'overlay' | 'percent-diff'>('overlay');

  // Batch simulation drawer state
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);
  const [batchType, setBatchType] = useState<'atomic-elements' | 'atomic-energies'>('atomic-elements');
  const [batchZList, setBatchZList] = useState<number[]>([6, 26, 79, 92]); // C, Fe, Au, U
  const [batchEnergy, setBatchEnergy] = useState<number>(100000); // 100 keV
  const [batchZSingle, setBatchZSingle] = useState<number>(79); // Au
  const [batchEnergiesList, setBatchEnergiesList] = useState<number[]>([1000, 10000, 100000, 1000000]); // 1 keV to 1 MeV
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  useEffect(() => {
    refreshRuns();
  }, []);

  const refreshRuns = () => {
    const list = getSavedSimulations();
    setRuns(list);
    // Auto-select first 3 if none selected
    if (selectedRunIds.length === 0 && list.length > 0) {
      setSelectedRunIds(list.slice(0, 3).map((r) => r.id));
    }
  };

  const handleToggleSelectRun = (id: string) => {
    if (selectedRunIds.includes(id)) {
      setSelectedRunIds(selectedRunIds.filter((rId) => rId !== id));
    } else {
      if (selectedRunIds.length >= 6) {
        alert('You can compare up to 6 simulation runs simultaneously.');
        return;
      }
      setSelectedRunIds([...selectedRunIds, id]);
    }
  };

  const handleDeleteRun = (id: string) => {
    const updated = deleteSavedSimulationRun(id);
    setRuns(updated);
    setSelectedRunIds(selectedRunIds.filter((rId) => rId !== id));
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all saved simulation runs from local storage?')) {
      clearAllSavedSimulationRuns();
      setRuns([]);
      setSelectedRunIds([]);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = exportSavedRunsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elsepa_saved_simulations_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const updated = importSavedRunsJSON(content);
        setRuns(updated);
        alert(`Successfully imported saved simulation runs! Total: ${updated.length}`);
      }
    };
    reader.readAsText(file);
  };

  // Run Batch Simulation
  const handleRunBatch = async () => {
    setIsBatchRunning(true);

    if (batchType === 'atomic-elements') {
      const total = batchZList.length;
      setBatchProgress({ current: 0, total });

      for (let i = 0; i < total; i++) {
        const z = batchZList[i];
        const el = getElementByZ(z);
        const params = {
          z,
          projectile: -1,
          energyEv: batchEnergy,
          massNumber: el.atomicMass,
          nuclearModel: 'fermi' as const,
          densityModel: 'dirac-fock' as const,
          exchangeModel: 'furness-mccarthy' as const,
          polarizationModel: 'buckingham' as const,
          polarizability: el.polarizability,
          cutoffRadius: el.cutoffRadius,
          absorptionModel: 'none' as const,
          minAngle: 0,
          maxAngle: 180,
          angleStep: 1,
        };

        try {
          const res = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          if (res.ok) {
            const data = await res.json();
            saveAtomicSimulationRun(data, `Batch: ${el.name} (Z=${z}) @ ${batchEnergy >= 1000 ? `${batchEnergy / 1000} keV` : `${batchEnergy} eV`}`);
          }
        } catch (e) {
          console.error(`Batch simulation error for Z=${z}:`, e);
        }
        setBatchProgress({ current: i + 1, total });
      }
    } else {
      // atomic-energies
      const total = batchEnergiesList.length;
      setBatchProgress({ current: 0, total });
      const el = getElementByZ(batchZSingle);

      for (let i = 0; i < total; i++) {
        const energyEv = batchEnergiesList[i];
        const params = {
          z: batchZSingle,
          projectile: -1,
          energyEv,
          massNumber: el.atomicMass,
          nuclearModel: 'fermi' as const,
          densityModel: 'dirac-fock' as const,
          exchangeModel: 'furness-mccarthy' as const,
          polarizationModel: 'buckingham' as const,
          polarizability: el.polarizability,
          cutoffRadius: el.cutoffRadius,
          absorptionModel: 'none' as const,
          minAngle: 0,
          maxAngle: 180,
          angleStep: 1,
        };

        try {
          const res = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          if (res.ok) {
            const data = await res.json();
            saveAtomicSimulationRun(data, `Batch: ${el.name} @ ${energyEv >= 1000 ? `${energyEv / 1000} keV` : `${energyEv} eV`}`);
          }
        } catch (e) {
          console.error(`Batch simulation error for energy ${energyEv}:`, e);
        }
        setBatchProgress({ current: i + 1, total });
      }
    }

    setIsBatchRunning(false);
    setIsBatchOpen(false);
    refreshRuns();
  };

  // Build merged comparison chart data
  const selectedRuns = runs.filter((r) => selectedRunIds.includes(r.id));

  // Construct 181 angle points (0..180)
  const comparisonChartData = Array.from({ length: 181 }, (_, angleDeg) => {
    const point: any = { angleDeg };

    selectedRuns.forEach((run, idx) => {
      if (run.type === 'atomic' && run.atomicResult) {
        const pt = run.atomicResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
        if (pt) {
          point[`run_${run.id}`] = plotVariable === 'dcs' ? pt.dcsCm2 : pt.shermanS;
        }
      } else if (run.type === 'molecular' && run.molecularResult) {
        const pt = run.molecularResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
        if (pt) {
          point[`run_${run.id}`] = plotVariable === 'dcs' ? pt.dcsCohCm2 : pt.shermanS;
        }
      }
    });

    return point;
  });

  // Helper for percent difference calculation
  const calcPctDiff = (valA: number, valB: number): number => {
    if (valA === 0 && valB === 0) return 0;
    const base = Math.abs(valA) > 0 ? Math.abs(valA) : (Math.abs(valA) + Math.abs(valB)) / 2;
    if (base === 0) return 0;
    return (Math.abs(valB - valA) / base) * 100;
  };

  // Build percent difference chart & metrics if 2 runs are selected
  const pctDiffChartData = Array.from({ length: 181 }, (_, angleDeg) => {
    if (selectedRuns.length < 2) return { angleDeg, dcsA: 0, dcsB: 0, absDiff: 0, pctDiff: 0 };

    const runA = selectedRuns[0];
    const runB = selectedRuns[1];

    let dcsA = 0;
    let dcsB = 0;

    if (runA.type === 'atomic' && runA.atomicResult) {
      const pt = runA.atomicResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
      if (pt) dcsA = pt.dcsCm2;
    } else if (runA.type === 'molecular' && runA.molecularResult) {
      const pt = runA.molecularResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
      if (pt) dcsA = pt.dcsCohCm2;
    }

    if (runB.type === 'atomic' && runB.atomicResult) {
      const pt = runB.atomicResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
      if (pt) dcsB = pt.dcsCm2;
    } else if (runB.type === 'molecular' && runB.molecularResult) {
      const pt = runB.molecularResult.scatteringData.find((s) => Math.round(s.angleDeg) === angleDeg);
      if (pt) dcsB = pt.dcsCohCm2;
    }

    const absDiff = Math.abs(dcsB - dcsA);
    const pctDiff = calcPctDiff(dcsA, dcsB);

    return {
      angleDeg,
      dcsA,
      dcsB,
      absDiff,
      pctDiff,
    };
  });

  const meanPctDiff =
    pctDiffChartData.reduce((acc, curr) => acc + curr.pctDiff, 0) / (pctDiffChartData.length || 1);

  const filteredRuns = runs.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q)) ||
      (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div id="saved-runs-manager-container" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Local State Storage & Comparison Manager</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Simulation History, Overlay Comparison & Batch Solver
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-3xl">
            All successful simulation runs are saved locally in your browser storage. Toggle multiple runs to overlay their Differential Cross Section (DCS) curves or calculate side-by-side percent differences between models.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            id="open-batch-modal-btn"
            onClick={() => setIsBatchOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow flex items-center space-x-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Batch Simulations</span>
          </button>

          <button
            id="export-runs-json-btn"
            onClick={handleExportJSON}
            disabled={runs.length === 0}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>

          <label className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Side-by-Side Comparison & Percent Difference Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Simulation Run Comparison ({selectedRuns.length} Selected)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select checkable items in the history table below to compare curves or calculate percent differences.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                id="tab-mode-overlay"
                onClick={() => setCompareMode('overlay')}
                className={`px-3 py-1.5 font-bold rounded-md transition-all flex items-center gap-1 ${
                  compareMode === 'overlay' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Overlay Chart</span>
              </button>
              <button
                id="tab-mode-percent-diff"
                onClick={() => setCompareMode('percent-diff')}
                className={`px-3 py-1.5 font-bold rounded-md transition-all flex items-center gap-1 ${
                  compareMode === 'percent-diff' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>% Difference Matrix</span>
              </button>
            </div>

            {compareMode === 'overlay' && (
              <>
                <button
                  onClick={() => setPlotVariable(plotVariable === 'dcs' ? 'sherman' : 'dcs')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
                >
                  <span>Showing: </span>
                  {plotVariable === 'dcs' ? (
                    <>
                      <span>DCS </span>
                      <MathTex math="\frac{d\sigma}{d\Omega}" />
                      <span>(cm²/sr)</span>
                    </>
                  ) : (
                    <span>Sherman Function S(θ)</span>
                  )}
                </button>

                {plotVariable === 'dcs' && (
                  <button
                    onClick={() => setShowLogScale(!showLogScale)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition-colors"
                  >
                    {showLogScale ? 'Log Scale (Y)' : 'Linear Scale'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {selectedRuns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs">
            No simulation runs selected for comparison. Please check 1 or more runs from the list below.
          </div>
        ) : compareMode === 'overlay' ? (
          <div className="h-96 w-full bg-slate-50/50 p-2 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonChartData} margin={{ top: 20, right: 30, left: 65, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="angleDeg"
                  label={{ value: 'Scattering Angle θ (deg)', position: 'insideBottom', offset: -20, fill: '#475569', style: { fontSize: '13px', fontWeight: 600 } }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  scale={plotVariable === 'dcs' && showLogScale ? 'log' : 'linear'}
                  domain={plotVariable === 'dcs' && showLogScale ? ['auto', 'auto'] : [-1, 1]}
                  tickFormatter={(val) => (plotVariable === 'dcs' ? val.toExponential(1) : val.toFixed(2))}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: plotVariable === 'dcs' ? 'dσ/dΩ (cm²/sr)' : 'Sherman S(θ)',
                    angle: -90,
                    position: 'insideLeft',
                    dx: -25,
                    style: { textAnchor: 'middle', fontSize: '13px', fontWeight: 600 },
                    fill: '#475569'
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    color: '#000000',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
                    padding: '10px 14px',
                  }}
                  labelStyle={{ color: '#000000', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}
                  itemStyle={{ color: '#000000', fontWeight: 600, fontSize: '12px' }}
                  formatter={(val: number) => [
                    plotVariable === 'dcs' ? `${val.toExponential(4)} cm²/sr` : val.toFixed(4),
                    '',
                  ]}
                  labelFormatter={(label) => `Angle θ: ${label}°`}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '15px', fontSize: '13px' }} />
                {selectedRuns.map((run, idx) => {
                  const isDuplicateTitle = selectedRuns.filter(r => r.title === run.title).length > 1;
                  const timeStr = new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const runDisplayName = isDuplicateTitle
                    ? `[Run #${idx + 1}] ${run.title} (${timeStr})`
                    : selectedRuns.length > 1
                    ? `[Run #${idx + 1}] ${run.title}`
                    : run.title;

                  return (
                    <Line
                      key={run.id}
                      type="monotone"
                      dataKey={`run_${run.id}`}
                      name={runDisplayName}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : selectedRuns.length < 2 ? (
          <div className="p-12 text-center text-slate-500 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-medium">
            Please check exactly 2 simulation runs in the table below to calculate percent differences between them.
          </div>
        ) : (
          /* Side-by-Side % Difference Matrix View */
          <div className="space-y-5">
            {/* Run Headers Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Run A (Baseline)</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{selectedRuns[0].title}</div>
                {selectedRuns[0].notes && (
                  <div className="text-xs text-indigo-900 bg-white/80 border border-indigo-200 rounded p-2 mt-2 italic flex items-start gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{selectedRuns[0].notes}</span>
                  </div>
                )}
              </div>

              <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Run B (Comparison Target)</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{selectedRuns[1].title}</div>
                {selectedRuns[1].notes && (
                  <div className="text-xs text-teal-900 bg-white/80 border border-teal-200 rounded p-2 mt-2 italic flex items-start gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{selectedRuns[1].notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Percent Difference Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50 p-4">
              <h4 className="font-bold text-xs uppercase text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span>Integrated Quantities & Percent Difference Summary</span>
              </h4>

              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-200/80 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5">Physics Quantity</th>
                    <th className="p-2.5 text-indigo-900">Run A Value</th>
                    <th className="p-2.5 text-teal-900">Run B Value</th>
                    <th className="p-2.5">Absolute Delta |B - A|</th>
                    <th className="p-2.5">% Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(() => {
                    const runA = selectedRuns[0];
                    const runB = selectedRuns[1];

                    const sigElA = runA.atomicResult?.summary.sigmaElCm2 || runA.molecularResult?.summary.sigmaCohCm2 || 0;
                    const sigElB = runB.atomicResult?.summary.sigmaElCm2 || runB.molecularResult?.summary.sigmaCohCm2 || 0;
                    const pctSigEl = calcPctDiff(sigElA, sigElB);

                    const sig1A = runA.atomicResult?.summary.sigma1Au || 0;
                    const sig1B = runB.atomicResult?.summary.sigma1Au || 0;
                    const pctSig1 = calcPctDiff(sig1A, sig1B);

                    const sig2A = runA.atomicResult?.summary.sigma2Au || 0;
                    const sig2B = runB.atomicResult?.summary.sigma2Au || 0;
                    const pctSig2 = calcPctDiff(sig2A, sig2B);

                    return (
                      <>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-800 flex items-center gap-1">
                            <span>Total Elastic Cross Section</span>
                            <MathTex math="\sigma_{\text{el}}" />
                            <span>(<MathTex math="\text{cm}^2" />)</span>
                          </td>
                          <td className="p-2.5 font-bold text-indigo-700">{sigElA.toExponential(3)}</td>
                          <td className="p-2.5 font-bold text-teal-700">{sigElB.toExponential(3)}</td>
                          <td className="p-2.5">{Math.abs(sigElB - sigElA).toExponential(3)}</td>
                          <td className={`p-2.5 font-bold ${pctSigEl > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {pctSigEl.toFixed(2)} %
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-800 flex items-center gap-1">
                            <span>1st Transport CS</span>
                            <MathTex math="\sigma_1" />
                            <span>(<MathTex math="a_0^2" />) [Momentum]</span>
                          </td>
                          <td className="p-2.5 font-bold text-indigo-700">{sig1A.toFixed(3)}</td>
                          <td className="p-2.5 font-bold text-teal-700">{sig1B.toFixed(3)}</td>
                          <td className="p-2.5">{Math.abs(sig1B - sig1A).toFixed(3)}</td>
                          <td className={`p-2.5 font-bold ${pctSig1 > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {pctSig1.toFixed(2)} %
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-800 flex items-center gap-1">
                            <span>2nd Transport CS</span>
                            <MathTex math="\sigma_2" />
                            <span>(<MathTex math="a_0^2" />) [Viscosity]</span>
                          </td>
                          <td className="p-2.5 font-bold text-indigo-700">{sig2A.toFixed(3)}</td>
                          <td className="p-2.5 font-bold text-teal-700">{sig2B.toFixed(3)}</td>
                          <td className="p-2.5">{Math.abs(sig2B - sig2A).toFixed(3)}</td>
                          <td className={`p-2.5 font-bold ${pctSig2 > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {pctSig2.toFixed(2)} %
                          </td>
                        </tr>

                        <tr className="bg-indigo-50/40">
                          <td className="p-2.5 font-sans font-bold text-slate-900">Mean Angular Spectrum % Difference</td>
                          <td className="p-2.5 text-slate-500">-</td>
                          <td className="p-2.5 text-slate-500">-</td>
                          <td className="p-2.5 text-slate-500">-</td>
                          <td className={`p-2.5 font-black text-sm ${meanPctDiff > 15 ? 'text-rose-600' : 'text-indigo-700'}`}>
                            {meanPctDiff.toFixed(2)} %
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Angular Percent Difference Line Chart */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase text-slate-700 tracking-wider">
                Angular Percent Difference Spectrum % Diff(θ) vs Scattering Angle
              </h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pctDiffChartData} margin={{ top: 15, right: 30, left: 60, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis
                      dataKey="angleDeg"
                      label={{ value: 'Scattering Angle θ (deg)', position: 'insideBottom', offset: -15, fill: '#64748b' }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      label={{ value: '% Difference in DCS', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle' }, fill: '#64748b' }}
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val.toFixed(2)} %`, '% Difference']}
                      labelFormatter={(label) => `Angle θ: ${label}°`}
                    />
                    <Line
                      type="monotone"
                      dataKey="pctDiff"
                      name="% Difference"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved Runs Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-3">
            <h3 className="font-bold text-slate-800 text-base">
              Saved Runs History ({runs.length})
            </h3>
            {runs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by element, tag, notes..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No saved simulation runs match your search filter or no history exists yet. Run a simulation from the Atomic or Molecular workbench to automatically record history here.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3 w-10 text-center">Compare</th>
                  <th className="p-3">Title & Run Info</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Beam Energy</th>
                  <th className="p-3">Total Elastic CS</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRuns.map((run) => {
                  const isSelected = selectedRunIds.includes(run.id);

                  let energyStr = 'N/A';
                  let totalCsStr = 'N/A';

                  if (run.type === 'atomic' && run.atomicResult) {
                    const ev = run.atomicResult.params.energyEv;
                    energyStr = ev >= 1000 ? `${(ev / 1000).toFixed(1)} keV` : `${ev} eV`;
                    totalCsStr = `${run.atomicResult.summary.sigmaElCm2.toExponential(2)} cm²`;
                  } else if (run.type === 'molecular' && run.molecularResult) {
                    const ev = run.molecularResult.params.energyEv;
                    energyStr = ev >= 1000 ? `${(ev / 1000).toFixed(1)} keV` : `${ev} eV`;
                    totalCsStr = `${run.molecularResult.summary.sigmaCohCm2.toExponential(2)} cm²`;
                  }

                  return (
                    <tr
                      key={run.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleSelectRun(run.id)}
                          className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 fill-indigo-100" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </button>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-xs">{run.title}</div>
                        {run.notes && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded px-2 py-0.5 mt-1 font-sans italic flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate max-w-xs">{run.notes}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {run.tags?.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            run.type === 'atomic'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {run.type}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-slate-800 font-bold">{energyStr}</td>
                      <td className="p-3 font-mono text-indigo-700 font-bold">{totalCsStr}</td>

                      <td className="p-3 text-[11px] text-slate-400">
                        {new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            id={`btn-clone-run-${run.id}`}
                            onClick={() => onCloneToWorkbench?.(run)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 font-bold rounded-md text-[11px] flex items-center space-x-1 transition-all shadow-sm"
                            title="Load this run's exact parameters into the Atomic/Molecular Workbench"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Clone to Workbench</span>
                          </button>
                          <button
                            onClick={() => handleDeleteRun(run.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete run"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Simulation Modal */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-slate-900">Batch Simulation Runner</h3>
              </div>
              <button
                onClick={() => setIsBatchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Mode Selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBatchType('atomic-elements')}
                className={`p-3 rounded-lg border text-left text-xs font-bold transition-all ${
                  batchType === 'atomic-elements'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Batch Elements (Multi Z)
                <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                  Run multiple elements at a single beam energy
                </div>
              </button>

              <button
                onClick={() => setBatchType('atomic-energies')}
                className={`p-3 rounded-lg border text-left text-xs font-bold transition-all ${
                  batchType === 'atomic-energies'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Batch Energies (Energy Spectrum)
                <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                  Run a single element across multiple energies
                </div>
              </button>
            </div>

            {batchType === 'atomic-elements' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Beam Kinetic Energy (eV)</label>
                  <input
                    type="number"
                    value={batchEnergy}
                    onChange={(e) => setBatchEnergy(parseFloat(e.target.value) || 100000)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Selected Atomic Numbers (Z)
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {batchZList.map((z) => {
                      const el = getElementByZ(z);
                      return (
                        <span
                          key={z}
                          className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-md text-xs font-bold flex items-center space-x-1"
                        >
                          <span>
                            {el.name} (Z={z})
                          </span>
                          <button
                            onClick={() => setBatchZList(batchZList.filter((item) => item !== z))}
                            className="text-indigo-500 hover:text-indigo-900 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Add Element by Atomic Number Z (1..103)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={1}
                      max={103}
                      id="batch-add-z-input"
                      placeholder="e.g. 79 (Au), 92 (U)"
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (val >= 1 && val <= 103 && !batchZList.includes(val)) {
                            setBatchZList([...batchZList, val]);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Element Z (1..103)</label>
                  <input
                    type="number"
                    value={batchZSingle}
                    onChange={(e) => setBatchZSingle(parseInt(e.target.value) || 79)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  />
                  <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Target: {getElementByZ(batchZSingle).name} ({getElementByZ(batchZSingle).symbol})
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Energies List (eV)</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {batchEnergiesList.map((ev, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-mono font-bold flex items-center space-x-1"
                      >
                        <span>{ev >= 1000 ? `${ev / 1000} keV` : `${ev} eV`}</span>
                        <button
                          onClick={() => setBatchEnergiesList(batchEnergiesList.filter((_, i) => i !== idx))}
                          className="text-emerald-500 hover:text-emerald-900 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {isBatchRunning && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Executing Fortran batch...</span>
                  <span>
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsBatchOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                id="start-batch-run-btn"
                onClick={handleRunBatch}
                disabled={isBatchRunning}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center space-x-2 disabled:opacity-50"
              >
                {isBatchRunning ? (
                  <span>Running Batch...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run Batch in Fortran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
