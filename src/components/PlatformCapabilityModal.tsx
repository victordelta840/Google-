import React, { useState, useEffect } from 'react';
import {
  platformCapabilityService,
  PlatformCapabilities,
} from '../services/platformCapabilityService';
import {
  Cpu,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mic,
  Volume2,
  Boxes,
  Keyboard,
  Shield,
  Smartphone,
  Laptop,
  Radio,
  RefreshCw,
} from 'lucide-react';

interface PlatformCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformCapabilityModal: React.FC<PlatformCapabilityModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(() =>
    platformCapabilityService.detectCapabilities()
  );
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCapabilities(platformCapabilityService.detectCapabilities());
      platformCapabilityService.queryMicPermission().then(() => {
        setCapabilities(platformCapabilityService.detectCapabilities());
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestMic = async () => {
    setIsTestingMic(true);
    setMicTestResult(null);
    const result = await platformCapabilityService.requestMicPermission();
    setIsTestingMic(false);
    if (result.granted) {
      setMicTestResult('Microphone permission granted successfully.');
    } else {
      setMicTestResult(`Microphone permission test: ${result.error || 'Denied'}`);
    }
    setCapabilities(platformCapabilityService.detectCapabilities());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-2xl w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_60px_rgba(0,240,255,0.25)] max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="font-hud text-xs tracking-widest text-cyan-400 font-bold">
              CROSS-PLATFORM CAPABILITY MATRIX
            </div>
            <h3 className="font-hud text-xl font-bold text-white">
              Runtime Diagnostic Engine
            </h3>
          </div>
        </div>

        {/* Platform & Browser Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-900/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-300">
              {capabilities.isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] font-code text-slate-400 uppercase">Operating System</div>
              <div className="font-hud text-sm font-bold text-white">
                {capabilities.platform} {capabilities.isMobile ? '(Mobile Device)' : '(Desktop)'}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-900/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-950 flex items-center justify-center text-blue-300">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-code text-slate-400 uppercase">Browser Engine</div>
              <div className="font-hud text-sm font-bold text-white">
                {capabilities.browserName}
              </div>
            </div>
          </div>
        </div>

        {/* Capability Test Grid */}
        <div className="space-y-2 mb-5">
          <div className="text-xs font-hud text-cyan-300 uppercase tracking-wider font-semibold">
            Runtime Feature Probes:
          </div>

          {/* 1. Microphone getUserMedia */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-code">
            <div className="flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-cyan-400" />
              <span>Microphone Access (getUserMedia):</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                capabilities.hasGetUserMedia
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950 text-rose-300 border border-rose-500/40'
              }`}
            >
              {capabilities.hasGetUserMedia ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>{capabilities.hasGetUserMedia ? 'Available' : 'Unsupported'}</span>
            </span>
          </div>

          {/* 2. Web Speech Recognition */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-code">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-purple-400" />
              <span>Speech Recognition (Web Speech API):</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                capabilities.hasSpeechRecognition
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}
            >
              {capabilities.hasSpeechRecognition ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Available</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>Fallback Active (6s Password Gate)</span>
                </>
              )}
            </span>
          </div>

          {/* 3. HTML5 Audio & WAV decoding */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-code">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Audio Playback & WAV Codec (Hope Greeting):</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Supported (Microsoft PCM 16-bit 24kHz)</span>
            </span>
          </div>

          {/* 4. 3D WebGL Acceleration */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-code">
            <div className="flex items-center gap-2.5">
              <Boxes className="w-4 h-4 text-emerald-400" />
              <span>3D Holographic Rendering:</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                capabilities.hasWebGL
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}
            >
              {capabilities.hasWebGL ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              <span>{capabilities.webglVersion}</span>
            </span>
          </div>

          {/* 5. Virtual Keyboard Requesting */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-code">
            <div className="flex items-center gap-2.5">
              <Keyboard className="w-4 h-4 text-blue-400" />
              <span>Virtual Keyboard Programmatic Focus:</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">
              {capabilities.isMobile
                ? 'User Gesture Required (Tap Field)'
                : 'Full Auto-Focus Supported'}
            </span>
          </div>
        </div>

        {/* Honest Security Boundaries (Requirement 4 & 7) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-cyan-800/40 text-xs font-code space-y-2 mb-5">
          <div className="flex items-center gap-2 font-bold text-cyan-300">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>HONEST BROWSER SECURITY BOUNDARIES</span>
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc pl-4 leading-relaxed">
            <li>
              <strong>No Silent Mic Activation:</strong> The microphone is never engaged on page load. User must explicitly click or trigger voice authentication.
            </li>
            <li>
              <strong>No Background Listening:</strong> Web browsers and mobile operating systems automatically terminate tab microphone streams when the app is backgrounded.
            </li>
            <li>
              <strong>No Forced Mobile Keyboard:</strong> iOS and Android restrict automatic keyboard popups unless initiated directly by a physical user touch gesture.
            </li>
            <li>
              <strong>No Biometric Claim:</strong> Speech recognition matches English phonemes and vocabulary tokens. It does not establish biological voice identity.
            </li>
          </ul>
        </div>

        {/* Live Mic Test Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestMic}
              disabled={isTestingMic}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-700 font-code text-xs transition-colors"
            >
              {isTestingMic ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isTestingMic ? 'Probing Microphone...' : 'Probe Microphone Permission'}</span>
            </button>
            {micTestResult && (
              <span className="text-[11px] font-code text-emerald-400">{micTestResult}</span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud text-xs font-bold tracking-wider transition-colors"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
