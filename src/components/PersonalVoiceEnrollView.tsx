import React, { useState, useRef } from 'react';
import { PersonalVoiceEnrollmentState, VoiceSampleItem } from '../types';
import { securityLogger } from './../services/securityLogger';
import {
  Mic,
  MicOff,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Info,
  Radio,
} from 'lucide-react';

interface PersonalVoiceEnrollViewProps {
  state: PersonalVoiceEnrollmentState;
  onUpdateState: (updated: PersonalVoiceEnrollmentState) => void;
}

export const PersonalVoiceEnrollView: React.FC<PersonalVoiceEnrollViewProps> = ({
  state,
  onUpdateState,
}) => {
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [activePlayingIndex, setActivePlayingIndex] = useState<number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // 1. Explicit Microphone Permission Request
  const handleRequestMicPermission = async () => {
    try {
      setStatusFeedback('Requesting microphone access from host browser...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release initial probe stream immediately
      stream.getTracks().forEach((track) => track.stop());

      const updated: PersonalVoiceEnrollmentState = {
        ...state,
        micPermission: 'granted',
      };
      onUpdateState(updated);
      setStatusFeedback('Microphone permission granted successfully.');
      securityLogger.log('INFO', 'VOICE', 'Microphone hardware permission granted by user.');
    } catch (err: unknown) {
      const updated: PersonalVoiceEnrollmentState = {
        ...state,
        micPermission: 'denied',
      };
      onUpdateState(updated);
      setStatusFeedback('Microphone permission denied. Please allow microphone access in browser settings.');
      securityLogger.log('WARN', 'VOICE', `Microphone permission denied: ${String(err)}`);
    }
  };

  // 2. Start Recording a specific sample phrase
  const handleStartRecording = async (phraseIndex: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioBlobUrl = URL.createObjectURL(audioBlob);

        const updatedSamples = state.samples.map((s, idx) => {
          if (idx === phraseIndex) {
            return {
              ...s,
              audioBlobUrl,
              audioBlob,
              durationSec: recordingSeconds,
              isReviewed: false,
              recordedAt: new Date().toISOString(),
            };
          }
          return s;
        });

        const updated: PersonalVoiceEnrollmentState = {
          ...state,
          samples: updatedSamples,
          status: 'RECORDING',
          isEnrolled: false,
        };

        onUpdateState(updated);
        setRecordingIndex(null);
        setRecordingSeconds(0);
        setStatusFeedback(`Sample ${phraseIndex + 1} recorded. Please listen to review the audio.`);
        securityLogger.log('INFO', 'VOICE', `Voice sample ${phraseIndex + 1} recorded locally.`);
      };

      setRecordingIndex(phraseIndex);
      setRecordingSeconds(0);
      recorder.start();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setStatusFeedback('Failed to start recording. Please check microphone hardware.');
      setRecordingIndex(null);
    }
  };

  // Stop current recording
  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // 3. Listen to recorded sample
  const handlePlaySample = (index: number, url: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setActivePlayingIndex(index);

    audio.onended = () => {
      setActivePlayingIndex(null);
      // Mark as reviewed
      const updatedSamples = state.samples.map((s, idx) => {
        if (idx === index) {
          return { ...s, isReviewed: true };
        }
        return s;
      });
      onUpdateState({ ...state, samples: updatedSamples });
    };

    audio.play();
  };

  const handleStopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setActivePlayingIndex(null);
    }
  };

  // 4. Delete & rerecord individual sample
  const handleDeleteSample = (index: number) => {
    if (activePlayingIndex === index) {
      handleStopPlayback();
    }

    const updatedSamples = state.samples.map((s, idx) => {
      if (idx === index) {
        if (s.audioBlobUrl) URL.revokeObjectURL(s.audioBlobUrl);
        return {
          ...s,
          audioBlobUrl: null,
          audioBlob: undefined,
          durationSec: 0,
          isReviewed: false,
          recordedAt: '',
        };
      }
      return s;
    });

    const anyRemaining = updatedSamples.some((s) => s.audioBlobUrl !== null);
    const updated: PersonalVoiceEnrollmentState = {
      ...state,
      samples: updatedSamples,
      status: anyRemaining ? 'RECORDING' : 'NOT_STARTED',
      isEnrolled: false,
    };

    onUpdateState(updated);
    setStatusFeedback(`Sample ${index + 1} deleted. Ready to re-record.`);
    securityLogger.log('INFO', 'VOICE', `Voice sample ${index + 1} deleted.`);
  };

  // 5. Confirm Enrollment (Enabled only after all samples recorded & reviewed)
  const allSamplesRecorded = state.samples.every((s) => s.audioBlobUrl !== null);
  const allSamplesReviewed = state.samples.every((s) => s.isReviewed);

  const handleConfirmEnrollment = () => {
    if (!allSamplesRecorded) {
      setStatusFeedback('Please record all 3 required voice samples before enrolling.');
      return;
    }

    const updated: PersonalVoiceEnrollmentState = {
      ...state,
      status: 'ENROLLED_PROTOTYPE',
      isEnrolled: true,
      enrollmentTimestamp: new Date().toISOString(),
      acousticFeatureCount: 39, // Simulated 39-dimensional MFCC vector
    };

    onUpdateState(updated);
    setStatusFeedback('Voice enrollment confirmed for Victor Sir (Prototype Phase).');
    securityLogger.log(
      'AUDIT',
      'VOICE',
      'Personal voice enrollment confirmed (Prototype stage). Local templates retained in memory.'
    );
  };

  // 6. Delete all enrolled voice data and repeat enrollment
  const handleDeleteAllEnrollmentData = () => {
    state.samples.forEach((s) => {
      if (s.audioBlobUrl) URL.revokeObjectURL(s.audioBlobUrl);
    });

    const resetSamples: VoiceSampleItem[] = state.samples.map((s) => ({
      ...s,
      audioBlobUrl: null,
      audioBlob: undefined,
      durationSec: 0,
      isReviewed: false,
      recordedAt: '',
    }));

    const resetState: PersonalVoiceEnrollmentState = {
      status: 'NOT_STARTED',
      micPermission: state.micPermission,
      samples: resetSamples,
      isEnrolled: false,
      enrollmentTimestamp: null,
      activeRecordingIndex: null,
    };

    onUpdateState(resetState);
    setStatusFeedback('All enrolled voice data purged. Enrollment reset to Not Started.');
    securityLogger.log('AUDIT', 'VOICE', 'All enrolled voice samples purged from memory.');
  };

  return (
    <div className="space-y-6 text-xs font-code">
      {/* Header Banner */}
      <div className="p-4 rounded-xl glass-panel-accent border border-cyan-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-cyan-400 font-hud text-sm font-bold tracking-wider">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span>2. VICTOR SIR&apos;S PERSONAL VOICE SETUP</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
              state.isEnrolled
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : state.status === 'RECORDING'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {state.isEnrolled ? 'Enrolled (Prototype only)' : state.status === 'RECORDING' ? 'Recording' : 'Not started'}
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          Enroll Victor Sir&apos;s personal voice model by recording 3 calibration phrases locally. Listen to and review each sample before confirming enrollment.
        </p>
      </div>

      {/* Critical Security Distinction Notice */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300 font-hud text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>SECURITY REQUIREMENT: VOICE RECORDINGS VS. BIOMETRIC IDENTITY</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-200/90">
          Recording voice samples and recognizing speech tokens is fundamentally different from biological speaker identity verification. True speaker verification extracts unique acoustic vocal tract features (e.g. MFCC embeddings / ECAPA-TDNN). In this browser prototype, voice enrollment is calibrated locally and <strong>does NOT unlock files or grant any storage access</strong>. Full native verification requires the later native Rust DSP component.
        </p>
      </div>

      {/* Step 1: Microphone Permission Control */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-white font-bold text-xs flex items-center gap-2 mb-1">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Step 1: Explicit Microphone Access</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Permission Status:{' '}
            <strong
              className={
                state.micPermission === 'granted'
                  ? 'text-emerald-400'
                  : state.micPermission === 'denied'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }
            >
              {state.micPermission.toUpperCase()}
            </strong>
          </p>
        </div>

        {state.micPermission !== 'granted' && (
          <button
            onClick={handleRequestMicPermission}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud font-bold text-xs transition-colors shadow-[0_0_15px_rgba(0,240,255,0.25)]"
          >
            Grant Microphone Permission
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div className="p-3 rounded-lg bg-slate-900 border border-cyan-800/60 text-cyan-200 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Step 2: 3 Calibration Voice Samples */}
      <div className="space-y-3">
        <label className="text-slate-400 text-[11px] uppercase tracking-wider block">
          Step 2: Read & Record the 3 Verification Phrases:
        </label>

        <div className="space-y-3">
          {state.samples.map((sample, idx) => {
            const isThisRecording = recordingIndex === idx;
            const hasRecorded = sample.audioBlobUrl !== null;
            const isThisPlaying = activePlayingIndex === idx;

            return (
              <div
                key={sample.id}
                className={`p-4 rounded-xl border transition-all ${
                  isThisRecording
                    ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                    : hasRecorded
                    ? 'bg-slate-900/80 border-slate-700'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-hud font-bold text-cyan-400 text-xs">
                    Sample {idx + 1} of 3
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {hasRecorded ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Recorded ({sample.durationSec}s) {sample.isReviewed ? '· Reviewed' : '· Needs Review'}
                      </span>
                    ) : (
                      <span className="text-slate-500">Not recorded</span>
                    )}
                  </div>
                </div>

                {/* Phrase to read */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-display text-sm mb-3">
                  &quot;{sample.phraseText}&quot;
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {isThisRecording ? (
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Recording ({recordingSeconds}s)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartRecording(idx)}
                      disabled={recordingIndex !== null || state.micPermission !== 'granted'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 disabled:bg-slate-900 text-cyan-300 disabled:text-slate-600 border border-cyan-800/60 disabled:border-slate-800 text-xs transition-colors"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{hasRecorded ? 'Re-record Sample' : 'Record Phrase'}</span>
                    </button>
                  )}

                  {/* Playback preview */}
                  {hasRecorded && (
                    <button
                      onClick={() => {
                        if (isThisPlaying) {
                          handleStopPlayback();
                        } else {
                          handlePlaySample(idx, sample.audioBlobUrl!);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
                    >
                      {isThisPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 text-rose-400" />
                          <span>Stop Playback</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Listen & Review</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete individual sample */}
                  {hasRecorded && (
                    <button
                      onClick={() => handleDeleteSample(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors ml-auto"
                      title="Delete sample"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrollment Actions */}
      <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {state.isEnrolled ? (
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Voice Enrollment Complete (Prototype Mode)</span>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400">
            {allSamplesRecorded
              ? allSamplesReviewed
                ? 'All samples recorded & reviewed. Ready to confirm enrollment.'
                : 'Please listen to and review all 3 samples before confirming.'
              : 'Complete all 3 voice sample recordings to enable confirmation.'}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Delete All Enrolled Data */}
          {(state.isEnrolled || state.samples.some((s) => s.audioBlobUrl !== null)) && (
            <button
              onClick={handleDeleteAllEnrollmentData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Delete Enrolled Voice Data</span>
            </button>
          )}

          {/* Confirm Enrollment Button */}
          <button
            onClick={handleConfirmEnrollment}
            disabled={!allSamplesRecorded || !allSamplesReviewed || state.isEnrolled}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-hud font-bold text-xs transition-all ${
              state.isEnrolled
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:shadow-none'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{state.isEnrolled ? 'Enrolled Successfully ✓' : 'Confirm Voice Enrollment'}</span>
          </button>
        </div>
      </div>

      {/* Local Processing Guarantee */}
      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
        PRIVACY GUARANTEE: Voice recordings are processed 100% locally in browser memory using standard MediaStream buffers. No recordings are uploaded to external cloud endpoints.
      </div>
    </div>
  );
};
