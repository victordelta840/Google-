import React from 'react';

interface AstraEmblemProps {
  size?: number;
  isGlowing?: boolean;
  pulseSpeed?: 'normal' | 'fast' | 'slow';
  className?: string;
}

export const AstraEmblem: React.FC<AstraEmblemProps> = ({
  size = 120,
  isGlowing = true,
  className = '',
}) => {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="ASTRA SecureDrive Core Emblem"
    >
      {/* Outer ambient glow */}
      {isGlowing && (
        <div
          className="absolute inset-0 rounded-full blur-xl bg-cyan-500/25 pointer-events-none animate-pulse-glow"
          style={{ width: size * 1.3, height: size * 1.3, margin: `-${size * 0.15}px` }}
        />
      )}

      {/* Futuristic Shield and Delta Core SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-700 ease-out drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]"
      >
        <defs>
          <linearGradient id="astraGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="60%" stopColor="#0066ff" />
            <stop offset="100%" stopColor="#0a1936" />
          </linearGradient>
          <linearGradient id="astraGradInner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e0fcff" />
            <stop offset="100%" stopColor="#00f0ff" />
          </linearGradient>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Shield Segments */}
        <path
          d="M100 12 L170 52 L170 148 L100 188 L30 148 L30 52 Z"
          stroke="url(#astraGrad1)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeDasharray="16 6"
          className="opacity-90"
        />

        {/* Inner Tech Ring with Axis Ticks */}
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke="#00f0ff"
          strokeWidth="1.5"
          strokeDasharray="4 8"
          className="opacity-50"
        />

        {/* 4 Corner Crosshair Marks */}
        <line x1="100" y1="20" x2="100" y2="32" stroke="#00f0ff" strokeWidth="2" />
        <line x1="100" y1="168" x2="100" y2="180" stroke="#00f0ff" strokeWidth="2" />
        <line x1="20" y1="100" x2="32" y2="100" stroke="#00f0ff" strokeWidth="2" />
        <line x1="168" y1="100" x2="180" y2="100" stroke="#00f0ff" strokeWidth="2" />

        {/* Central Geometric 'A' / Security Delta */}
        <polygon
          points="100,44 148,138 126,138 100,82 74,138 52,138"
          fill="url(#astraGradInner)"
          filter="url(#cyanGlow)"
          className="transition-all duration-500"
        />

        {/* Security Core Diamond / Iris */}
        <polygon
          points="100,108 116,138 100,154 84,138"
          fill="#0066ff"
          stroke="#00f0ff"
          strokeWidth="2"
        />

        {/* Center Photon Dot */}
        <circle cx="100" cy="138" r="3.5" fill="#ffffff" />
      </svg>
    </div>
  );
};
