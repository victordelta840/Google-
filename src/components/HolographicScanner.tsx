import React from 'react';

interface HolographicScannerProps {
  size?: number;
  scanning?: boolean;
  statusText?: string;
  progressPercent?: number;
}

export const HolographicScanner: React.FC<HolographicScannerProps> = ({
  size = 280,
  scanning = true,
  statusText = 'INITIALIZING SECURITY PROTOCOLS',
  progressPercent = 100,
}) => {
  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ width: size, height: size }}
      aria-label="Holographic Security Scanner"
    >
      {/* Outer Glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl bg-cyan-500/10 pointer-events-none"
      />

      {/* Primary Outer Reticle */}
      <div
        className={`absolute inset-2 rounded-full border border-cyan-500/30 ${
          scanning ? 'animate-radar' : ''
        }`}
        style={{ borderStyle: 'dashed' }}
      />

      {/* Secondary Counter-Rotating Ring */}
      <div
        className="absolute inset-8 rounded-full border border-blue-500/40"
        style={{
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          animation: scanning ? 'radar-sweep 8s linear infinite reverse' : 'none',
        }}
      />

      {/* Target Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <div className="h-full w-px bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
      </div>

      {/* Radar sweep beam */}
      {scanning && (
        <div
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none animate-radar"
          style={{
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(0, 240, 255, 0.25) 0deg, transparent 60deg, transparent 360deg)',
          }}
        />
      )}

      {/* Center Telemetry Readout */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        <div className="font-code text-[11px] tracking-widest text-cyan-400/80 mb-1">
          HP SECURE DRIVE 16GB
        </div>
        <div className="font-hud text-xl font-bold tracking-wider text-slate-100 uppercase">
          {statusText}
        </div>
        <div className="mt-2 font-code text-xs text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
          SCANNING: {Math.min(100, Math.max(0, progressPercent))}%
        </div>
      </div>

      {/* Calibration Degree Markers */}
      <div className="absolute top-2 font-code text-[9px] text-cyan-500/50">000°</div>
      <div className="absolute right-2 font-code text-[9px] text-cyan-500/50">090°</div>
      <div className="absolute bottom-2 font-code text-[9px] text-cyan-500/50">180°</div>
      <div className="absolute left-2 font-code text-[9px] text-cyan-500/50">270°</div>
    </div>
  );
};
