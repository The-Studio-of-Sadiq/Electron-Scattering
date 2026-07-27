import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  theme?: 'dark' | 'light';
}

export const ElectronScatteringLogo: React.FC<LogoProps> = ({
  className = '',
  size = 36,
  showText = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 select-none transition-transform hover:scale-105"
      >
        <defs>
          {/* Main Brand Gradient */}
          <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>

          <linearGradient id="nucleusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          <radialGradient id="nucleusGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Circular Trajectory Arc with Arrow */}
        <path
          d="M 50 12 A 38 38 0 1 0 50 88"
          fill="none"
          stroke={isLight ? '#2563EB' : '#3B82F6'}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Arrowhead at top */}
        <path
          d="M 44 18 L 53 11 L 44 6"
          fill="none"
          stroke={isLight ? '#2563EB' : '#3B82F6'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Polar Scattering Lobe (Right) - Main Outer Contour */}
        <path
          d="M 50 50 C 58 28, 88 22, 88 50 C 88 78, 58 72, 50 50 Z"
          fill={isLight ? 'rgba(124, 58, 237, 0.06)' : 'rgba(124, 58, 237, 0.15)'}
          stroke="url(#brandGradient)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner Nested Lobe Contour Lines */}
        <path
          d="M 50 50 C 56 36, 76 32, 76 50 C 76 68, 56 64, 50 50 Z"
          fill="none"
          stroke={isLight ? '#8B5CF6' : '#A78BFA'}
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />
        <path
          d="M 50 50 C 53 42, 65 40, 65 50 C 65 60, 53 58, 50 50 Z"
          fill="none"
          stroke={isLight ? '#C4B5FD' : '#C4B5FD'}
          strokeWidth="1.2"
          opacity="0.6"
        />

        {/* Horizontal Trajectory Axis */}
        <line
          x1="12"
          y1="50"
          x2="50"
          y2="50"
          stroke={isLight ? '#2563EB' : '#60A5FA'}
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />

        {/* Incoming Electron Node (Left) */}
        <circle
          cx="22"
          cy="50"
          r="8"
          fill="url(#nucleusGradient)"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
        <text
          x="22"
          y="53.5"
          fontFamily="system-ui, sans-serif"
          fontSize="9"
          fontWeight="bold"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          e⁻
        </text>

        {/* Central Atomic Nucleus Target */}
        <circle cx="50" cy="50" r="10" fill="url(#nucleusGlow)" />
        <circle cx="50" cy="50" r="5" fill="url(#nucleusGradient)" />
        <circle cx="48.5" cy="48.5" r="1.5" fill="#FFFFFF" opacity="0.8" />

        {/* Bottom Code Symbol </> */}
        <g transform="translate(50, 88)">
          <text
            x="0"
            y="4"
            fontFamily="monospace, sans-serif"
            fontSize="12"
            fontWeight="bold"
            fill={isLight ? '#7C3AED' : '#A78BFA'}
            textAnchor="middle"
          >
            &lt;/&gt;
          </text>
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-bold text-base tracking-tight leading-none ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Electron Scattering
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wider uppercase mt-1 ${
              isLight ? 'text-indigo-600' : 'text-indigo-400'
            }`}
          >
            Interactive ELSEPA Interface
          </span>
        </div>
      )}
    </div>
  );
};
