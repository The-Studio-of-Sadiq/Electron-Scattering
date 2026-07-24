import React, { useState } from 'react';
import { ScatteringDataPoint } from '../types';

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

  if (!data || data.length === 0) return null;

  // Extract DCS values based on selected unit
  const values = data.map((d) => (unit === 'cm2' ? d.dcsCm2 : d.dcsAu));

  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (minVal <= 0) minVal = 1e-30;
  if (maxVal <= minVal) maxVal = minVal * 10;

  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);

  const width = 500;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = 190;
  const minRadius = 30;

  // Helper function to convert (angleDeg, dcsValue) to SVG (X, Y)
  const getCoordinates = (angleDeg: number, dcsVal: number) => {
    let normRadius = 0;
    if (useLogScale) {
      const logVal = Math.log10(Math.max(dcsVal, 1e-30));
      normRadius = Math.max(0, (logVal - logMin) / (logMax - logMin || 1));
    } else {
      normRadius = Math.max(0, (dcsVal - minVal) / (maxVal - minVal || 1));
    }

    const r = minRadius + normRadius * (maxRadius - minRadius);
    // Convert physics angle (0 = right/forward beam) to polar angle in radians
    const angleRad = (angleDeg * Math.PI) / 180;

    // Standard polar conversion: angle 0 along positive X axis
    const x = centerX + r * Math.cos(angleRad);
    const y = centerY - r * Math.sin(angleRad); // Invert Y for SVG

    return { x, y, r, normRadius };
  };

  // Build symmetrical 360 degree path (0 -> 180 -> 360)
  const pointsUpper = data.map((pt) => {
    const val = unit === 'cm2' ? pt.dcsCm2 : pt.dcsAu;
    const { x, y } = getCoordinates(pt.angleDeg, val);
    return { angle: pt.angleDeg, dcs: val, x, y };
  });

  // Mirror 180 -> 360 (0 to -180 deg)
  const pointsLower = [...data]
    .reverse()
    .map((pt) => {
      const angleMirror = 360 - pt.angleDeg;
      const val = unit === 'cm2' ? pt.dcsCm2 : pt.dcsAu;
      const { x, y } = getCoordinates(angleMirror, val);
      return { angle: angleMirror, dcs: val, x, y };
    });

  const fullPathPoints = [...pointsUpper, ...pointsLower.slice(1)];
  const svgPathD =
    fullPathPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ') + ' Z';

  // Concentric circle ticks for scale
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

  // Radial spokes (angles in deg)
  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <div id="polar-plot-container" className="flex flex-col items-center space-y-4 w-full">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between w-full border-b border-slate-200 pb-2 gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-800">Polar Angular Distribution dσ/dΩ(θ)</span>
          <span className="text-[11px] text-slate-500 font-mono">
            {elementSymbol} ({projectileSymbol} @ {energyEv >= 1000 ? `${energyEv / 1000} keV` : `${energyEv} eV`})
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              onClick={() => setUnit('au')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                unit === 'au' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              a₀²/sr
            </button>
            <button
              onClick={() => setUnit('cm2')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                unit === 'cm2' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              cm²/sr
            </button>
          </div>

          <button
            onClick={() => setUseLogScale(!useLogScale)}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
              useLogScale ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            {useLogScale ? 'Log Scale R' : 'Linear Scale R'}
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-inner flex items-center justify-center">
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <radialGradient id="polarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
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
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={centerX + 4}
                y={centerY - circle.radius + 12}
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
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

            const labelX = centerX + (maxRadius + 18) * Math.cos(rad);
            const labelY = centerY - (maxRadius + 18) * Math.sin(rad) + 4;

            let labelText = `${ang}°`;
            if (ang === 0) labelText = '0° (Forward)';
            if (ang === 90) labelText = '90° (Transverse)';
            if (ang === 180) labelText = '180° (Back)';

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
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Core Beam Line Pointer */}
          <line
            x1={centerX - maxRadius - 25}
            y1={centerY}
            x2={centerX + maxRadius + 25}
            y2={centerY}
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          {/* Symmetrical DCS Polar Area */}
          <path
            d={svgPathD}
            fill="url(#polarGlow)"
            stroke="#818cf8"
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* Interactive Data Points */}
          {pointsUpper.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.angle === pt.angle ? 6 : 2.5}
              fill={hoveredPoint?.angle === pt.angle ? '#fbbf24' : '#c7d2fe'}
              stroke="#4f46e5"
              strokeWidth="1"
              className="cursor-pointer transition-all hover:scale-150"
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-6 left-6 bg-slate-950/90 border border-amber-500/50 rounded-lg p-2.5 text-xs shadow-xl text-white font-mono pointer-events-none">
            <div className="text-amber-400 font-bold">Angle θ = {hoveredPoint.angle}°</div>
            <div>
              dσ/dΩ = {hoveredPoint.dcs.toExponential(4)} {unit === 'cm2' ? 'cm²/sr' : 'a₀²/sr'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
