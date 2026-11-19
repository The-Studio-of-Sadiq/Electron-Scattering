import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Atom,
  Upload,
  Download,
  Send,
  Undo2,
  Redo2,
  RotateCcw,
  Sliders,
  Scissors,
  Sparkles,
  Layers,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ElsepaInputParams, ElementData } from '../types';
import { PERIODIC_ELEMENTS_NAMES, getElementByZ } from '../data/elements';
import {
  DensityPoint,
  DensityStats,
  calculateDensityStats,
  normalizeDensity,
  ionizeDensity,
  radialScaleDensity,
  truncateDensity,
  smoothDensity,
  mixDensities,
  dragEditDensity,
  formatDensityForElsepa,
  parseTextToDensityPoints,
} from '../physics/densityTools';
import { parseDensityFile, checkElectronCountWarning, MIN_DENSITY_POINTS, MAX_DENSITY_POINTS } from '../physics/densityFile';
import { fetchElsepaModelDensity } from '../physics/elsepaWasm';
import { DensityPlot, PlotMode } from './DensityPlot';

export interface DensityEditorState {
  currentPoints: DensityPoint[];
  originalPoints: DensityPoint[];
  history: DensityPoint[][];
  future: DensityPoint[][];
  sourceName: string;
  sourceType: 'model' | 'upload' | 'workbench';
  sourceZ: number;
  sourceQ: number;
  sourceModel: 'dirac-fock' | 'thomas-fermi' | 'thomas-fermi-dirac' | 'dhfs';
  appliedEdits: string[];
}

interface DensityEditorProps {
  params: ElsepaInputParams;
  setParams: React.Dispatch<React.SetStateAction<ElsepaInputParams>>;
  onNavigateToWorkbench: () => void;
  theme: 'dark' | 'light';
  savedState?: DensityEditorState | null;
  onSaveState?: (state: DensityEditorState) => void;
}

export const DensityEditor: React.FC<DensityEditorProps> = ({
  params,
  setParams,
  onNavigateToWorkbench,
  theme,
  savedState,
  onSaveState,
}) => {
  const isDark = theme === 'dark';

  // --- Source Selection State ---
  const [selectedSourceType, setSelectedSourceType] = useState<'model' | 'upload' | 'workbench'>('model');
  const [selZ, setSelZ] = useState<number>(params.z || 79);
  const [selQ, setSelQ] = useState<number>(params.ionCharge || 0);
  const [selModel, setSelModel] = useState<'dirac-fock' | 'thomas-fermi' | 'thomas-fermi-dirac' | 'dhfs'>(
    params.densityModel !== 'custom-file' ? params.densityModel : 'dirac-fock'
  );
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // --- Density Data & History State ---
  const [currentPoints, setCurrentPoints] = useState<DensityPoint[]>(() => savedState?.currentPoints || []);
  const [originalPoints, setOriginalPoints] = useState<DensityPoint[]>(() => savedState?.originalPoints || []);
  const [history, setHistory] = useState<DensityPoint[][]>(() => savedState?.history || []);
  const [future, setFuture] = useState<DensityPoint[][]>(() => savedState?.future || []);
  const [sourceName, setSourceName] = useState<string>(() => savedState?.sourceName || 'Gold (Au) Dirac-Fock');
  const [appliedEdits, setAppliedEdits] = useState<string[]>(() => savedState?.appliedEdits || []);

  // --- UI Controls State ---
  const [plotMode, setPlotMode] = useState<PlotMode>('rho-loglog');
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [dragRadiusSigma, setDragRadiusSigma] = useState<number>(0.5);

  // Tool parameter inputs
  const [targetNInput, setTargetNInput] = useState<string>('');
  const [ionizeQInput, setIonizeQInput] = useState<string>('1');
  const [scaleFactorInput, setScaleFactorInput] = useState<string>('1.05');
  const [truncateRInput, setTruncateRInput] = useState<string>('15.0');
  const [smoothK, setSmoothK] = useState<number>(3);
  const [mixWeight, setMixWeight] = useState<number>(0.5);
  const [mixZ, setMixZ] = useState<number>(18);
  const [mixModel, setMixModel] = useState<'dirac-fock' | 'dhfs'>('dirac-fock');
  const [isPointTableOpen, setIsPointTableOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [tableFilterPage, setTableFilterPage] = useState<number>(0);

  // Points table edit row
  const [newPointR, setNewPointR] = useState<string>('');
  const [newPointRho, setNewPointRho] = useState<string>('');
  const [tableError, setTableError] = useState<string | null>(null);

  // Synchronize state back to parent for persistence across tab switches
  useEffect(() => {
    if (onSaveState && currentPoints.length > 0) {
      onSaveState({
        currentPoints,
        originalPoints,
        history,
        future,
        sourceName,
        sourceType: selectedSourceType,
        sourceZ: selZ,
        sourceQ: selQ,
        sourceModel: selModel,
        appliedEdits,
      });
    }
  }, [currentPoints, originalPoints, history, future, sourceName, selectedSourceType, selZ, selQ, selModel, appliedEdits, onSaveState]);

  // Initial load: if no density is loaded yet, fetch initial density for current element
  useEffect(() => {
    if (currentPoints.length === 0) {
      loadModelDensity(selZ, selQ, selModel);
    }
  }, []);

  // Update targetN input when element or charge changes
  useEffect(() => {
    const expected = selZ - selQ;
    if (expected > 0) {
      setTargetNInput(String(expected));
    }
  }, [selZ, selQ]);

  // --- Push to History Helper ---
  const commitPoints = useCallback(
    (newPoints: DensityPoint[], editDescription?: string) => {
      setHistory((prev) => [...prev.slice(-25), currentPoints]);
      setFuture([]);
      setCurrentPoints(newPoints);
      if (editDescription) {
        setAppliedEdits((prev) => [...prev, editDescription]);
      }
    },
    [currentPoints]
  );

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [currentPoints, ...prev]);
    setCurrentPoints(previous);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, currentPoints]);
    setCurrentPoints(next);
  };

  const handleResetToSource = () => {
    if (originalPoints.length === 0) return;
    commitPoints(originalPoints, 'Reset to source');
  };

  // --- Load Density Sources ---
  const loadModelDensity = async (
    z: number,
    q: number,
    model: 'dirac-fock' | 'thomas-fermi' | 'thomas-fermi-dirac' | 'dhfs'
  ) => {
    setIsLoadingModel(true);
    try {
      const pts = await fetchElsepaModelDensity(z, q, model);
      const elem = getElementByZ(z);
      const modelLabels: Record<string, string> = {
        'dirac-fock': 'Dirac-Fock Table',
        'dhfs': 'DHFS Analytical',
        'thomas-fermi-dirac': 'TFD Analytical',
        'thomas-fermi': 'TFM Analytical',
      };
      const name = `${elem.name} (${elem.symbol}, Z=${z}${q > 0 ? `, q=+${q}` : ''}) • ${modelLabels[model] || model}`;
      setOriginalPoints(pts);
      setCurrentPoints(pts);
      setHistory([]);
      setFuture([]);
      setSourceName(name);
      setAppliedEdits([]);
    } catch (err: any) {
      console.error('Failed to load ELSEPA model density:', err);
      setUploadError(err?.message || 'Failed to fetch model density from ELSEPA.');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseDensityFile(text, file.name);
      if (parsed.errors.length > 0) {
        setUploadError(parsed.errors.join('; '));
        return;
      }
      setUploadError(null);
      const { points } = parseTextToDensityPoints(parsed.normalized);
      if (points.length >= MIN_DENSITY_POINTS) {
        setOriginalPoints(points);
        setCurrentPoints(points);
        setHistory([]);
        setFuture([]);
        setSourceName(`Uploaded file: ${file.name}`);
        setAppliedEdits([]);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to read density file.');
    }
  };

  const handleLoadWorkbenchDensity = () => {
    if (params.densityModel === 'custom-file' && params.customDensityData) {
      const parsed = parseDensityFile(params.customDensityData, params.customDensityName);
      if (parsed.errors.length > 0) {
        setUploadError(parsed.errors.join('; '));
        return;
      }
      const { points } = parseTextToDensityPoints(parsed.normalized);
      setOriginalPoints(points);
      setCurrentPoints(points);
      setHistory([]);
      setFuture([]);
      setSourceName(`Workbench custom density: ${params.customDensityName || 'custom-file'}`);
      setAppliedEdits([]);
      setUploadError(null);
    }
  };

  // --- Editing Tool Handlers ---
  const handleDragEdit = (centerR: number, deltaLogRho: number) => {
    const updated = dragEditDensity(currentPoints, centerR, deltaLogRho, dragRadiusSigma);
    setCurrentPoints(updated);
  };

  const handleDragEnd = () => {
    commitPoints(currentPoints, `Drag edit around r`);
  };

  const handleNormalize = () => {
    const targetN = parseFloat(targetNInput);
    if (!Number.isFinite(targetN) || targetN <= 0) return;
    const normalized = normalizeDensity(currentPoints, targetN);
    commitPoints(normalized, `Normalize to N=${targetN}`);
  };

  const handleIonize = () => {
    const q = parseFloat(ionizeQInput);
    if (!Number.isFinite(q) || q === 0) return;
    try {
      const ionized = ionizeDensity(currentPoints, q);
      commitPoints(ionized, q > 0 ? `Ionize (remove ${q} electrons)` : `Add ${-q} electrons (anion)`);
    } catch (err: any) {
      alert(err?.message || 'Ionize failed');
    }
  };

  const handleRadialScale = () => {
    const s = parseFloat(scaleFactorInput);
    if (!Number.isFinite(s) || s <= 0) return;
    const scaled = radialScaleDensity(currentPoints, s);
    commitPoints(scaled, `Radial scale s=${s}`);
  };

  const handleTruncate = () => {
    const rMax = parseFloat(truncateRInput);
    if (!Number.isFinite(rMax) || rMax <= 0) return;
    const truncated = truncateDensity(currentPoints, rMax);
    commitPoints(truncated, `Truncate at r_max=${rMax}`);
  };

  const handleSmooth = () => {
    const smoothed = smoothDensity(currentPoints, smoothK);
    commitPoints(smoothed, `Smooth (k=${smoothK})`);
  };

  const handleMix = async () => {
    setIsLoadingModel(true);
    try {
      const secondPts = await fetchElsepaModelDensity(mixZ, 0, mixModel);
      const mixed = mixDensities(currentPoints, secondPts, mixWeight);
      const elem2 = getElementByZ(mixZ);
      commitPoints(mixed, `Mix with ${elem2.symbol} (w=${(mixWeight * 100).toFixed(0)}%)`);
    } catch (err: any) {
      alert(`Mix failed: ${err?.message || err}`);
    } finally {
      setIsLoadingModel(false);
    }
  };

  // --- Live Statistics & Validation ---
  const stats: DensityStats = useMemo(() => {
    const targetNelec = selZ - selQ > 0 ? selZ - selQ : undefined;
    return calculateDensityStats(currentPoints, targetNelec);
  }, [currentPoints, selZ, selQ]);

  // Serialized density for ELSEPA export and validation
  const serializedDensity = useMemo(() => {
    return formatDensityForElsepa(currentPoints, {
      z: selZ,
      q: selQ,
      nelec: selZ - selQ,
      element: getElementByZ(selZ).name,
      source: sourceName,
      edits: appliedEdits,
    });
  }, [currentPoints, selZ, selQ, sourceName, appliedEdits]);

  const validationResult = useMemo(() => {
    return parseDensityFile(serializedDensity, 'edited_density.den');
  }, [serializedDensity]);

  const isDensityValid = validationResult.errors.length === 0 && currentPoints.length >= MIN_DENSITY_POINTS;

  // --- Download Handler ---
  const handleDownload = () => {
    const elem = getElementByZ(selZ);
    const filename = `z_${String(selZ).padStart(3, '0')}_q${selQ}_edited.den`;
    const blob = new Blob([serializedDensity], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Send to Simulation Handler ---
  const handleSendToSimulation = () => {
    if (!isDensityValid) return;
    const elem = getElementByZ(selZ);
    const filename = `z_${String(selZ).padStart(3, '0')}_q${selQ}_edited.den`;

    setParams((prev) => ({
      ...prev,
      z: selZ,
      massNumber: elem.atomicMass,
      polarizability: elem.polarizability,
      cutoffRadius: elem.cutoffRadius,
      ionCharge: selQ,
      densityModel: 'custom-file',
      customDensityName: filename,
      customDensityData: serializedDensity,
    }));

    onNavigateToWorkbench();
  };

  // --- Point Table Row Edit & Delete ---
  const handleUpdatePoint = (index: number, newR: number, newRho: number) => {
    if (newR <= 0 || newRho <= 0 || !Number.isFinite(newR) || !Number.isFinite(newRho)) {
      setTableError('Values must be finite positive numbers.');
      return;
    }
    // Check increasing r ordering
    if (index > 0 && newR <= currentPoints[index - 1].r) {
      setTableError(`Radius r must be strictly increasing (${newR} <= ${currentPoints[index - 1].r}).`);
      return;
    }
    if (index < currentPoints.length - 1 && newR >= currentPoints[index + 1].r) {
      setTableError(`Radius r must be strictly increasing (${newR} >= ${currentPoints[index + 1].r}).`);
      return;
    }

    setTableError(null);
    const updated = [...currentPoints];
    updated[index] = { r: newR, rho: newRho };
    commitPoints(updated, `Edit point ${index + 1}`);
  };

  const handleDeletePoint = (index: number) => {
    if (currentPoints.length <= MIN_DENSITY_POINTS) {
      setTableError(`Cannot delete: ELSEPA requires at least ${MIN_DENSITY_POINTS} data points.`);
      return;
    }
    setTableError(null);
    const updated = currentPoints.filter((_, i) => i !== index);
    commitPoints(updated, `Delete point ${index + 1}`);
  };

  const handleAddPoint = () => {
    const r = parseFloat(newPointR);
    const rho = parseFloat(newPointRho);
    if (!Number.isFinite(r) || !Number.isFinite(rho) || r <= 0 || rho <= 0) {
      setTableError('Enter valid positive numbers for radius and density.');
      return;
    }
    // Find sorted insertion position
    let insertIdx = currentPoints.findIndex((p) => p.r >= r);
    if (insertIdx === -1) insertIdx = currentPoints.length;
    if (insertIdx > 0 && currentPoints[insertIdx - 1]?.r === r) {
      setTableError(`A point already exists at r = ${r}. Radius must be strictly increasing.`);
      return;
    }

    setTableError(null);
    const updated = [...currentPoints];
    updated.splice(insertIdx, 0, { r, rho });
    commitPoints(updated, `Add point at r=${r}`);
    setNewPointR('');
    setNewPointRho('');
  };

  const pageSize = 50;
  const paginatedPoints = useMemo(() => {
    const start = tableFilterPage * pageSize;
    return currentPoints.slice(start, start + pageSize);
  }, [currentPoints, tableFilterPage]);
  const totalPages = Math.ceil(currentPoints.length / pageSize);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border shadow-sm transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Atom className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Radial Electron Density Editor
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Visual sculpting, ionization, scaling & normalization for ELSEPA 2021 user density grids (MELEC 5, <code className="font-mono text-cyan-400">density.usr</code>)
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title="Undo last edit"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo ({history.length})</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title="Redo edit"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Redo ({future.length})</span>
            </button>

            <button
              onClick={handleResetToSource}
              disabled={originalPoints.length === 0}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title="Reset curve to original source"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!isDensityValid}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download .den</span>
            </button>

            <button
              id="btn-send-to-sim"
              onClick={handleSendToSimulation}
              disabled={!isDensityValid}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to Simulation</span>
            </button>
          </div>
        </div>

        {/* Source Badge Bar */}
        <div
          className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between text-xs gap-3 ${
            isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Active Source:</span>
            <span className="font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
              {sourceName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Target NELEC:</span>
              <span className="font-mono font-semibold text-amber-400">{selZ - selQ}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Edits Applied:</span>
              <span className="font-mono font-semibold text-slate-200">{appliedEdits.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Source Selection Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-sm transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Load Initial Electron Density Source</span>
        </h3>

        {/* Source Type Selector Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedSourceType('model')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedSourceType === 'model'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : isDark
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            ELSEPA Model Density (DF, DHFS, TFD, TFM)
          </button>

          <button
            onClick={() => setSelectedSourceType('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedSourceType === 'upload'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : isDark
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            Upload Density File (.den / .dat / .txt)
          </button>

          {params.densityModel === 'custom-file' && params.customDensityData && (
            <button
              onClick={() => setSelectedSourceType('workbench')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                selectedSourceType === 'workbench'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isDark
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              Current Workbench Density
            </button>
          )}
        </div>

        {/* Option A: Model Density Controls */}
        {selectedSourceType === 'model' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Element Z (1..103):</label>
              <select
                value={selZ}
                onChange={(e) => setSelZ(Number(e.target.value))}
                className={`w-full text-xs rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {PERIODIC_ELEMENTS_NAMES.map((el) => (
                  <option key={el.z} value={el.z}>
                    Z={el.z} - {el.name} ({el.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Ion Charge q (+ cation, − anion, 0 neutral):</label>
              <input
                type="number"
                min={-selZ}
                max={selZ}
                value={selQ}
                onChange={(e) => setSelQ(Math.max(-selZ, Math.min(selZ, Number(e.target.value))))}
                className={`w-full text-xs rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Density Model (MELEC):</label>
              <select
                value={selModel}
                onChange={(e) => setSelModel(e.target.value as any)}
                className={`w-full text-xs rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="dirac-fock">Dirac-Fock (MELEC 4)</option>
                <option value="dhfs">DHFS Analytical (MELEC 3)</option>
                <option value="thomas-fermi-dirac">TFD Analytical (MELEC 2)</option>
                <option value="thomas-fermi">TFM Analytical (MELEC 1)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => loadModelDensity(selZ, selQ, selModel)}
                disabled={isLoadingModel}
                className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModel ? 'animate-spin' : ''}`} />
                <span>{isLoadingModel ? 'Extracting...' : 'Load Density'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Option B: File Upload */}
        {selectedSourceType === 'upload' && (
          <div className="flex flex-col gap-2">
            <label className="block text-xs text-slate-400">Select .den, .dat, .txt, or .csv file:</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".den,.dat,.txt,.csv"
                onChange={handleFileUpload}
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Option C: Workbench Density */}
        {selectedSourceType === 'workbench' && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-300">
              Loaded in workbench: <span className="font-semibold text-cyan-400">{params.customDensityName || 'custom-file'}</span>
            </p>
            <button
              onClick={handleLoadWorkbenchDensity}
              className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow"
            >
              Import into Editor
            </button>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Plot Section Card */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border shadow-sm transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Plot Representation:
            </span>
            <div className="flex rounded-lg border p-0.5 gap-1 bg-slate-800/40 border-slate-700">
              <button
                onClick={() => setPlotMode('rho-loglog')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  plotMode === 'rho-loglog'
                    ? 'bg-indigo-600 text-white shadow'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ρ(r) (log-log)
              </button>
              <button
                onClick={() => setPlotMode('d-linearlog')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  plotMode === 'd-linearlog'
                    ? 'bg-indigo-600 text-white shadow'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                D(r) (linear-log)
              </button>
              <button
                onClick={() => setPlotMode('d-linearlinear')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  plotMode === 'd-linearlinear'
                    ? 'bg-indigo-600 text-white shadow'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                D(r) (linear-linear)
              </button>
            </div>
          </div>

          {/* Drag Sculpting Mode Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDragMode((prev) => !prev)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all ${
                isDragMode
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Drag Sculpt Mode: {isDragMode ? 'ON' : 'OFF'}</span>
            </button>

            {isDragMode && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="text-[11px]">Radius σ:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={dragRadiusSigma}
                  onChange={(e) => setDragRadiusSigma(Number(e.target.value))}
                  className="w-20 accent-cyan-400 cursor-pointer"
                />
                <span className="font-mono text-[11px] text-cyan-400">{dragRadiusSigma.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Plot */}
        <DensityPlot
          originalPoints={originalPoints}
          editedPoints={currentPoints}
          onDragEdit={isDragMode ? handleDragEdit : undefined}
          onDragEnd={isDragMode ? handleDragEnd : undefined}
          isDragMode={isDragMode}
          dragRadiusSigma={dragRadiusSigma}
          plotMode={plotMode}
          theme={theme}
        />
      </div>

      {/* Live Readouts Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-sm transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Live Electron Moments & Physics Readouts</span>
          </h3>

          <div className="flex items-center gap-2 text-xs">
            {isDensityValid ? (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ELSEPA Valid</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/30 border border-rose-800/40 px-2 py-0.5 rounded">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Invalid Density</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Grid Points</div>
            <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">{stats.points}</div>
            <div className="text-[10px] text-slate-500">NDIN ≤ {MAX_DENSITY_POINTS}</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Integrated N</div>
            <div className="text-base font-bold font-mono text-amber-400 mt-0.5">{stats.electrons.toFixed(4)}</div>
            <div className="text-[10px] text-slate-500">Target: {selZ - selQ} e</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Mean Radius &lang;r&rang;</div>
            <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">{stats.meanR.toFixed(3)} a₀</div>
            <div className="text-[10px] text-slate-500">{(stats.meanR * 0.529177).toFixed(3)} Å</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">RMS Radius &radic;&lang;r²&rang;</div>
            <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">{stats.rmsR.toFixed(3)} a₀</div>
            <div className="text-[10px] text-slate-500">{(stats.rmsR * 0.529177).toFixed(3)} Å</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Radius r₅₀ (50%)</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">{stats.r50.toFixed(3)} a₀</div>
            <div className="text-[10px] text-slate-500">Median radius</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Radius r₉₀ (90%)</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">{stats.r90.toFixed(3)} a₀</div>
            <div className="text-[10px] text-slate-500">Encloses 90% N</div>
          </div>
        </div>

        {/* Warnings or Errors */}
        {stats.warning && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{stats.warning}</span>
          </div>
        )}

        {validationResult.errors.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex flex-col gap-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Validation Errors (ELSEPA file rejected):</span>
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-5">
              {validationResult.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Editing Tools Card */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border shadow-sm transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Sculpting & Analytical Transformation Tools</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tool 1: Normalize */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="text-xs font-bold text-slate-200">1. Normalize to N Electrons</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Uniformly scale density so that 4π∫ρr²dr equals target NELEC.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={targetNInput}
                onChange={(e) => setTargetNInput(e.target.value)}
                className={`w-24 text-xs font-mono rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                onClick={handleNormalize}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Normalize
              </button>
            </div>
          </div>

          {/* Tool 2: Ionize */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200">2. Ionize (q &gt; 0 removes, q &lt; 0 adds electrons)</div>
                <div
                  title="Smooth Fermi-Dirac attenuation f(r) = 1 / [1 + exp((r - r0)/w)] at large r. Cutoff r0 is solved via bisection so that exactly q electrons are removed from outer orbitals while keeping core density intact and rho > 0 everywhere."
                  className="cursor-help text-slate-400 hover:text-slate-200"
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Smoothly removes q electrons from the outer valence region (Fermi-Dirac taper).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                
                step="0.5"
                value={ionizeQInput}
                onChange={(e) => setIonizeQInput(e.target.value)}
                className={`w-20 text-xs font-mono rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                onClick={handleIonize}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Ionize
              </button>
            </div>
          </div>

          {/* Tool 3: Radial Scale */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="text-xs font-bold text-slate-200">3. Radial Scale (Compress/Expand)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Applies ρ'(r) = (1/s³)·ρ(r/s) on the same grid, conserving total electron count N.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="5"
                value={scaleFactorInput}
                onChange={(e) => setScaleFactorInput(e.target.value)}
                className={`w-20 text-xs font-mono rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                onClick={handleRadialScale}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Scale (s)
              </button>
            </div>
          </div>

          {/* Tool 4: Truncate */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="text-xs font-bold text-slate-200">4. Truncate Beyond r_max</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Smoothly tapers outer tail for r &gt; r_max while keeping ρ &gt; 0 strictly positive.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="1"
                value={truncateRInput}
                onChange={(e) => setTruncateRInput(e.target.value)}
                className={`w-20 text-xs font-mono rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                onClick={handleTruncate}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Truncate
              </button>
            </div>
          </div>

          {/* Tool 5: Smooth */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="text-xs font-bold text-slate-200">5. Smooth (Moving Average)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Moving average of ln(ρ) over k points; eliminates grid noise and maintains ρ &gt; 0.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={smoothK}
                onChange={(e) => setSmoothK(Number(e.target.value))}
                className={`w-20 text-xs rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value={3}>k = 3</option>
                <option value={5}>k = 5</option>
                <option value={7}>k = 7</option>
              </select>
              <button
                onClick={handleSmooth}
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Smooth
              </button>
            </div>
          </div>

          {/* Tool 6: Mix with Second Density */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="text-xs font-bold text-slate-200">6. Mix with Second Density</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Blends (1 - w)·ρ₁ + w·ρ₂ interpolated on the current radial grid.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={mixZ}
                  onChange={(e) => setMixZ(Number(e.target.value))}
                  className={`flex-1 text-[11px] rounded px-2 py-1 border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {PERIODIC_ELEMENTS_NAMES.map((el) => (
                    <option key={el.z} value={el.z}>
                      Z={el.z} ({el.symbol})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <span>w:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mixWeight}
                    onChange={(e) => setMixWeight(Number(e.target.value))}
                    className="w-16 accent-indigo-500 cursor-pointer"
                  />
                  <span>{(mixWeight * 100).toFixed(0)}%</span>
                </div>
              </div>
              <button
                onClick={handleMix}
                className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition-all"
              >
                Mix Densities
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Point Table Accordion */}
      <div
        className={`rounded-2xl border shadow-sm transition-colors overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <button
          onClick={() => setIsPointTableOpen((prev) => !prev)}
          className={`w-full p-4 flex items-center justify-between text-left font-bold text-sm ${
            isDark ? 'text-slate-200 hover:bg-slate-800/50' : 'text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>Editable Radial Points Table ({currentPoints.length} points)</span>
            <span className="text-xs font-normal text-slate-400">• Inspect, add, edit, or delete individual grid points</span>
          </div>
          {isPointTableOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isPointTableOpen && (
          <div className={`p-4 sm:p-5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            {tableError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{tableError}</span>
              </div>
            )}

            {/* Add Point Row */}
            <div className={`p-3 rounded-xl border mb-4 flex flex-wrap items-center gap-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-xs font-semibold text-slate-300">Insert Point:</div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400">r (a₀):</label>
                <input
                  type="text"
                  placeholder="e.g. 1.25"
                  value={newPointR}
                  onChange={(e) => setNewPointR(e.target.value)}
                  className={`w-28 text-xs font-mono rounded px-2 py-1 border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400">ρ (e/a₀³):</label>
                <input
                  type="text"
                  placeholder="e.g. 0.054"
                  value={newPointRho}
                  onChange={(e) => setNewPointRho(e.target.value)}
                  className={`w-32 text-xs font-mono rounded px-2 py-1 border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <button
                onClick={handleAddPoint}
                className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-96 border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className={`sticky top-0 text-[11px] uppercase font-mono border-b ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Radius r (a₀)</th>
                    <th className="py-2 px-3">Density ρ(r) (e/a₀³)</th>
                    <th className="py-2 px-3">D(r) = 4πr²ρ</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-mono ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                  {paginatedPoints.map((pt, localIdx) => {
                    const globalIdx = tableFilterPage * pageSize + localIdx;
                    const dVal = 4 * Math.PI * pt.r * pt.r * pt.rho;
                    return (
                      <tr key={globalIdx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="py-1.5 px-3 text-slate-500">{globalIdx + 1}</td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            defaultValue={pt.r.toExponential(6)}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (val !== pt.r) handleUpdatePoint(globalIdx, val, pt.rho);
                            }}
                            className={`w-32 px-1.5 py-0.5 rounded border text-[11px] ${
                              isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            defaultValue={pt.rho.toExponential(6)}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (val !== pt.rho) handleUpdatePoint(globalIdx, pt.r, val);
                            }}
                            className={`w-36 px-1.5 py-0.5 rounded border text-[11px] ${
                              isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">{dVal.toExponential(4)}</td>
                        <td className="py-1.5 px-3 text-right">
                          <button
                            onClick={() => handleDeletePoint(globalIdx)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            title="Delete point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Page {tableFilterPage + 1} of {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={tableFilterPage === 0}
                    onClick={() => setTableFilterPage((p) => p - 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={tableFilterPage >= totalPages - 1}
                    onClick={() => setTableFilterPage((p) => p + 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help & Physics Guide Card */}
      <div
        className={`rounded-2xl border shadow-sm transition-colors overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <button
          onClick={() => setIsHelpOpen((prev) => !prev)}
          className={`w-full p-4 flex items-center justify-between text-left font-bold text-sm ${
            isDark ? 'text-slate-200 hover:bg-slate-800/50' : 'text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>Electron Density Physics & ELSEPA File Specifications</span>
          </div>
          {isHelpOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isHelpOpen && (
          <div className={`p-4 sm:p-5 border-t text-xs leading-relaxed space-y-3 ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            <p>
              <strong>What is the radial electron density?</strong> In atomic physics, the electron cloud around a nucleus is described by the radial electron density <code className="font-mono text-cyan-400">ρ(r)</code> in units of electrons per cubic Bohr radius (<code className="font-mono">e/a₀³</code>, where <code className="font-mono">1 a₀ ≈ 0.529177 Å</code>). The radial distribution function is defined as <code className="font-mono text-emerald-400">D(r) = 4πr²ρ(r)</code>, such that <code className="font-mono">∫ D(r) dr = NELEC = Z - q</code>.
            </p>
            <p>
              <strong>Normalization vs. Physical Accuracy:</strong> The electron-count validation verifies mathematical normalization (<code className="font-mono">4π∫ρr²dr = NELEC</code>). It ensures that ELSEPA’s electrostatic potential solver (<code className="font-mono">subroutine EFIELD</code>) converges without artificial charges, but does not substitute for self-consistent relativistic Hartree-Fock calculations.
            </p>
            <p>
              <strong>User Densities for Positive Ions:</strong> ELSEPA’s authors (F. Salvat, A. Jablonski, C. J. Powell) explicitly recommend supplying user densities (<code className="font-mono">MELEC 5, density.usr</code>) when modeling positive ions. While Dirac-Fock tables are pre-evaluated for neutral atoms (Z=1..103), the analytical models (DHFS, TFD, TFM) for ions are approximate; editing or providing an external ion density ensures maximum scattering DCS accuracy.
            </p>
            <p>
              <strong>File Format:</strong> ELSEPA skips 3 header lines and reads pairs of <code className="font-mono">r ρ</code> up to 999 points (its read loop holds <code className="font-mono">NDIN = 1000</code> lines and stops if the file does not end before that). <code className="font-mono">r</code> must be strictly increasing and &gt; 0; <code className="font-mono">ρ</code> must be &gt; 0 because ELSEPA interpolates in lin-log cubic splines using <code className="font-mono">LOG(ρ)</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
