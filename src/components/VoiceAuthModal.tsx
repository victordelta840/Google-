import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  X,
  ShieldAlert,
  Clock,
  KeyRound,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import { platformCapabilityService } from '../services/platformCapabilityService';
import { securityLogger } from '../services/securityLogger';

export type VoiceAuthStatus =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'LISTENING'
  | 'PROCESSING'
  | 'MATCHED'
  | 'TIMEOUT_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED';

interface VoiceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeoutFallback: (reason: string) => void;
  onSelectPasswordDirectly: () => void;
  onVoiceVerified?: (phrase: string) => void;
}

export const VoiceAuthModal: React.FC<VoiceAuthModalProps> = ({
  isOpen,
  onClose,
  onTimeoutFallback,
  onSelectPasswordDirectly,
  onVoiceVerified,
}) => {
  const [status, setStatus] = useState<VoiceAuthStatus>('IDLE');
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(6000);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedTranscript, setDetectedTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFiredRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  const TIMEOUT_DURATION_MS = 6000; // 6 seconds strict requirement

  // Clean up all resources (timer, mic stream, speech recognition, audio context)
  const cleanupAll = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignored
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignored
      }
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Trigger the 6-second fallback to password authentication
  const triggerFallback = useCallback(
    (reason: string) => {
      if (timeoutFiredRef.current) return;
      timeoutFiredRef.current = true;

      cleanupAll();
      setStatus('TIMEOUT_EXPIRED');
      securityLogger.log(
        'INFO',
        'AUTH',
        `Voice authentication timed out (6.0s elapsed). Automatically engaging password fallback: ${reason}`
      );

      // Brief pause to display timeout notice, then engage password modal
      setTimeout(() => {
        onTimeoutFallback(reason);
      }, 350);
    },
    [cleanupAll, onTimeoutFallback]
  );

  // Start Voice-First Activation attempt when modal opens
  const startVoiceAttempt = useCallback(async () => {
    cleanupAll();
    timeoutFiredRef.current = false;
    setErrorMessage(null);
    setDetectedTranscript('');
    setTimeRemainingMs(TIMEOUT_DURATION_MS);

    // 1. Feature detection
    const caps = platformCapabilityService.detectCapabilities();
    if (!caps.hasGetUserMedia) {
      setStatus('UNSUPPORTED');
      setErrorMessage('Microphone access (getUserMedia) is not supported in this browser.');
      triggerFallback('Microphone API unsupported');
      return;
    }

    // 2. Request microphone permission explicitly through platform mechanism
    setStatus('REQUESTING_PERMISSION');
    securityLogger.log('INFO', 'VOICE', 'Requesting explicit microphone permission for voice authentication...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err: unknown) {
      const errStr = String(err);
      setStatus('PERMISSION_DENIED');
      setErrorMessage('Microphone permission denied by user or OS policy.');
      securityLogger.log('WARN', 'VOICE', `Microphone permission denied: ${errStr}`);
      triggerFallback('Microphone permission denied');
      return;
    }

    // 3. Setup real-time audio volume monitoring for live waveform feedback
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(mediaStreamRef.current);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        levelIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(1.0, avg / 80));
        }, 50);
      }
    } catch {
      // Fallback: visual heartbeat simulation
      levelIntervalRef.current = setInterval(() => {
        setAudioLevel(0.3 + Math.sin(Date.now() / 150) * 0.25);
      }, 50);
    }

    // 4. Setup SpeechRecognition (where supported)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript.trim().toLowerCase();
          setDetectedTranscript(transcript);

          // Check for supported activation phrases
          if (
            transcript.includes('astra') ||
            transcript.includes('authenticate') ||
            transcript.includes('unlock') ||
            transcript.includes('victor') ||
            transcript.includes('proceed') ||
            transcript.includes('open')
          ) {
            setStatus('MATCHED');
            cleanupAll();
            securityLogger.log(
              'INFO',
              'VOICE',
              `Recognized voice activation phrase: "${transcript}". Proceeding to password gate.`
            );
            onVoiceVerified?.(transcript);
            setTimeout(() => {
              onSelectPasswordDirectly();
            }, 600);
          } else if (transcript.includes('password') || transcript.includes('cancel')) {
            cleanupAll();
            onSelectPasswordDirectly();
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onerror = (e: any) => {
          securityLogger.log('WARN', 'VOICE', `SpeechRecognition event error: ${e.error}`);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        securityLogger.log('WARN', 'VOICE', 'SpeechRecognition init failed', { err: String(err) });
      }
    }

    // 5. Start strict 6-second countdown timer
    setStatus('LISTENING');
    startTimeRef.current = Date.now();
    securityLogger.log(
      'INFO',
      'AUTH',
      '6-Second Voice Authentication window started. Awaiting operator voice response.'
    );

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, TIMEOUT_DURATION_MS - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        triggerFallback('6-Second Timeout Reached with no valid voice response');
      }
    }, 40);
  }, [cleanupAll, triggerFallback, onVoiceVerified, onSelectPasswordDirectly]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      startVoiceAttempt();
    } else {
      cleanupAll();
      setStatus('IDLE');
    }

    return () => {
      cleanupAll();
    };
  }, [isOpen, startVoiceAttempt, cleanupAll]);

  if (!isOpen) return null;

  const secondsDisplay = (timeRemainingMs / 1000).toFixed(1);
  const progressPercent = Math.max(0, Math.min(100, (timeRemainingMs / TIMEOUT_DURATION_MS) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-lg w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_60px_rgba(0,240,255,0.25)]">
        {/* Close Button */}
        <button
          onClick={() => {
            cleanupAll();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Cancel Voice Authentication"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Mic className="w-5 h-5 animate-pulse text-cyan-400" />
          </div>
          <div>
            <div className="font-hud text-xs tracking-widest text-cyan-400 font-bold">
              VOICE-FIRST GATEWAY
            </div>
            <h3 className="font-hud text-xl font-bold text-white">
              Voice Authentication Attempt
            </h3>
          </div>
        </div>

        {/* Critical Distinction Notice (Requirement 1 & 7) */}
        <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-code space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>VOICE RECOGNITION vs BIOMETRIC VERIFICATION</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            Spoken phrase detection recognizes vocabulary commands. It <strong>does not verify operator biological identity</strong>. A 6-second window is provided; master password entry remains the cryptographic authority.
          </p>
        </div>

        {/* 6-SECOND TIMEOUT PROGRESS BAR */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-5">
          <div className="flex items-center justify-between text-xs font-code mb-2">
            <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Voice Response Window</span>
            </span>
            <span className="font-mono text-base font-bold text-cyan-300">
              {secondsDisplay}s
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                timeRemainingMs < 2000
                  ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                  : timeRemainingMs < 3500
                  ? 'bg-amber-400 shadow-[0_0_10px_#facc15]'
                  : 'bg-cyan-400 shadow-[0_0_10px_#00f0ff]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-code text-slate-400 mt-2">
            <span>Timeout fallback triggers at 0.0s</span>
            <span>Auto-launches Password Panel</span>
          </div>
        </div>

        {/* MIC LISTENING VISUALIZER */}
        <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-950/70 border border-slate-800 text-center mb-4">
          <div className="relative mb-3">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
                status === 'MATCHED'
                  ? 'border-emerald-400 bg-emerald-950/60 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                  : status === 'LISTENING'
                  ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_30px_rgba(0,240,255,0.4)] animate-pulse'
                  : status === 'TIMEOUT_EXPIRED'
                  ? 'border-amber-400 bg-amber-950/60'
                  : 'border-slate-700 bg-slate-900'
              }`}
              style={{
                transform: `scale(${1.0 + (audioLevel || 0) * 0.25})`,
              }}
            >
              {status === 'MATCHED' ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : status === 'REQUESTING_PERMISSION' ? (
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              ) : status === 'TIMEOUT_EXPIRED' ? (
                <KeyRound className="w-8 h-8 text-amber-400" />
              ) : (
                <Mic className="w-8 h-8 text-cyan-400" />
              )}
            </div>

            {/* Audio Waveform Ripple Rings */}
            {status === 'LISTENING' && (
              <>
                <div
                  className="absolute inset-0 rounded-full border border-cyan-400/40 pointer-events-none animate-ping"
                  style={{ animationDuration: '1.4s' }}
                />
                <div
                  className="absolute -inset-2 rounded-full border border-blue-500/20 pointer-events-none animate-ping"
                  style={{ animationDuration: '2.2s' }}
                />
              </>
            )}
          </div>

          <div className="font-hud text-xs tracking-wider text-white font-bold mb-1">
            {status === 'REQUESTING_PERMISSION' && 'REQUESTING MICROPHONE PERMISSION...'}
            {status === 'LISTENING' && 'MICROPHONE ACTIVE — SPEAK ACTIVATION PHRASE'}
            {status === 'MATCHED' && 'ACTIVATION PHRASE DETECTED'}
            {status === 'TIMEOUT_EXPIRED' && '6-SECOND WINDOW EXPIRED — ENGAGING PASSWORD'}
            {status === 'PERMISSION_DENIED' && 'MICROPHONE ACCESS DENIED'}
            {status === 'UNSUPPORTED' && 'SPEECH APIS UNAVAILABLE ON THIS DEVICE'}
          </div>

          <p className="text-[11px] font-code text-slate-300 max-w-sm leading-relaxed">
            {status === 'LISTENING' && (
              <>
                Speak: <code className="text-cyan-300 font-bold">&quot;ASTRA, authenticate&quot;</code> or{' '}
                <code className="text-cyan-300 font-bold">&quot;Unlock SecureDrive&quot;</code>
              </>
            )}
            {status === 'TIMEOUT_EXPIRED' &&
              'No response detected within 6 seconds. Opening password authentication automatically.'}
            {status === 'PERMISSION_DENIED' &&
              'Microphone permission blocked. Use direct master password entry below.'}
          </p>

          {/* Real-time speech transcript feedback */}
          {detectedTranscript && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-800/60 font-code text-xs text-cyan-300 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Heard: &quot;{detectedTranscript}&quot;</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-2 text-rose-400 text-xs font-code flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => {
              cleanupAll();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700 transition-colors"
          >
            Cancel Attempt
          </button>

          <button
            onClick={() => {
              cleanupAll();
              onSelectPasswordDirectly();
            }}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud text-xs font-bold tracking-wider shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
          >
            <KeyRound className="w-4 h-4" />
            <span>Enter Password Now →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
