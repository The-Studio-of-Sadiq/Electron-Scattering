import React, { useState, useMemo, useRef } from 'react';
import { ScatteringDataPoint } from '../types';
import { MathTex } from './LaTeX';

interface PolarPlotProps {
  data: ScatteringDataPoint[];
  projectileSymbol: string;
  energyEv: number;
  elementSymbol: string;
}

export const PolarPlot: React.FC<PolarPlotProps> = ({
  data,
  projectileSymbol,
  energyEv,
  elementSymbol,
}) => {
  const [useLogScale, setUseLogScale] = useState(true);
  const [unit, setUnit] = useState<'au' | 'cm2'>('au');
  const [hoveredPoint, setHoveredPoint] = useState<{ angle: number; dcs: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) return null;

  const width = 540;
  const height = 540;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = 210;
  const minRadius = 35;

  // Compute min/max for scale
  const values = data.map((d) => (unit === 'cm2' ? d.dcsCm2 : d.dcsAu));
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values.filter((v) => v > 0));

  // Sensible log bounds: cover up to 5 orders of magnitude below max for visual clarity
  const maxVal = rawMax > 0 ? rawMax : 1;
  const minVal = useLogScale ? Math.max(rawMin, maxVal * 1e-6) : rawMin;

  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);

  const getCoordinates = (angleDeg: number, dcsVal: number) => {
    let normRadius = 0;
    if (useLogScale) {
      const logVal = Math.log10(Math.max(dcsVal, minVal));
      normRadius = Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin || 1)));
    } else {
      normRadius = Math.max(0, Math.min(1, (dcsVal - minVal) / (maxVal - minVal || 1)));
    }

    const r = minRadius + normRadius * (maxRadius - minRadius);
    const angleRad = (angleDeg * Math.PI) / 180;

    // Physics polar coordinate: 0° is along positive X axis (forward scattering)
    const x = centerX + r * Math.cos(angleRad);
    const y = centerY - r * Math.sin(angleRad);

    return { x, y, r };
  };

  const pointsUpper = useMemo(() => {
    return data.map((pt) => {
      const val = unit === 'cm2' ? pt.dcsCm2 : pt.dcsAu;
      const { x, y } = getCoordinates(pt.angleDeg, val);
      return { angle: pt.angleDeg, dcs: val, x, y };
    });
  }, [data, unit, useLogScale, logMin, logMax, minVal, maxVal]);

  const pointsLower = useMemo(() => {
    return [...data]
      .reverse()
      .map((pt) => {
        const angleMirror = 360 - pt.angleDeg;
        const val = unit === 'cm2' ? pt.dcsCm2 : pt.dcsAu;
        const { x, y } = getCoordinates(angleMirror, val);
        return { angle: angleMirror, dcs: val, x, y };
      });
  }, [data, unit, useLogScale, logMin, logMax, minVal, maxVal]);

  const fullPathPoints = useMemo(() => {
    return [...pointsUpper, ...pointsLower.slice(1)];
  }, [pointsUpper, pointsLower]);

  const svgPathD = useMemo(() => {
    if (fullPathPoints.length === 0) return '';
    return (
      fullPathPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ') + ' Z'
    );
  }, [fullPathPoints]);

  // Concentric scale rings
  const circleSteps = 4;
  const tickCircles = Array.from({ length: circleSteps }, (_, i) => {
    const fraction = (i + 1) / circleSteps;
    const radius = minRadius + fraction * (maxRadius - minRadius);

    let valLabel = '';
    if (useLogScale) {
      const exp = logMin + fraction * (logMax - logMin);
      valLabel = Math.pow(10, exp).toExponential(1);
    } else {
      const val = minVal + fraction * (maxVal - minVal);
      valLabel = val.toExponential(1);
    }

    return { radius, label: valLabel };
  });

  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  // Mouse hover handler on SVG container
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || pointsUpper.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / (rect.width || 1);
    const scaleY = height / (rect.height || 1);
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Find closest point in upper half
    let closest = pointsUpper[0];
    let minDistance = Infinity;

    for (const pt of pointsUpper) {
      const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (dist < minDistance) {
        minDistance = dist;
        closest = pt;
      }
    }

    if (minDistance < 60) {
      setHoveredPoint(closest);
    } else {
      setHoveredPoint(null);
    }
  };

  return (
    <div id="polar-plot-container" className="flex flex-col items-center space-y-4 w-full">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between w-full border-b border-slate-200 pb-3 gap-3 text-sm">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span>Polar Angular Distribution</span>
            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-normal">
              <MathTex math="\frac{d\sigma}{d\Omega}(\theta)" />
            </span>
          </span>
          <span className="text-xs text-slate-600 font-mono font-medium">
            {elementSymbol} ({projectileSymbol} @ {energyEv >= 1000 ? `${energyEv / 1000} keV` : `${energyEv} eV`})
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setUnit('au')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                unit === 'au' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              a₀²/sr
            </button>
            <button
              onClick={() => setUnit('cm2')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                unit === 'cm2' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              cm²/sr
            </button>
          </div>

          <button
            onClick={() => setUseLogScale(!useLogScale)}
            className={`px-3 py-1 rounded-md text-xs font-bold border transition-colors ${
              useLogScale ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            {useLogScale ? 'Log Scale R' : 'Linear Scale R'}
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-2 sm:p-4 shadow-xl flex items-center justify-center w-full max-w-[580px] overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-w-[540px] overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <radialGradient id="polarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.15" />
            </radialGradient>
          </defs>

          {/* Concentric Circle Grid */}
          {tickCircles.map((circle, idx) => (
            <g key={idx}>
              <circle
                cx={centerX}
                cy={centerY}
                r={circle.radius}
                fill="none"
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={centerX + 6}
                y={centerY - circle.radius + 14}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="500"
              >
                {circle.label}
              </text>
            </g>
          ))}

          {/* Radial Spokes & Angle Labels */}
          {spokes.map((ang) => {
            const rad = (ang * Math.PI) / 180;
            const x2 = centerX + maxRadius * Math.cos(rad);
            const y2 = centerY - maxRadius * Math.sin(rad);

            const labelX = centerX + (maxRadius + 22) * Math.cos(rad);
            const labelY = centerY - (maxRadius + 22) * Math.sin(rad) + 4;

            let labelText = `${ang}°`;
            if (ang === 0) labelText = '0° (Forward)';
            if (ang === 90) labelText = '90° (Transverse)';
            if (ang === 180) labelText = '180° (Backward)';

            return (
              <g key={ang}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={x2}
                  y2={y2}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={labelX}
                  y={labelY}
                  fill="#cbd5e1"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Core Incident Beam Direction Arrow */}
          <line
            x1={centerX - maxRadius - 30}
            y1={centerY}
            x2={centerX + maxRadius + 30}
            y2={centerY}
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.7"
          />

          {/* Symmetrical DCS Polar Area */}
          <path
            d={svgPathD}
            fill="url(#polarGlow)"
            stroke="#818cf8"
            strokeWidth="2.5"
          />

          {/* Active Hover Highlight Dot */}
          {hoveredPoint && (
            <g>
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={7}
                fill="#fbbf24"
                stroke="#0f172a"
                strokeWidth="2"
              />
              {/* Also mirror dot on lower half */}
              <circle
                cx={hoveredPoint.x}
                cy={centerY + (centerY - hoveredPoint.y)}
                r={5}
                fill="#f59e0b"
                opacity="0.7"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-6 left-6 bg-slate-950/95 border border-amber-500/60 rounded-lg px-3 py-2 text-sm shadow-2xl text-white font-mono pointer-events-none z-10 flex flex-col gap-1">
            <div className="text-amber-400 font-bold text-base">Angle θ = {hoveredPoint.angle}°</div>
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-amber-300 flex items-center">
                <MathTex math="\frac{d\sigma}{d\Omega} =" />
              </span>
              <span className="font-semibold text-white">
                {hoveredPoint.dcs.toExponential(4)} {unit === 'cm2' ? 'cm²/sr' : 'a₀²/sr'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PolarPlot;
