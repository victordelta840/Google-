import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UsbDeviceInfo,
  VoiceEngineStatus,
  WelcomeVoiceConfig,
} from '../types';
import { HolographicGlobe3D, GlobeState } from './HolographicGlobe3D';
import { speechSynthesisService, VoiceAssetStatus } from '../services/speechSynthesisService';
import { securityLogger } from '../services/securityLogger';
import {
  Mic,
  KeyRound,
  XCircle,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Clock,
} from 'lucide-react';

interface CinematicWelcomeProps {
  device: UsbDeviceInfo;
  voiceStatus: VoiceEngineStatus;
  welcomeVoiceConfig?: WelcomeVoiceConfig | null;
  onSelectPasswordAuth: () => void;
  onSelectVoiceAuth: () => void;
  onCancel: () => void;
  onOpenSetupDashboard: () => void;
  onOpenCapabilities?: () => void;
  isSilent: boolean;
  onToggleSilent: () => void;
  externalGlobeState?: GlobeState;
  onSuccessAnimationComplete?: () => void;
}

export const CinematicWelcome: React.FC<CinematicWelcomeProps> = ({
  device,
  voiceStatus,
  welcomeVoiceConfig,
  onSelectPasswordAuth,
  onSelectVoiceAuth,
  onCancel,
  onOpenSetupDashboard,
  onOpenCapabilities,
  isSilent,
  onToggleSilent,
  externalGlobeState,
  onSuccessAnimationComplete,
}) => {
  // 4-Phase Visual State: 'IDLE' | 'SPEAKING' | 'AUTHENTICATING' | 'SUCCESS'
  const [globeState, setGlobeState] = useState<GlobeState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [spokenSubtitle, setSpokenSubtitle] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [voiceAssetStatus, setVoiceAssetStatus] = useState<VoiceAssetStatus | null>(null);

  // Phase tracker for welcome sequence
  const [isWelcomeComplete, setIsWelcomeComplete] = useState<boolean>(false);

  // Prevent multiple executions across re-renders
  const hasTriggeredWelcomeRef = useRef<boolean>(false);

  // Sync with external globe state (e.g., when password modal is open -> AUTHENTICATING, or auth success -> SUCCESS)
  useEffect(() => {
    if (externalGlobeState) {
      setGlobeState(externalGlobeState);
    }
  }, [externalGlobeState]);

  // Check voice asset status on mount
  useEffect(() => {
    speechSynthesisService.checkVoiceAssetStatus().then((status) => {
      setVoiceAssetStatus(status);
      if (status.exists) {
        securityLogger.log(
          'INFO',
          'VOICE',
          `Authorized Hope voice asset confirmed: ${status.fileName} (${((status.sizeBytes || 0) / 1024).toFixed(1)} KB)`
        );
      } else {
        securityLogger.log('WARN', 'VOICE', 'Hope voice audio asset not detected at public/audio/hope_welcome.wav');
      }
    });
  }, []);

  // Play Hope Greeting with real-time globe synchronization and subtitle updates
  const playHopeGreeting = useCallback(async () => {
    setAutoplayBlocked(false);
    setIsSpeaking(true);
    setGlobeState('SPEAKING');

    securityLogger.log('INFO', 'VOICE', 'Initiating Hope welcome greeting for Victor Sir...');

    const result = await speechSynthesisService.playWelcomeDialogue(
      welcomeVoiceConfig || null,
      (text) => setSpokenSubtitle(text),
      {
        onStart: () => {
          setIsSpeaking(true);
          setGlobeState('SPEAKING');
          setAutoplayBlocked(false);
        },
        onAudioLevel: (lvl) => {
          setAudioLevel(lvl);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setAudioLevel(0);
          setGlobeState('IDLE');
          setIsWelcomeComplete(true);
          securityLogger.log(
            'INFO',
            'AUTH',
            'Hope welcome greeting completed. Authentication options active.'
          );
        },
        onAutoplayBlocked: () => {
          setIsSpeaking(false);
          setAudioLevel(0);
          setGlobeState('IDLE');
          setAutoplayBlocked(true);
          securityLogger.log(
            'WARN',
            'VOICE',
            'Browser blocked automatic audio playback. User click required.'
          );
        },
        onError: () => {
          setIsSpeaking(false);
          setAudioLevel(0);
          setGlobeState('IDLE');
          setIsWelcomeComplete(true);
        },
      }
    );

    if (result.autoplayBlocked) {
      setAutoplayBlocked(true);
      setGlobeState('IDLE');
      setIsSpeaking(false);
    }
  }, [welcomeVoiceConfig]);

  // 1. Mandatory Auto-startup Animation & Welcome Sequence
  // Automatically triggers once per session without requiring user to press a Start button
  // NEVER starts microphone listening automatically on page load
  useEffect(() => {
    if (hasTriggeredWelcomeRef.current) return;
    hasTriggeredWelcomeRef.current = true;

    // Small delay for clean initial Three.js render and hardware telemetry sync
    const timer = setTimeout(() => {
      playHopeGreeting();
    }, 600);

    return () => clearTimeout(timer);
  }, [playHopeGreeting]);

  // Manual Replay Greeting
  const handleReplayGreeting = () => {
    speechSynthesisService.stop();
    playHopeGreeting();
  };

  // User click when autoplay was restricted by browser
  const handleUserActivateAudio = () => {
    setAutoplayBlocked(false);
    playHopeGreeting();
  };

  // Skip welcome directly to authentication
  const handleSkipToAuth = () => {
    speechSynthesisService.stop();
    setIsSpeaking(false);
    setAudioLevel(0);
    setGlobeState('IDLE');
    setSpokenSubtitle('');
    setIsWelcomeComplete(true);
  };

  // Full reset of startup sequence
  const handleRestartStartup = () => {
    speechSynthesisService.stop();
    setIsWelcomeComplete(false);
    setSpokenSubtitle('');
    playHopeGreeting();
  };

  // Select Password
  const handleChoosePassword = () => {
    setGlobeState('AUTHENTICATING');
    onSelectPasswordAuth();
  };

  // Select Voice
  const handleChooseVoice = () => {
    setGlobeState('AUTHENTICATING');
    onSelectVoiceAuth();
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between p-4 md:p-6 bg-tactical-grid bg-radial-vignette min-h-[640px] select-none overflow-hidden">
      {/* Background Ambience Lines */}
      <div className="absolute w-[680px] h-[680px] rounded-full border border-cyan-500/5 pointer-events-none" />
      <div className="absolute w-[980px] h-[980px] rounded-full border border-blue-500/5 pointer-events-none" />

      {/* TOP HUD BAR: Hardware Telemetry & Audio Autoplay Banner */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-cyan-900/40 text-[11px] font-code">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">HARDWARE:</span>
          <span className="text-cyan-300 font-semibold">{device.productName}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{device.serialNumber}</span>
          <span className="text-slate-500">·</span>
          <span className="text-emerald-400 font-semibold">16 GB (14.91 GiB)</span>
        </div>

        {/* Operational State Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-code text-[11px] transition-colors ${
              globeState === 'SPEAKING'
                ? 'bg-purple-950/80 border-purple-500/60 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : globeState === 'AUTHENTICATING'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : globeState === 'SUCCESS'
                ? 'bg-cyan-950/80 border-cyan-400/80 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                globeState === 'SPEAKING'
                  ? 'bg-purple-400 animate-pulse'
                  : globeState === 'AUTHENTICATING'
                  ? 'bg-amber-400 animate-ping'
                  : globeState === 'SUCCESS'
                  ? 'bg-cyan-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span>
              {globeState === 'SPEAKING'
                ? 'PHASE 2: SPEAKING (HOPE VOCAL MATRIX)'
                : globeState === 'AUTHENTICATING'
                ? 'PHASE 3: AUTHENTICATING (GOLD SCANNER)'
                : globeState === 'SUCCESS'
                ? 'PHASE 4: ACCESS VERIFIED (CYAN BURST)'
                : 'PHASE 1: IDLE / READY (GREEN MONITOR)'}
            </span>
          </div>

          {/* Quick Mute Toggle */}
          <button
            onClick={onToggleSilent}
            className={`p-1.5 rounded-lg border text-xs font-code transition-colors ${
              isSilent
                ? 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                : 'bg-slate-900 border-slate-700 hover:border-cyan-500/40 text-slate-300'
            }`}
            title={isSilent ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isSilent ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* AUTOPLAY BLOCKED BANNER (Clean, non-intrusive, explicit user activation) */}
      {autoplayBlocked && (
        <div className="z-30 w-full max-w-lg mt-3 p-3.5 rounded-xl bg-purple-950/90 border border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.35)] flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-900/60 border border-purple-400/50 flex items-center justify-center text-purple-300 animate-pulse">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-hud text-xs font-bold text-white tracking-wider">
                AUDIO AUTOPLAY RESTRICTED BY BROWSER
              </div>
              <p className="text-[11px] font-code text-purple-200">
                Click below to play Hope&apos;s greeting for Victor Sir.
              </p>
            </div>
          </div>

          <button
            onClick={handleUserActivateAudio}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-hud text-xs font-bold tracking-wider shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all hover:scale-105"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Welcome</span>
          </button>
        </div>
      )}

      {/* CENTER STAGE: 3D HOLOGRAPHIC GLOBE FRONT AND CENTER */}
      <div className="flex flex-col items-center justify-center my-auto relative z-10">
        {/* The 3D Globe with dynamic 4-phase color lerping and voice-reactive pulses */}
        <div className="relative">
          <HolographicGlobe3D
            state={globeState}
            size={360}
            audioLevel={audioLevel}
            onSuccessAnimationComplete={onSuccessAnimationComplete}
          />

          {/* Voice Audio Source Indicator Badge */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/90 px-3 py-1 rounded-full border border-cyan-800/60 text-[11px] font-code flex items-center gap-2 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                voiceAssetStatus?.exists ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-400">Voice Source:</span>
            <strong
              className={
                voiceAssetStatus?.exists ? 'text-emerald-300' : 'text-amber-300'
              }
            >
              {voiceAssetStatus?.exists
                ? 'Hope (Authorized Recording · hope_welcome.wav)'
                : 'Hope (Gemini Persona / System Voice)'}
            </strong>
          </div>
        </div>

        {/* Dynamic Subtitles & Greeting Text */}
        <div className="mt-8 text-center max-w-lg min-h-[90px] flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 font-hud text-xs tracking-widest text-cyan-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>ASTRA OPERATOR GREETING</span>
            {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold font-hud tracking-wide text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.3)]">
            Welcome, Victor Sir.
          </h1>

          {/* Synchronized Subtitle Bubble */}
          <div className="mt-2 px-5 py-2 rounded-lg bg-slate-900/80 border border-cyan-900/40 text-cyan-200 font-display text-base transition-all duration-300">
            {spokenSubtitle || (
              <span className="text-slate-400 italic text-sm">
                Shall we proceed to authentication?
              </span>
            )}
          </div>
        </div>

        {/* Replay Controls & Quick Navigation */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleReplayGreeting}
            disabled={isSpeaking}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-code text-xs transition-colors ${
              isSpeaking
                ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border-purple-800/60 hover:border-purple-500/80'
            }`}
            title="Replay Hope's welcome greeting"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Replay Welcome</span>
          </button>

          {!isWelcomeComplete && (
            <button
              onClick={handleSkipToAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 font-code text-xs transition-colors"
            >
              <span>Skip to Authentication →</span>
            </button>
          )}

          {onOpenCapabilities && (
            <button
              onClick={onOpenCapabilities}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 font-code text-xs transition-colors"
              title="Inspect Cross-Platform Capabilities & Limitations"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Platform Probes</span>
            </button>
          )}

          <button
            onClick={onOpenSetupDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-800/60 font-code text-xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Setup Dashboard</span>
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION: AUTHENTICATION SELECTION CARDS */}
      <div className="w-full max-w-2xl mt-4 z-20">
        <div className="bg-slate-950/80 p-4 md:p-5 rounded-2xl border border-cyan-900/40 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
            <div>
              <div className="font-hud text-xs tracking-widest text-cyan-400 font-bold">
                GATEWAY ACCESS
              </div>
              <h2 className="text-lg font-bold font-hud text-white">
                Select Authentication Gateway
              </h2>
            </div>
            <span className="text-[11px] font-code text-slate-400">
              Encrypted Container: <code className="text-cyan-300">secure-container.astra</code>
            </span>
          </div>

          {/* Two Prominent Authentication Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Voice Authentication (Voice-First with 6s Automatic Password Fallback) */}
            <button
              onClick={handleChooseVoice}
              className="group p-4 rounded-xl text-left bg-gradient-to-br from-slate-900/90 to-cyan-950/30 hover:to-cyan-900/40 border border-cyan-500/20 hover:border-cyan-400 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-code bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>6s Fallback</span>
                  </span>
                </div>
                <div className="font-hud text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  1. Voice Authentication
                </div>
                <p className="text-[11px] font-code text-slate-400 mt-1 leading-relaxed">
                  Explicit mic activation. 6-second timeout automatically falls back to Master Password if no voice is detected.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-code text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>Start Voice Attempt (6s Window) →</span>
              </div>
            </button>

            {/* 2. Password Authentication (Master Password with Auto-Focus and Mobile Optimization) */}
            <button
              onClick={handleChoosePassword}
              className="group p-4 rounded-xl text-left bg-gradient-to-br from-slate-900/90 to-blue-950/30 hover:to-blue-900/40 border border-blue-500/20 hover:border-blue-400 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-code bg-blue-950 text-blue-300 border border-blue-500/40">
                    No Default
                  </span>
                </div>
                <div className="font-hud text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                  2. Password Authentication
                </div>
                <p className="text-[11px] font-code text-slate-400 mt-1 leading-relaxed">
                  Direct PBKDF2/AES-GCM key derivation. Zero-plaintext. Mobile virtual keyboard focus optimized.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-code text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>Enter Master Password →</span>
              </div>
            </button>
          </div>

          {/* Footer Controls: Cancel / Lock Session & Notice */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-code text-slate-400">
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Cancel / Lock Session</span>
            </button>

            <button
              onClick={handleRestartStartup}
              className="text-[11px] text-cyan-500 hover:text-cyan-300 underline"
            >
              Restart Startup Sequence
            </button>

            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Zero-leakage memory guarantee · Authenticated access only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
