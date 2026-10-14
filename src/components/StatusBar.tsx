import React from 'react';
import {
  UsbDeviceInfo,
  SecurityState,
  VoiceEngineStatus,
} from '../types';
import {
  Shield,
  Usb,
  Volume2,
  VolumeX,
  FileCheck2,
  Layers,
  Terminal,
  AlertTriangle,
  RotateCcw,
  Globe,
  Cpu,
} from 'lucide-react';

interface StatusBarProps {
  device: UsbDeviceInfo;
  securityState: SecurityState;
  voiceStatus: VoiceEngineStatus;
  isSilent: boolean;
  setupProgress: string;
  isSetupComplete: boolean;
  activeView: 'CINEMATIC_STARTUP' | 'SETUP_DASHBOARD';
  onSelectView: (view: 'CINEMATIC_STARTUP' | 'SETUP_DASHBOARD') => void;
  onToggleSilent: () => void;
  onToggleUsbRemoval: () => void;
  onOpenTests: () => void;
  onOpenArchitecture: () => void;
  onOpenCapabilities: () => void;
  onOpenLogs: () => void;
  onReplayWelcome?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  device,
  securityState,
  voiceStatus,
  isSilent,
  setupProgress,
  isSetupComplete,
  activeView,
  onSelectView,
  onToggleSilent,
  onToggleUsbRemoval,
  onOpenTests,
  onOpenArchitecture,
  onOpenCapabilities,
  onOpenLogs,
  onReplayWelcome,
}) => {
  const isStateUnlocked = securityState === 'UNLOCKED';

  return (
    <header className="w-full bg-[#070b16]/95 border-b border-cyan-900/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30">
      {/* Brand & Security State */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-hud text-base font-bold tracking-wider text-cyan-400">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>ASTRA SECUREDRIVE</span>
          <span className="font-code text-[10px] text-cyan-600 font-normal">v1.0-HP16G</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-code text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isStateUnlocked
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : securityState === 'ERROR' || securityState === 'AUTHENTICATION_FAILED'
                ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                : 'bg-cyan-400 animate-pulse'
            }`}
          />
          <span className="text-slate-400">STATE:</span>
          <span
            className={`font-semibold ${
              isStateUnlocked
                ? 'text-emerald-400'
                : securityState === 'ERROR'
                ? 'text-rose-400'
                : 'text-cyan-300'
            }`}
          >
            {securityState}
          </span>
        </div>
      </div>

      {/* Target USB Hardware Telemetry */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded border font-code text-[11px] ${
            device.isConnected
              ? 'bg-cyan-950/40 border-cyan-800/40 text-cyan-200'
              : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
          }`}
          title={`VID: ${device.vendorId} | PID: ${device.productId} | S/N: ${device.serialNumber}`}
        >
          <Usb className="w-3.5 h-3.5" />
          <span className="font-medium">{device.productName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-300">{device.fileSystem}</span>
          <span className="text-slate-400">·</span>
          <span>{device.isConnected ? 'ONLINE' : 'DISCONNECTED'}</span>
        </div>

        {/* Eject / Reconnect USB Button for Testing Session Lock */}
        <button
          onClick={onToggleUsbRemoval}
          className={`px-2 py-1 rounded text-[11px] font-code transition-colors flex items-center gap-1 border ${
            device.isConnected
              ? 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border-slate-700 hover:border-rose-700'
              : 'bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border-cyan-600'
          }`}
          title={
            device.isConnected
              ? 'Simulate physical USB removal (tests auto session locking)'
              : 'Reconnect target HP 16GB Flash Drive'
          }
        >
          {device.isConnected ? (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Simulate Eject</span>
            </>
          ) : (
            <>
              <Usb className="w-3 h-3 text-cyan-300" />
              <span>Attach USB</span>
            </>
          )}
        </button>
      </div>

      {/* Primary View Switcher: 3D Globe Gateway vs Setup Dashboard */}
      <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 font-code text-xs">
        <button
          onClick={() => onSelectView('CINEMATIC_STARTUP')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            activeView === 'CINEMATIC_STARTUP'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>3D Globe Gateway</span>
        </button>

        <button
          onClick={() => onSelectView('SETUP_DASHBOARD')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            activeView === 'SETUP_DASHBOARD'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Setup: {setupProgress}</span>
        </button>
      </div>

      {/* Quick Action Tools */}
      <div className="flex items-center gap-2">
        {/* Replay Welcome quick button */}
        {onReplayWelcome && (
          <button
            onClick={onReplayWelcome}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-800/60 text-[11px] font-code transition-colors"
            title="Replay Hope's welcome greeting"
          >
            <RotateCcw className="w-3 h-3 text-purple-400" />
            <span className="hidden md:inline">Replay Welcome</span>
          </button>
        )}

        {/* Silent Mode toggle */}
        <button
          onClick={onToggleSilent}
          className={`p-1.5 rounded border transition-colors ${
            isSilent
              ? 'bg-slate-800 text-slate-400 border-slate-700'
              : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60 hover:bg-cyan-900/60'
          }`}
          title={isSilent ? 'Unmute Text-to-Speech' : 'Mute Text-to-Speech (Silent Mode)'}
          aria-label={isSilent ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isSilent ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Cross-Platform Capability Matrix Probe */}
        <button
          onClick={onOpenCapabilities}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition-colors"
          title="Inspect Cross-Platform Runtime Probes & Limitations"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline">Platform Probes</span>
        </button>

        {/* Security Tests Suite */}
        <button
          onClick={onOpenTests}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition-colors"
          title="Open Security Test Suite (16 Automated & Interactive Test Cases)"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline">Security Tests</span>
        </button>

        {/* Architecture Viewer */}
        <button
          onClick={onOpenArchitecture}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition-colors"
          title="View Cross-Platform Architecture & Storage Spec"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden xl:inline">Architecture</span>
        </button>

        {/* Real-Time Security Audit Log */}
        <button
          onClick={onOpenLogs}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 transition-colors"
          title="View Real-Time Security Audit Log"
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xl:inline">Audit Log</span>
        </button>
      </div>
    </header>
  );
};
