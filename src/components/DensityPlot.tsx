import React, { useRef, useState, useMemo, useCallback } from 'react';
import { DensityPoint, cumulativeElectrons, interpolateLogLog } from '../physics/densityTools';

export type PlotMode = 'rho-loglog' | 'd-linearlog' | 'd-linearlinear';

interface DensityPlotProps {
  originalPoints: DensityPoint[];
  editedPoints: DensityPoint[];
  onDragEdit?: (centerR: number, deltaLogRho: number) => void;
  onDragEnd?: () => void;
  isDragMode?: boolean;
  dragRadiusSigma?: number;
  plotMode: PlotMode;
  theme: 'dark' | 'light';
}

export const DensityPlot: React.FC<DensityPlotProps> = ({
  originalPoints,
  editedPoints,
  onDragEdit,
  onDragEnd,
  isDragMode = false,
  dragRadiusSigma = 0.5,
  plotMode,
  theme,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragCenterRRef = useRef<number | null>(null);
  const lastClientYRef = useRef<number>(0);

  const [hoverData, setHoverData] = useState<{
    r: number;
    rho: number;
    d: number;
    n: number;
    pct: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // SVG dimensions & margins
  const width = 840;
  const height = 440;
  const margin = { top: 30, right: 35, bottom: 55, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Precompute cumulative electrons for edited points for hover lookup
  const cumN = useMemo(() => cumulativeElectrons(editedPoints), [editedPoints]);
  const totalN = cumN.length > 0 ? cumN[cumN.length - 1] : 0;

  // Compute bounds
  const bounds = useMemo(() => {
    const pts = editedPoints.length > 0 ? editedPoints : originalPoints;
    if (!pts || pts.length === 0) {
      return { rMin: 1e-6, rMax: 30, yMin: 1e-12, yMax: 1e7, logRMin: -6, logRMax: 1.5 };
    }

    const rMin = Math.max(1e-7, Math.min(...pts.map((p) => p.r)));
    const rMax = Math.max(...pts.map((p) => p.r));
    const logRMin = Math.floor(Math.log10(rMin));
    const logRMax = Math.ceil(Math.log10(rMax));

    if (plotMode === 'rho-loglog') {
      const validRhos = pts.map((p) => p.rho).filter((rho) => rho > 1e-25);
      const minRho = validRhos.length > 0 ? Math.min(...validRhos) : 1e-12;
      const maxRho = Math.max(...pts.map((p) => p.rho), 1);
      const logYMin = Math.max(-15, Math.floor(Math.log10(minRho)));
      const logYMax = Math.ceil(Math.log10(maxRho)) + 0.2;
      return {
        rMin: Math.pow(10, logRMin),
        rMax: Math.pow(10, logRMax),
        yMin: Math.pow(10, logYMin),
        yMax: Math.pow(10, logYMax),
        logRMin,
        logRMax,
        logYMin,
        logYMax,
      };
    } else {
      // D(r) = 4 * pi * r^2 * rho(r)
      const maxD = Math.max(
        ...pts.map((p) => 4 * Math.PI * p.r * p.r * p.rho),
        ...originalPoints.map((p) => 4 * Math.PI * p.r * p.r * p.rho),
        0.1
      );
      return {
        rMin: plotMode === 'd-linearlinear' ? 0 : Math.pow(10, logRMin),
        rMax: Math.pow(10, logRMax),
        yMin: 0,
        yMax: maxD * 1.1,
        logRMin,
        logRMax,
      };
    }
  }, [editedPoints, originalPoints, plotMode]);

  // Coordinate transforms
  const rToX = useCallback(
    (r: number): number => {
      if (r <= 0) return margin.left;
      if (plotMode === 'd-linearlinear') {
        const span = bounds.rMax - bounds.rMin;
        return margin.left + ((r - bounds.rMin) / span) * plotWidth;
      } else {
        const logR = Math.log10(r);
        const span = bounds.logRMax - bounds.logRMin;
        return margin.left + ((logR - bounds.logRMin) / span) * plotWidth;
      }
    },
    [bounds, margin.left, plotHeight, plotMode, plotWidth]
  );

  const xToR = useCallback(
    (x: number): number => {
      const relX = Math.max(0, Math.min(plotWidth, x - margin.left));
      if (plotMode === 'd-linearlinear') {
        return bounds.rMin + (relX / plotWidth) * (bounds.rMax - bounds.rMin);
      } else {
        const logR = bounds.logRMin + (relX / plotWidth) * (bounds.logRMax - bounds.logRMin);
        return Math.pow(10, logR);
      }
    },
    [bounds, margin.left, plotMode, plotWidth]
  );

  const yToScreen = useCallback(
    (val: number): number => {
      if (plotMode === 'rho-loglog') {
        const safeVal = Math.max(bounds.yMin, val);
        const logY = Math.log10(safeVal);
        const span = (bounds.logYMax ?? 1) - (bounds.logYMin ?? -12);
        const frac = (logY - (bounds.logYMin ?? -12)) / span;
        return margin.top + plotHeight * (1 - Math.max(0, Math.min(1, frac)));
      } else {
        const frac = val / (bounds.yMax || 1);
        return margin.top + plotHeight * (1 - Math.max(0, Math.min(1, frac)));
      }
    },
    [bounds, margin.top, plotHeight, plotMode]
  );

  // Generate SVG paths for original and edited curves
  const makePath = useCallback(
    (points: DensityPoint[]): string => {
      if (!points || points.length === 0) return '';
      let d = '';
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.r <= 0) continue;
        const val = plotMode === 'rho-loglog' ? p.rho : 4 * Math.PI * p.r * p.r * p.rho;
        const x = rToX(p.r);
        const y = yToScreen(val);
        d += i === 0 || d === '' ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      return d;
    },
    [plotMode, rToX, yToScreen]
  );

  const originalPath = useMemo(() => makePath(originalPoints), [makePath, originalPoints]);
  const editedPath = useMemo(() => makePath(editedPoints), [makePath, editedPoints]);

  // Generate Ticks
  const xTicks = useMemo(() => {
    if (plotMode === 'd-linearlinear') {
      const ticks: { r: number; label: string; x: number }[] = [];
      const count = 6;
      for (let i = 0; i <= count; i++) {
        const r = (i / count) * bounds.rMax;
        ticks.push({ r, label: r.toFixed(r < 1 ? 2 : 1), x: rToX(r) });
      }
      return ticks;
    } else {
      const ticks: { r: number; label: string; x: number }[] = [];
      const start = bounds.logRMin;
      const end = bounds.logRMax;
      for (let p = start; p <= end; p++) {
        const r = Math.pow(10, p);
        let label = `10${p}`;
        if (p === 0) label = '1';
        else if (p === -1) label = '0.1';
        else if (p === -2) label = '0.01';
        else if (p === 1) label = '10';
        else label = `10^${p}`;
        ticks.push({ r, label, x: rToX(r) });
      }
      return ticks;
    }
  }, [bounds, plotMode, rToX]);

  const yTicks = useMemo(() => {
    if (plotMode === 'rho-loglog') {
      const ticks: { val: number; label: string; y: number }[] = [];
      const start = bounds.logYMin ?? -12;
      const end = bounds.logYMax ?? 6;
      for (let p = Math.ceil(start); p <= Math.floor(end); p += 2) {
        const val = Math.pow(10, p);
        ticks.push({ val, label: `10^${p}`, y: yToScreen(val) });
      }
      return ticks;
    } else {
      const ticks: { val: number; label: string; y: number }[] = [];
      const count = 5;
      for (let i = 0; i <= count; i++) {
        const val = (i / count) * bounds.yMax;
        ticks.push({ val, label: val.toFixed(val < 1 ? 2 : 1), y: yToScreen(val) });
      }
      return ticks;
    }
  }, [bounds, plotMode, yToScreen]);

  // Pointer event handlers for drag editing and hover readout
  const handlePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (!onDragEdit) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const r = xToR(clientX);
    isDraggingRef.current = true;
    dragCenterRRef.current = r;
    lastClientYRef.current = clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Handle Drag Editing
    if (isDraggingRef.current && dragCenterRRef.current && onDragEdit) {
      const dy = clientY - lastClientYRef.current;
      lastClientYRef.current = clientY;
      // Moving up (negative dy) increases density; moving down decreases
      const deltaLogRho = -dy * 0.025;
      onDragEdit(dragCenterRRef.current, deltaLogRho);
    }

    // Handle Hover Readout
    const r = xToR(clientX);
    if (r > 0 && editedPoints.length > 0) {
      const rho = interpolateLogLog(editedPoints, r);
      const d = 4 * Math.PI * r * r * rho;

      // Find cumulative electrons at r
      let n = 0;
      for (let i = 0; i < editedPoints.length - 1; i++) {
        if (editedPoints[i + 1].r >= r) {
          const p1 = editedPoints[i];
          const p2 = editedPoints[i + 1];
          const span = p2.r - p1.r;
          const t = span > 0 ? (r - p1.r) / span : 0;
          n = cumN[i] + t * (cumN[i + 1] - cumN[i]);
          break;
        }
      }
      if (r >= editedPoints[editedPoints.length - 1].r) n = totalN;

      const pct = totalN > 0 ? (n / totalN) * 100 : 0;
      const screenX = rToX(r);
      const val = plotMode === 'rho-loglog' ? rho : d;
      const screenY = yToScreen(val);

      setHoverData({ r, rho, d, n, pct, screenX, screenY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragCenterRRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      if (onDragEnd) onDragEnd();
    }
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoverData(null);
    }
  };

  // Drag Gaussian influence indicator visualization
  const dragIndicator = useMemo(() => {
    if (!hoverData || !isDragMode) return null;
    const centerR = hoverData.r;
    const rLeft = centerR * Math.exp(-2 * dragRadiusSigma);
    const rRight = centerR * Math.exp(2 * dragRadiusSigma);
    const xLeft = Math.max(margin.left, rToX(rLeft));
    const xRight = Math.min(width - margin.right, rToX(rRight));
    const xCenter = rToX(centerR);
    return { xLeft, xRight, xCenter };
  }, [dragRadiusSigma, hoverData, isDragMode, margin.left, margin.right, rToX, width]);

  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      {/* Hover Readout Bar */}
      <div
        className={`flex flex-wrap items-center justify-between px-3.5 py-2 rounded-xl text-xs font-mono border transition-colors ${
          isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>r: </span>
            <span className="font-semibold text-cyan-400">
              {hoverData ? hoverData.r.toExponential(4) : '—'} <span className="text-[10px] text-slate-500">a₀</span>
            </span>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ρ(r): </span>
            <span className="font-semibold text-indigo-400">
              {hoverData ? hoverData.rho.toExponential(4) : '—'}{' '}
              <span className="text-[10px] text-slate-500">e/a₀³</span>
            </span>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>D(r): </span>
            <span className="font-semibold text-emerald-400">
              {hoverData ? hoverData.d.toExponential(4) : '—'} <span className="text-[10px] text-slate-500">e/a₀</span>
            </span>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>N(r): </span>
            <span className="font-semibold text-amber-400">
              {hoverData ? `${hoverData.n.toFixed(3)} (${hoverData.pct.toFixed(1)}%)` : '—'}
            </span>
          </div>
        </div>

        {isDragMode && (
          <div className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-sans">
            Drag mode active: press & drag vertically to sculpt density
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div
        className={`relative w-full rounded-2xl border overflow-hidden shadow-inner transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          style={{ touchAction: 'none' }}
        >
          {/* Background Grid Lines */}
          <g className="grid-lines" stroke={isDark ? '#1e293b' : '#e2e8f0'} strokeWidth={1} strokeDasharray="3 3">
            {xTicks.map((tick, i) => (
              <line key={`x-${i}`} x1={tick.x} y1={margin.top} x2={tick.x} y2={height - margin.bottom} />
            ))}
            {yTicks.map((tick, i) => (
              <line key={`y-${i}`} x1={margin.left} y1={tick.y} x2={width - margin.right} y2={tick.y} />
            ))}
          </g>

          {/* Plot Bounding Box */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="none"
            stroke={isDark ? '#334155' : '#cbd5e1'}
            strokeWidth={1.5}
          />

          {/* Drag Gaussian Influence Highlight */}
          {dragIndicator && (
            <g className="drag-influence">
              <rect
                x={dragIndicator.xLeft}
                y={margin.top}
                width={Math.max(1, dragIndicator.xRight - dragIndicator.xLeft)}
                height={plotHeight}
                fill="url(#dragGradient)"
                opacity={0.35}
              />
              <line
                x1={dragIndicator.xCenter}
                y1={margin.top}
                x2={dragIndicator.xCenter}
                y2={height - margin.bottom}
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
            </g>
          )}

          {/* Original Source Curve (Dashed, Muted) */}
          {originalPath && (
            <path
              d={originalPath}
              fill="none"
              stroke={isDark ? '#94a3b8' : '#64748b'}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              opacity={0.55}
            />
          )}

          {/* Edited Curve (Solid, Vibrant) */}
          {editedPath && (
            <path
              d={editedPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair & Point */}
          {hoverData && (
            <g className="hover-marker">
              <line
                x1={hoverData.screenX}
                y1={margin.top}
                x2={hoverData.screenX}
                y2={height - margin.bottom}
                stroke={isDark ? '#475569' : '#94a3b8'}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverData.screenX}
                cy={hoverData.screenY}
                r={5.5}
                fill="#06b6d4"
                stroke={isDark ? '#020617' : '#ffffff'}
                strokeWidth={2}
                className="transition-all"
              />
            </g>
          )}

          {/* X-Axis Ticks & Labels */}
          <g className="x-axis text-[11px] font-mono" fill={isDark ? '#94a3b8' : '#64748b'}>
            {xTicks.map((tick, i) => (
              <g key={`xtick-${i}`} transform={`translate(${tick.x}, ${height - margin.bottom + 16})`}>
                <line x1={0} y1={-16} x2={0} y2={-11} stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth={1} />
                <text textAnchor="middle">{tick.label}</text>
              </g>
            ))}
            <text
              x={margin.left + plotWidth / 2}
              y={height - 12}
              textAnchor="middle"
              className="text-xs font-sans font-medium"
              fill={isDark ? '#cbd5e1' : '#334155'}
            >
              Radial Distance r (Bohr radius a₀ ≈ 0.529 Å)
            </text>
          </g>

          {/* Y-Axis Ticks & Labels */}
          <g className="y-axis text-[11px] font-mono" fill={isDark ? '#94a3b8' : '#64748b'}>
            {yTicks.map((tick, i) => (
              <g key={`ytick-${i}`} transform={`translate(${margin.left - 8}, ${tick.y + 4})`}>
                <line x1={8} y1={-4} x2={3} y2={-4} stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth={1} />
                <text textAnchor="end">{tick.label}</text>
              </g>
            ))}
            <text
              transform={`rotate(-90) translate(-${margin.top + plotHeight / 2}, 22)`}
              textAnchor="middle"
              className="text-xs font-sans font-medium"
              fill={isDark ? '#cbd5e1' : '#334155'}
            >
              {plotMode === 'rho-loglog'
                ? 'Electron Density ρ(r) (electrons / a₀³)'
                : 'Radial Distribution D(r) = 4πr²ρ(r) (electrons / a₀)'}
            </text>
          </g>

          {/* Interactive Overlay Rect (Captures Mouse and Touch) */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            className={isDragMode ? 'cursor-ns-resize' : 'cursor-crosshair'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="dragGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Legend Overlay in top-right corner of the plot */}
        <div
          className={`absolute top-4 right-5 px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-4 border shadow-sm backdrop-blur-sm ${
            isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white/85 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block" />
            <span className="text-slate-400">Original Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-cyan-400 inline-block rounded-full" />
            <span className="text-cyan-400 font-semibold">Edited Density</span>
          </div>
        </div>
      </div>
    </div>
  );
};
