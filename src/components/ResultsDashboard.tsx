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
  BarChart,
  Bar,
} from 'recharts';
import {
  Download,
  Copy,
  Check,
  Activity,
  FileCode,
  Table as TableIcon,
  Layers,
  Compass,
  Zap,
  TrendingUp,
  CircleDot,
  FileJson,
} from 'lucide-react';
import { SimulationResult, UploadedDataset } from '../types';
import { PolarPlot } from './PolarPlot';
import { MathTex, LaTeXText } from './LaTeX';

interface ResultsDashboardProps {
  result: SimulationResult | null;
  uploadedDatasets: UploadedDataset[];
  selectedOverlayId?: string;
  setSelectedOverlayId?: (id: string) => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  result,
  uploadedDatasets,
  selectedOverlayId: propsSelectedOverlayId,
  setSelectedOverlayId: propsSetSelectedOverlayId,
}) => {
  const [activeView, setActiveView] = useState<'dcs' | 'spin' | 'polar' | 'potentials' | 'phases' | 'file' | 'table'>('dcs');
  const [useLogScale, setUseLogScale] = useState(true);
  const [dcsUnit, setDcsUnit] = useState<'au' | 'cm2' | 'angstrom2'>('au');
  const [internalOverlayId, setInternalOverlayId] = useState<string>('');
  const [copiedFile, setCopiedFile] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const activeOverlayId = propsSelectedOverlayId !== undefined ? propsSelectedOverlayId : internalOverlayId;
  const handleOverlayChange = (id: string) => {
    setInternalOverlayId(id);
    if (propsSetSelectedOverlayId) {
      propsSetSelectedOverlayId(id);
    }
  };

  if (!result) {
    return (
      <div id="no-results-placeholder" className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <Activity className="w-12 h-12 text-indigo-500 mx-auto mb-3 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-100">Ready for Dirac Partial-Wave Simulation</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
          Select an atomic preset or customize target parameters above, then click <strong className="text-indigo-400 font-bold">"Run ELSEPA Simulation"</strong> to calculate differential cross sections and spin polarization observables.
        </p>
      </div>
    );
  }

  const { summary, scatteringData, potentialProfile, phaseShifts, elsepaInputFileText, element } = result;

  // Selected Overlay dataset
  const overlayDataset = uploadedDatasets.find((d) => d.id === activeOverlayId);

  // Compute unit scaling factor for overlay dataset
  let overlayScaleFactor = 1.0;
  if (overlayDataset && overlayDataset.parsedData.length > 0) {
    const validY = overlayDataset.parsedData.map((dp) => dp.y).filter((y) => !isNaN(y) && y > 0);
    const avgY = validY.length > 0 ? validY.reduce((a, b) => a + b, 0) / validY.length : 1.0;
    const isDatasetInCm2 = avgY < 1e-10;

    if (isDatasetInCm2) {
      if (dcsUnit === 'cm2') overlayScaleFactor = 1.0;
      else if (dcsUnit === 'au') overlayScaleFactor = 1.0 / 2.8002852e-17;
      else if (dcsUnit === 'angstrom2') overlayScaleFactor = 1.0 / 1e-16;
    } else {
      if (dcsUnit === 'au') overlayScaleFactor = 1.0;
      else if (dcsUnit === 'cm2') overlayScaleFactor = 2.8002852e-17;
      else if (dcsUnit === 'angstrom2') overlayScaleFactor = 0.28002852;
    }
  }

  // Build chart data including simulation and optional overlay dataset
  const stepTolerance = Math.max(1.5, (result.params.angleStep || 1.0) * 1.5);
  const dcsChartData = scatteringData.map((pt) => {
    const val =
      dcsUnit === 'cm2'
        ? pt.dcsCm2
        : dcsUnit === 'angstrom2'
        ? pt.dcsAngstrom2
        : pt.dcsAu;

    let overlayVal: number | undefined = undefined;
    if (overlayDataset && overlayDataset.parsedData.length > 0) {
      // Find nearest data point in overlay dataset
      let closestDp = overlayDataset.parsedData[0];
      let minDiff = Math.abs(closestDp.x - pt.angleDeg);
      for (let i = 1; i < overlayDataset.parsedData.length; i++) {
        const diff = Math.abs(overlayDataset.parsedData[i].x - pt.angleDeg);
        if (diff < minDiff) {
          minDiff = diff;
          closestDp = overlayDataset.parsedData[i];
        }
      }
      if (minDiff <= stepTolerance) {
        overlayVal = closestDp.y * overlayScaleFactor;
      }
    }

    return {
      angle: pt.angleDeg,
      dcs: val,
      overlay: overlayVal,
    };
  });

  // Handle copying elsepa.in text
  const handleCopyFile = () => {
    navigator.clipboard.writeText(elsepaInputFileText);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  // Export CSV download
  const handleDownloadCsv = () => {
    const headers = 'Angle_deg,DCS_a02_sr,DCS_cm2_sr,Sherman_S,Spin_T,Spin_U,Re_f,Im_f,Re_g,Im_g\n';
    const rows = scatteringData
      .map(
        (p) =>
          `${p.angleDeg},${p.dcsAu},${p.dcsCm2},${p.shermanS},${p.spinT},${p.spinU},${p.reF},${p.imF},${p.reG},${p.imG}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELSEPA_Z${element.z}_E${result.params.energyEv}eV_DCS.csv`;
    a.click();
  };

  // Export JSON download
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELSEPA_Z${element.z}_E${result.params.energyEv}eV_Result.json`;
    a.click();
  };

  return (
    <div id="results-dashboard-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-xs text-indigo-700 font-bold tracking-wider flex items-center gap-1.5">
            <span>Total Elastic</span>
            <MathTex math="\sigma_{\text{el}}" />
          </div>
          <div className="text-xl font-black text-indigo-950 font-mono mt-1 flex items-baseline gap-1">
            <span>{summary.sigmaElAu.toFixed(3)}</span>
            <span className="text-xs font-semibold text-indigo-600"><MathTex math="a_0^2" /></span>
          </div>
          <div className="text-xs text-indigo-700 font-mono mt-0.5">
            {summary.sigmaElCm2.toExponential(3)} cm²
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-xs text-slate-600 font-bold tracking-wider flex items-center gap-1.5">
            <span>1st Transport</span>
            <MathTex math="\sigma_1" />
          </div>
          <div className="text-xl font-black text-slate-800 font-mono mt-1 flex items-baseline gap-1">
            <span>{summary.sigma1Au.toFixed(3)}</span>
            <span className="text-xs font-semibold text-slate-500"><MathTex math="a_0^2" /></span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">Momentum Transfer</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-xs text-slate-600 font-bold tracking-wider flex items-center gap-1.5">
            <span>2nd Transport</span>
            <MathTex math="\sigma_2" />
          </div>
          <div className="text-xl font-black text-slate-800 font-mono mt-1 flex items-baseline gap-1">
            <span>{summary.sigma2Au.toFixed(3)}</span>
            <span className="text-xs font-semibold text-slate-500"><MathTex math="a_0^2" /></span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">Viscosity Cross Sec.</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 shadow-sm">
          <div className="text-xs text-slate-600 font-bold tracking-wider flex items-center gap-1.5">
            <span>Kinematics</span>
            <MathTex math="(k, \gamma, \beta)" />
          </div>
          <div className="text-sm font-bold text-slate-800 font-mono mt-1 flex items-center gap-1">
            <MathTex math={`k = ${summary.kWaveVector.toFixed(2)}\\text{ }a_0^{-1}`} />
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            <MathTex math={`\\gamma = ${summary.gammaRelativistic.toFixed(3)}, \\beta = ${summary.betaRelativistic.toFixed(3)}`} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 shadow-sm col-span-2 md:col-span-1">
          <div className="text-xs text-slate-600 uppercase font-bold tracking-wider">Solver Status</div>
          <div className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{summary.computationTimeMs} ms</span>
          </div>
          <div className="text-xs text-slate-500 truncate font-mono mt-0.5">
            Max l = {summary.maxL} partial waves
          </div>
        </div>
      </div>

      {/* Chart View Selector & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          <button
            id="view-tab-dcs"
            onClick={() => setActiveView('dcs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'dcs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Differential Cross Section (DCS)</span>
          </button>

          <button
            id="view-tab-spin"
            onClick={() => setActiveView('spin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'spin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sherman S(θ) Spin Functions</span>
          </button>

          <button
            id="view-tab-polar"
            onClick={() => setActiveView('polar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'polar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span>Polar Plot</span>
          </button>

          <button
            id="view-tab-potentials"
            onClick={() => setActiveView('potentials')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'potentials' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Atomic Potentials V(r)</span>
          </button>

          <button
            id="view-tab-phases"
            onClick={() => setActiveView('phases')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'phases' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Phase Shifts δ_κ</span>
          </button>

          <button
            id="view-tab-file"
            onClick={() => setActiveView('file')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'file' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>elsepa.in Input</span>
          </button>

          <button
            id="view-tab-table"
            onClick={() => setActiveView('table')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeView === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Data Table</span>
          </button>
        </div>

        {/* View Controls & Export Action */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeView === 'dcs' && (
            <>
              {/* Units dropdown */}
              <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
                <button
                  onClick={() => setDcsUnit('au')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${
                    dcsUnit === 'au' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  a0²/sr
                </button>
                <button
                  onClick={() => setDcsUnit('cm2')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${
                    dcsUnit === 'cm2' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  cm²/sr
                </button>
                <button
                  onClick={() => setDcsUnit('angstrom2')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${
                    dcsUnit === 'angstrom2' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Å²/sr
                </button>
              </div>

              {/* Log Scale Toggle */}
              <button
                id="btn-toggle-log-scale"
                onClick={() => setUseLogScale(!useLogScale)}
                className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-colors ${
                  useLogScale
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Log Scale: {useLogScale ? 'ON' : 'OFF'}
              </button>

              {/* Dataset Overlay Selector */}
              {uploadedDatasets.length > 0 && (
                <select
                  value={activeOverlayId}
                  onChange={(e) => handleOverlayChange(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-2.5 py-1.5 focus:outline-none font-semibold"
                >
                  <option value="">-- No Overlay Dataset --</option>
                  {uploadedDatasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      Overlay: {ds.filename} ({ds.dataPointsCount} pts)
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {/* Download Results Action Button */}
          <div className="relative">
            <button
              id="btn-download-results-dropdown"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Results</span>
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 font-sans text-xs">
                <button
                  id="btn-export-json"
                  onClick={() => {
                    handleDownloadJson();
                    setShowDownloadMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-slate-800 flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="font-bold">Export JSON File</div>
                    <div className="text-[10px] text-slate-500">Full parameters & physics data</div>
                  </div>
                </button>
                <button
                  id="btn-export-csv"
                  onClick={() => {
                    handleDownloadCsv();
                    setShowDownloadMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-800 flex items-center gap-2 border-t border-slate-100"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold">Export CSV Dataset</div>
                    <div className="text-[10px] text-slate-500">Angular DCS table columns</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Plot Area */}
      <div id="main-plot-area" className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 min-h-[420px] flex flex-col justify-center">
        {/* VIEW 1: DCS Plot */}
        {activeView === 'dcs' && (
          <div className="w-full flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 px-1 text-slate-800 font-bold text-sm sm:text-base">
              <div className="flex items-center gap-2">
                <span>Differential Cross Section</span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  <MathTex math="\frac{d\sigma}{d\Omega}" />
                </span>
                <span className="text-slate-600 font-normal text-xs sm:text-sm">
                  ({dcsUnit === 'au' ? 'a₀²/sr' : dcsUnit === 'cm2' ? 'cm²/sr' : 'Å²/sr'}) vs Scattering Angle θ
                </span>
              </div>
            </div>

            <div className="w-full h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dcsChartData} margin={{ top: 15, right: 30, left: 65, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="angle"
                    stroke="#64748b"
                    label={{ value: 'Scattering Angle θ (degrees)', position: 'insideBottom', offset: -15, fill: '#64748b', style: { fontSize: '12px' } }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    scale={useLogScale ? 'log' : 'auto'}
                    domain={useLogScale ? ['auto', 'auto'] : [0, 'auto']}
                    tickFormatter={(val) => (typeof val === 'number' ? val.toExponential(1) : val)}
                    tick={{ fontSize: 12 }}
                    label={{
                      value: `dσ/dΩ (${dcsUnit === 'au' ? 'a0²/sr' : dcsUnit === 'cm2' ? 'cm²/sr' : 'Å²/sr'})`,
                      angle: -90,
                      position: 'insideLeft',
                      dx: -25,
                      style: { textAnchor: 'middle', fontSize: '12px' },
                      fill: '#64748b',
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any) => [typeof val === 'number' ? val.toExponential(4) : val, 'dσ/dΩ']}
                    labelFormatter={(lbl) => `Angle θ = ${lbl}°`}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontSize: '13px' }} />
                  <Line
                    type="monotone"
                    dataKey="dcs"
                    name={`ELSEPA ${element.symbol} (${result.params.projectile === -1 ? 'e⁻' : 'e⁺'} @ ${result.params.energyEv} eV)`}
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                  {overlayDataset && (
                    <Line
                      type="monotone"
                      dataKey="overlay"
                      name={`Uploaded: ${overlayDataset.filename}`}
                      stroke="#f43f5e"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={true}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: Spin Polarization Sherman S(θ) */}
        {activeView === 'spin' && (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scatteringData} margin={{ top: 15, right: 30, left: 60, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="angleDeg"
                  stroke="#94a3b8"
                  label={{ value: 'Scattering Angle θ (degrees)', position: 'insideBottom', offset: -15, fill: '#94a3b8' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  domain={[-1.1, 1.1]}
                  label={{ value: 'Spin Polarization Functions', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle' }, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
                  formatter={(val: any, name: any) => [typeof val === 'number' ? val.toFixed(4) : val, name]}
                  labelFormatter={(lbl) => `Angle θ = ${lbl}°`}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="shermanS"
                  name="Sherman Function S(θ) [Spin Polarization]"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="spinT"
                  name="Spin Rotation T(θ)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="spinU"
                  name="Spin Rotation U(θ)"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 2.5: Polar Plot Angular Distribution */}
        {activeView === 'polar' && (
          <div className="w-full py-2 flex justify-center">
            <PolarPlot
              data={scatteringData}
              projectileSymbol={result.params.projectile === -1 ? 'e⁻' : 'e⁺'}
              energyEv={result.params.energyEv}
              elementSymbol={element.symbol}
            />
          </div>
        )}

        {/* VIEW 3: Potentials Profile V(r) */}
        {activeView === 'potentials' && (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={potentialProfile} margin={{ top: 15, right: 30, left: 60, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="r"
                  stroke="#94a3b8"
                  tickFormatter={(v) => v.toFixed(2)}
                  label={{ value: 'Radius r (Bohr radius a0)', position: 'insideBottom', offset: -15, fill: '#94a3b8' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  label={{ value: 'Potential V(r) (Hartree E_h)', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle' }, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
                  formatter={(val: any) => [typeof val === 'number' ? val.toFixed(4) : val, 'E_h']}
                  labelFormatter={(r) => `Radius r = ${Number(r).toFixed(3)} a0`}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                <Line type="monotone" dataKey="vTotalElectrostatic" name="V_electrostatic(r)" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="vExchange" name="V_exchange(r)" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="vPolarization" name="V_polarization(r)" stroke="#ec4899" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 4: Phase Shifts δ_κ */}
        {activeView === 'phases' && (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseShifts.slice(0, 30)} margin={{ top: 15, right: 30, left: 60, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="kappa" stroke="#94a3b8" label={{ value: 'Relativistic Quantum Number κ', position: 'insideBottom', offset: -15, fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" label={{ value: 'Real Phase Shift δ_κ (rad)', angle: -90, position: 'insideLeft', dx: -25, style: { textAnchor: 'middle' }, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
                  formatter={(val: any) => [typeof val === 'number' ? val.toFixed(4) : val, 'radians']}
                  labelFormatter={(k) => `κ = ${k}`}
                />
                <Bar dataKey="deltaRe" name="Real Phase Shift δ_κ" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 5: elsepa.in Input File */}
        {activeView === 'file' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-xs font-mono text-indigo-300 font-bold">Generated elsepa.in Fortran Input Specification</span>
              <button
                id="btn-copy-elsepa-file"
                onClick={handleCopyFile}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFile ? 'Copied!' : 'Copy elsepa.in'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-indigo-200 font-mono text-xs rounded-xl border border-slate-800 overflow-x-auto leading-relaxed">
              {elsepaInputFileText}
            </pre>
          </div>
        )}

        {/* VIEW 6: Data Table */}
        {activeView === 'table' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Showing {scatteringData.length} angular scattering points (0° to 180°)</span>
              <button
                id="btn-download-csv"
                onClick={handleDownloadCsv}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Dataset</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-[340px] border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-300 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-2">θ (deg)</th>
                    <th className="p-2">DCS (a0²/sr)</th>
                    <th className="p-2">DCS (cm²/sr)</th>
                    <th className="p-2">Sherman S(θ)</th>
                    <th className="p-2">Spin T(θ)</th>
                    <th className="p-2">Spin U(θ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/80">
                  {scatteringData.map((pt, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-2 font-bold text-indigo-300">{pt.angleDeg.toFixed(1)}°</td>
                      <td className="p-2 text-slate-200">{pt.dcsAu.toExponential(4)}</td>
                      <td className="p-2 text-slate-300">{pt.dcsCm2.toExponential(4)}</td>
                      <td className={`p-2 font-bold ${pt.shermanS < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {pt.shermanS.toFixed(4)}
                      </td>
                      <td className="p-2 text-slate-400">{pt.spinT.toFixed(4)}</td>
                      <td className="p-2 text-slate-400">{pt.spinU.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
