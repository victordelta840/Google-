import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  CheckCircle2,
  KeyRound,
  Play,
  Square,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { platformCapabilityService } from '../services/platformCapabilityService';
import { securityLogger } from '../services/securityLogger';
import { PersonalVoiceEnrollmentState, VoiceSampleItem } from '../types';

interface MinimalVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeoutFallback: (reason: string) => void;
  onSelectPasswordDirectly: () => void;
  personalVoice: PersonalVoiceEnrollmentState;
  onUpdatePersonalVoice: (updated: PersonalVoiceEnrollmentState) => void;
  onVoiceVerified?: (phrase: string) => void;
}

export const MinimalVoiceModal: React.FC<MinimalVoiceModalProps> = ({
  isOpen,
  onClose,
  onTimeoutFallback,
  onSelectPasswordDirectly,
  personalVoice,
  onUpdatePersonalVoice,
  onVoiceVerified,
}) => {
  const [activeTab, setActiveTab] = useState<'AUTH' | 'SETUP'>('AUTH');

  // --- Voice Authentication State ---
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(6000);
  const [authStatus, setAuthStatus] = useState<
    'IDLE' | 'REQUESTING' | 'LISTENING' | 'MATCHED' | 'TIMEOUT' | 'DENIED'
  >('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [detectedPhrase, setDetectedPhrase] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // --- Voice Setup (Enrollment) State ---
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFiredRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  // Enrollment recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const TIMEOUT_DURATION_MS = 6000; // Strict 6-second timeout

  const cleanupAuthResources = useCallback(() => {
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

  const triggerFallback = useCallback(
    (reason: string) => {
      if (timeoutFiredRef.current) return;
      timeoutFiredRef.current = true;
      cleanupAuthResources();
      setAuthStatus('TIMEOUT');
      securityLogger.log('INFO', 'AUTH', `Voice timeout: ${reason}. Switching to password.`);
      setTimeout(() => {
        onTimeoutFallback(reason);
      }, 300);
    },
    [cleanupAuthResources, onTimeoutFallback]
  );

  const startListening = useCallback(async () => {
    cleanupAuthResources();
    timeoutFiredRef.current = false;
    setAuthError(null);
    setDetectedPhrase('');
    setTimeRemainingMs(TIMEOUT_DURATION_MS);
    setAuthStatus('REQUESTING');

    const caps = platformCapabilityService.detectCapabilities();
    if (!caps.hasGetUserMedia) {
      setAuthStatus('DENIED');
      setAuthError('Microphone not supported in this browser.');
      triggerFallback('Microphone API unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch {
      setAuthStatus('DENIED');
      setAuthError('Microphone access denied by browser or OS.');
      triggerFallback('Microphone permission denied');
      return;
    }

    // Live volume visualizer
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const src = ctx.createMediaStreamSource(mediaStreamRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        levelIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(1.0, avg / 80));
        }, 50);
      }
    } catch {
      levelIntervalRef.current = setInterval(() => {
        setAudioLevel(0.3 + Math.sin(Date.now() / 150) * 0.25);
      }, 50);
    }

    // Speech recognition
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
          const transcript = event.results[event.resultIndex][0].transcript.trim().toLowerCase();
          setDetectedPhrase(transcript);

          if (
            transcript.includes('astra') ||
            transcript.includes('authenticate') ||
            transcript.includes('victor') ||
            transcript.includes('proceed') ||
            transcript.includes('unlock') ||
            transcript.includes('open')
          ) {
            setAuthStatus('MATCHED');
            cleanupAuthResources();
            onVoiceVerified?.(transcript);
            setTimeout(() => {
              onSelectPasswordDirectly();
            }, 600);
          } else if (transcript.includes('password') || transcript.includes('cancel')) {
            cleanupAuthResources();
            onSelectPasswordDirectly();
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } catch {
        // Fallback to timer
      }
    }

    // Strict 6-second countdown
    setAuthStatus('LISTENING');
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, TIMEOUT_DURATION_MS - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        triggerFallback('6-second timeout elapsed with no speech detected');
      }
    }, 50);
  }, [cleanupAuthResources, onSelectPasswordDirectly, onVoiceVerified, triggerFallback]);

  useEffect(() => {
    if (isOpen && activeTab === 'AUTH') {
      startListening();
    } else {
      cleanupAuthResources();
    }
    return () => {
      cleanupAuthResources();
    };
  }, [isOpen, activeTab, startListening, cleanupAuthResources]);

  // --- Enrollment Recording Logic ---
  const handleStartRecording = async (index: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        const updatedSamples = [...personalVoice.samples];
        updatedSamples[index] = {
          ...updatedSamples[index],
          audioBlobUrl: url,
          durationSec: recordingSeconds,
          isReviewed: true,
          recordedAt: new Date().toISOString(),
        };

        const allReviewed = updatedSamples.every((s) => s.isReviewed && s.audioBlobUrl);

        onUpdatePersonalVoice({
          ...personalVoice,
          samples: updatedSamples,
          isEnrolled: allReviewed,
          enrollmentTimestamp: allReviewed ? new Date().toISOString() : null,
          status: allReviewed ? 'ENROLLED_PROTOTYPE' : 'RECORDING',
        });
      };

      recorder.start();
      setRecordingIndex(index);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // mic error
    }
  };

  const handleStopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecordingIndex(null);
  };

  const handlePlaySample = (index: number, url: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setPlayingIndex(index);
    audio.play();
    audio.onended = () => setPlayingIndex(null);
    audio.onerror = () => setPlayingIndex(null);
  };

  if (!isOpen) return null;

  const secondsLeft = (timeRemainingMs / 1000).toFixed(1);
  const progressPercent = Math.max(0, Math.min(100, (timeRemainingMs / TIMEOUT_DURATION_MS) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-950/95 border border-cyan-500/40 p-5 shadow-[0_0_35px_rgba(0,240,255,0.25)] flex flex-col">
        {/* Top Control Bar: Tabs & Close */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('AUTH')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-hud tracking-wider transition-all ${
                activeTab === 'AUTH'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>VOICE AUTH</span>
            </button>
            <button
              onClick={() => {
                cleanupAuthResources();
                setActiveTab('SETUP');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-hud tracking-wider transition-all ${
                activeTab === 'SETUP'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ENROLLMENT</span>
            </button>
          </div>

          <button
            onClick={() => {
              cleanupAuthResources();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TAB 1: Voice Authentication (6-second Timeout) */}
        {activeTab === 'AUTH' && (
          <div className="flex flex-col items-center justify-center py-6">
            {/* Animated Pulsing Mic Icon */}
            <div className="relative mb-5 flex items-center justify-center">
              <div
                className="absolute w-24 h-24 rounded-full bg-cyan-500/20 blur-lg transition-transform pointer-events-none"
                style={{
                  transform: `scale(${1.0 + audioLevel * 0.8})`,
                }}
              />
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all ${
                  authStatus === 'MATCHED'
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                    : authStatus === 'DENIED'
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                    : 'bg-cyan-950/80 border-cyan-400/80 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                }`}
                style={{
                  transform: `scale(${1.0 + audioLevel * 0.2})`,
                }}
              >
                {authStatus === 'MATCHED' ? (
                  <CheckCircle2 className="w-9 h-9" />
                ) : authStatus === 'DENIED' ? (
                  <MicOff className="w-9 h-9" />
                ) : (
                  <Mic className="w-9 h-9" />
                )}
              </div>
            </div>

            {/* Strict 6-Second Countdown Timer Bar */}
            <div className="w-full max-w-xs space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-[11px] font-code text-cyan-300">
                <span>LISTENING TIMEOUT</span>
                <span className="font-bold">{secondsLeft}s / 6.0s</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-75"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Live Transcript / Status */}
            {detectedPhrase && (
              <div className="px-3 py-1 rounded bg-slate-900 border border-cyan-500/30 text-xs font-code text-cyan-300 mb-3 text-center">
                &ldquo;{detectedPhrase}&rdquo;
              </div>
            )}

            {authError && (
              <p className="text-xs font-code text-rose-400 mb-3 text-center max-w-xs">
                {authError}
              </p>
            )}

            {/* Direct Switch to Password Fallback Button */}
            <button
              onClick={() => {
                cleanupAuthResources();
                onSelectPasswordDirectly();
              }}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/40 text-blue-300 text-xs font-hud tracking-wider transition-all hover:scale-105"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>SWITCH TO PASSWORD FALLBACK</span>
            </button>
          </div>
        )}

        {/* TAB 2: Personal Voice Enrollment (Samples) */}
        {activeTab === 'SETUP' && (
          <div className="flex flex-col py-3 space-y-3 max-h-[420px] overflow-y-auto pr-1">
            <div className="text-[11px] font-code text-slate-400 mb-1">
              Record 3 verification phrases to calibrate your personal voice profile:
            </div>

            {personalVoice.samples.map((sample: VoiceSampleItem, idx: number) => {
              const isRecording = recordingIndex === idx;
              const isPlaying = playingIndex === idx;

              return (
                <div
                  key={sample.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs font-hud">
                    <span className="text-cyan-400 font-semibold">PHRASE {idx + 1}</span>
                    {sample.isReviewed && (
                      <span className="text-[10px] font-code text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Recorded
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-code text-slate-200 italic leading-relaxed">
                    &ldquo;{sample.phraseText}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {isRecording ? (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-code animate-pulse"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop ({recordingSeconds}s)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartRecording(idx)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-code transition-colors"
                      >
                        <Mic className="w-3 h-3" />
                        <span>{sample.isReviewed ? 'Re-record' : 'Record'}</span>
                      </button>
                    )}

                    {sample.audioBlobUrl && (
                      <button
                        onClick={() => handlePlaySample(idx, sample.audioBlobUrl!)}
                        disabled={isPlaying || isRecording}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-code transition-colors"
                      >
                        {isPlaying ? <Volume2 className="w-3 h-3 animate-pulse" /> : <Play className="w-3 h-3" />}
                        <span>Play</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="text-[10px] font-code text-slate-500 pt-1">
              Note: Speech recognition verifies phrase content; biometric acoustic matching requires calibrated audio samples.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
