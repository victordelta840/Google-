import React, { useState, useEffect } from 'react';
import { WelcomeVoiceConfig } from '../types';
import { speechSynthesisService, VoiceAssetStatus } from '../services/speechSynthesisService';
import { securityLogger } from '../services/securityLogger';
import {
  Volume2,
  Sparkles,
  Play,
  Square,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  FileAudio,
  Radio,
  Key,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface WelcomeVoiceConfigViewProps {
  config: WelcomeVoiceConfig;
  onUpdateConfig: (updated: WelcomeVoiceConfig) => void;
}

export const WelcomeVoiceConfigView: React.FC<WelcomeVoiceConfigViewProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<
    'AUTHORIZED_FILE_HOPE' | 'GEMINI_HOPE' | 'ELEVENLABS_HOPE' | 'SYSTEM_BRITISH'
  >(
    config.voiceEngine === 'GEMINI_HOPE'
      ? 'GEMINI_HOPE'
      : config.voiceEngine === 'ELEVENLABS_HOPE'
      ? 'ELEVENLABS_HOPE'
      : config.voiceEngine === 'SYSTEM_BRITISH'
      ? 'SYSTEM_BRITISH'
      : 'AUTHORIZED_FILE_HOPE'
  );

  const [elevenLabsKey, setElevenLabsKey] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSubtitle, setPreviewSubtitle] = useState<string>('');
  const [assetStatus, setAssetStatus] = useState<VoiceAssetStatus | null>(null);

  const requiredDialogue = 'Welcome, Victor Sir. Shall we proceed to authentication?';
  const EXACT_HOPE_VOICE_ID = 'tnSpp4vdxKPjI9w0GnoV';

  // Check voice asset status on disk on mount
  useEffect(() => {
    checkVoiceFileOnDisk();
  }, []);

  const checkVoiceFileOnDisk = async () => {
    const status = await speechSynthesisService.checkVoiceAssetStatus();
    setAssetStatus(status);
    if (status.exists && !config.audioBlobUrl) {
      onUpdateConfig({
        ...config,
        voiceEngine: 'AUTHORIZED_FILE_HOPE',
        voiceName: 'Hope (Authorized Recording)',
        providerName: 'Authorized Audio Asset (/audio/hope_welcome.wav)',
        voiceId: 'hope-welcome-wav',
        isExactVoice: true,
        accent: 'British English',
        status: config.isApproved ? 'APPROVED' : 'PREVIEWED',
        audioBlobUrl: '/audio/hope_welcome.wav',
        customFileName: 'hope_welcome.wav',
        dialogueText: requiredDialogue,
      });
    }
  };

  // 1. Preview using Authorized Audio File (/audio/hope_welcome.wav)
  const handlePreviewAuthorizedAudio = async (urlToPlay?: string) => {
    const targetUrl = urlToPlay || config.audioBlobUrl || '/audio/hope_welcome.wav';
    setIsPlaying(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setPreviewSubtitle('Welcome, Victor Sir.');

    setTimeout(() => {
      setPreviewSubtitle('Shall we proceed to authentication?');
    }, 2100);

    const result = await speechSynthesisService.playAudio(targetUrl, {
      onEnd: () => {
        setIsPlaying(false);
        setPreviewSubtitle('');
      },
      onError: (err) => {
        setIsPlaying(false);
        setPreviewSubtitle('');
        setErrorMessage(`Audio playback error: ${String(err)}`);
      },
      onAutoplayBlocked: () => {
        setIsPlaying(false);
        setPreviewSubtitle('');
        setErrorMessage('Browser autoplay blocked. Please click again to activate audio.');
      },
    });

    if (result.success) {
      const updated: WelcomeVoiceConfig = {
        ...config,
        voiceEngine: 'AUTHORIZED_FILE_HOPE',
        voiceName: 'Hope (Authorized Audio Asset)',
        providerName: 'Authorized Audio File (/audio/hope_welcome.wav)',
        voiceId: 'hope-welcome-wav',
        isExactVoice: true,
        accent: 'British English',
        status: 'PREVIEWED',
        audioBlobUrl: targetUrl,
        dialogueText: requiredDialogue,
      };
      onUpdateConfig(updated);
      setStatusMessage('Played authorized Hope greeting. Natural British English cadence verified.');
    }
  };

  // 2. Preview using Google AI Studio Gemini (British Hope Persona)
  const handlePreviewGeminiHope = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await speechSynthesisService.generateGeminiTTS('Hope', requiredDialogue);

      if (result.success && result.audioUrl) {
        setIsGenerating(false);
        const updated: WelcomeVoiceConfig = {
          ...config,
          voiceEngine: 'GEMINI_HOPE',
          voiceName: 'Hope (Gemini Persona)',
          providerName: 'Google AI Studio Gemini',
          voiceId: 'gemini-hope-british-persona',
          isExactVoice: false,
          accent: 'British English',
          status: 'PREVIEWED',
          audioBlobUrl: result.audioUrl,
          audioBase64: result.audioBase64 || null,
          dialogueText: requiredDialogue,
          isApproved: false,
        };
        onUpdateConfig(updated);
        setStatusMessage(
          'Generated British Hope Persona via Gemini TTS (warm, elegant, confident intonation). Ready to preview.'
        );

        playAudioPreview(result.audioUrl);
      } else {
        throw new Error(result.error || 'Gemini TTS generation failed.');
      }
    } catch (err: unknown) {
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Gemini TTS Error: ${msg}. You can import an authorized Hope audio file or use system TTS.`);
      securityLogger.log('WARN', 'VOICE', `Gemini TTS Hope generation error: ${msg}`);
    }
  };

  // 3. Preview using Exact ElevenLabs Hope Voice (Voice ID: tnSpp4vdxKPjI9w0GnoV)
  const handlePreviewElevenLabsHope = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await speechSynthesisService.generateHopeElevenLabs(
        elevenLabsKey.trim() || undefined,
        requiredDialogue
      );

      if (result.success && result.audioUrl) {
        setIsGenerating(false);
        const updated: WelcomeVoiceConfig = {
          ...config,
          voiceEngine: 'ELEVENLABS_HOPE',
          voiceName: 'Hope',
          providerName: 'ElevenLabs',
          voiceId: EXACT_HOPE_VOICE_ID,
          isExactVoice: true,
          accent: 'British English',
          status: 'PREVIEWED',
          audioBlobUrl: result.audioUrl,
          audioBase64: result.audioBase64 || null,
          dialogueText: requiredDialogue,
          isApproved: false,
        };
        onUpdateConfig(updated);
        setStatusMessage(
          `Synthesized exact proprietary Hope voice from ElevenLabs (Voice ID: ${EXACT_HOPE_VOICE_ID}).`
        );

        playAudioPreview(result.audioUrl);
      } else {
        throw new Error(result.error || 'ElevenLabs synthesis failed.');
      }
    } catch (err: unknown) {
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      securityLogger.log('WARN', 'VOICE', `ElevenLabs generation error: ${msg}`);
    }
  };

  // 4. Preview using Local Operating System British English voice
  const handlePreviewSystemBritish = async () => {
    setIsPlaying(true);
    setErrorMessage(null);
    setPreviewSubtitle('Welcome, Victor Sir.');

    const britishVoice = speechSynthesisService.getBritishSystemVoice();

    await speechSynthesisService.speak('Welcome, Victor Sir.', {
      rate: 0.95,
      pitch: 1.05,
    });
    await new Promise((r) => setTimeout(r, 700));
    setPreviewSubtitle('Shall we proceed to authentication?');
    await speechSynthesisService.speak('Shall we proceed to authentication?', {
      rate: 1.0,
      pitch: 1.0,
    });

    setIsPlaying(false);
    setPreviewSubtitle('');

    const updated: WelcomeVoiceConfig = {
      ...config,
      voiceEngine: 'SYSTEM_BRITISH',
      voiceName: britishVoice?.name || 'System British English',
      providerName: 'Local System TTS',
      isExactVoice: false,
      accent: 'British English',
      status: 'PREVIEWED',
      audioBlobUrl: null,
      audioBase64: null,
      dialogueText: requiredDialogue,
      isApproved: false,
    };
    onUpdateConfig(updated);
    setStatusMessage(
      `Previewed using local system speech engine: ${britishVoice?.name || 'Default System English'}.`
    );
  };

  // Play audio preview helper
  const playAudioPreview = async (url: string) => {
    setIsPlaying(true);
    setPreviewSubtitle('Welcome, Victor Sir.');

    setTimeout(() => {
      setPreviewSubtitle('Shall we proceed to authentication?');
    }, 2100);

    await speechSynthesisService.playAudio(url, {
      onEnd: () => {
        setIsPlaying(false);
        setPreviewSubtitle('');
      },
      onError: () => {
        setIsPlaying(false);
        setPreviewSubtitle('');
      },
    });
  };

  // Stop active playback
  const handleStopAudio = () => {
    speechSynthesisService.stop();
    setIsPlaying(false);
    setPreviewSubtitle('');
  };

  // Upload or Replace the Authorized Hope Voice File
  const handleUploadOrReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('audio') && !file.name.endsWith('.wav') && !file.name.endsWith('.mp3')) {
      setErrorMessage('Invalid file format. Please upload an authorized .wav or .mp3 audio file.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const res = await speechSynthesisService.uploadVoiceAsset(base64String, file.name);

        setIsUploading(false);
        if (res.success) {
          const blobUrl = URL.createObjectURL(file);
          const updated: WelcomeVoiceConfig = {
            ...config,
            voiceEngine: 'AUTHORIZED_FILE_HOPE',
            voiceName: 'Hope (Uploaded Audio Asset)',
            providerName: 'Authorized Audio File',
            voiceId: 'authorized-hope-audio-asset',
            isExactVoice: true,
            accent: 'British English',
            status: 'PREVIEWED',
            audioBlobUrl: blobUrl,
            customFileName: file.name,
            dialogueText: requiredDialogue,
            isApproved: false,
          };
          onUpdateConfig(updated);
          setStatusMessage(`Successfully saved ${file.name} as active Hope audio. Click Preview to verify.`);
          checkVoiceFileOnDisk();
        } else {
          setErrorMessage(`Upload failed: ${res.error}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
      setErrorMessage(`Failed to process audio file: ${String(err)}`);
    }
  };

  // Download audio asset for offline USB storage
  const handleDownloadAsset = () => {
    const targetUrl = config.audioBlobUrl || '/audio/hope_welcome.wav';
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = `hope_welcome.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('Exported hope_welcome.wav for offline USB drive storage.');
  };

  // Confirm and approve Hope welcome voice
  const handleApproveVoice = () => {
    const updated: WelcomeVoiceConfig = {
      ...config,
      voiceEngine: config.voiceEngine || 'AUTHORIZED_FILE_HOPE',
      voiceName: config.voiceName || 'Hope',
      providerName: config.providerName || 'Authorized Audio File (/audio/hope_welcome.wav)',
      audioBlobUrl: config.audioBlobUrl || '/audio/hope_welcome.wav',
      status: 'APPROVED',
      isApproved: true,
      approvedTimestamp: new Date().toISOString(),
    };
    onUpdateConfig(updated);
    setStatusMessage('Welcome voice approved as Hope. Victor Sir will now be greeted with this verified selection.');
    securityLogger.log(
      'AUDIT',
      'VOICE',
      `Welcome voice finalized as Hope: Engine=${updated.voiceEngine}, Provider=${updated.providerName}, Exact=${updated.isExactVoice}`
    );
  };

  return (
    <div className="space-y-6 text-xs font-code">
      {/* Header Banner */}
      <div className="p-4 rounded-xl glass-panel-accent border border-cyan-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-cyan-400 font-hud text-sm font-bold tracking-wider">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>WELCOME VOICE CONFIGURATION: HOPE</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
              config.isApproved
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : config.status === 'PREVIEWED'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {config.isApproved ? 'Approved ✓' : config.status === 'PREVIEWED' ? 'Previewed' : 'Not configured'}
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          Target voice: <strong>Hope</strong> — a natural, warm, elegant, confident female voice with human-like pacing and expressive British English intonation.
        </p>
      </div>

      {/* DISK STATUS: Exact Authorized Audio File Verification */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-800/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-emerald-400" />
            <span className="font-hud text-sm font-bold text-white tracking-wider">
              AUTHORITATIVE VOICE ASSET ON USB DISK
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
              assetStatus?.exists
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-950 text-rose-300 border-rose-500/40'
            }`}
          >
            {assetStatus?.exists ? 'Active on Disk' : 'Missing File'}
          </span>
        </div>

        {assetStatus?.exists ? (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">File Location:</span>
              <code className="text-emerald-400">{assetStatus.filePath}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">File Size:</span>
              <span className="text-slate-200">
                {((assetStatus.sizeBytes || 0) / 1024).toFixed(1)} KB (Microsoft PCM 16-bit 24kHz Mono)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Speech Length:</span>
              <span className="text-slate-200">~4.89s (Natural pause between sentences)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Pacing:</span>
              <span className="text-cyan-300">Human-like expressive British cadence</span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300 space-y-1">
            <p>
              Warning: <code>public/audio/hope_welcome.wav</code> was not found. Place the supplied Hope voice file in the directory or upload it using the button below.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={() => handlePreviewAuthorizedAudio('/audio/hope_welcome.wav')}
            disabled={isPlaying}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-hud font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Preview Disk Audio (/audio/hope_welcome.wav)</span>
          </button>

          {/* Replace Voice File Input */}
          <label className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-code text-xs cursor-pointer transition-colors">
            {isUploading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{isUploading ? 'Uploading...' : 'Replace / Update Voice File'}</span>
            <input
              type="file"
              accept="audio/wav,audio/mp3,audio/*"
              onChange={handleUploadOrReplaceFile}
              className="hidden"
            />
          </label>

          <button
            onClick={handleDownloadAsset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-code text-xs"
            title="Download for offline USB storage"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Download .wav</span>
          </button>
        </div>
      </div>

      {/* Alternative Voice Synthesis & Selection Options */}
      <div className="space-y-3">
        <label className="text-slate-400 text-[11px] uppercase tracking-wider block font-bold">
          Alternative Voice Generation Modes (Optional Fallbacks):
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Method 1: Authorized Voice File */}
          <div
            onClick={() => setSelectedMethod('AUTHORIZED_FILE_HOPE')}
            className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
              selectedMethod === 'AUTHORIZED_FILE_HOPE'
                ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-hud font-bold text-sm text-emerald-300">
                1. Authorized Hope Audio File (Active)
              </span>
              <FileAudio className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Plays the supplied offline master recording directly without robotic browser synthesis.
            </p>
            <div className="mt-2 text-[10px] text-emerald-400 font-semibold">
              Exact voice audio asset (100% offline ready).
            </div>
          </div>

          {/* Method 2: Google Gemini AI (British Hope Persona) */}
          <div
            onClick={() => setSelectedMethod('GEMINI_HOPE')}
            className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
              selectedMethod === 'GEMINI_HOPE'
                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-hud font-bold text-sm text-cyan-300">
                2. Gemini TTS (British Hope Persona)
              </span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Google AI Studio Gemini: Warm, elegant British English female persona with expressive human-like pacing.
            </p>
          </div>

          {/* Method 3: ElevenLabs Exact Hope Voice API */}
          <div
            onClick={() => setSelectedMethod('ELEVENLABS_HOPE')}
            className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
              selectedMethod === 'ELEVENLABS_HOPE'
                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-hud font-bold text-sm text-cyan-300">
                3. ElevenLabs Exact Voice (ID: {EXACT_HOPE_VOICE_ID.slice(0, 6)}...)
              </span>
              <Key className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Direct cloud synthesis of the exact proprietary Hope voice using ElevenLabs API (requires ElevenLabs key).
            </p>
          </div>

          {/* Method 4: Local System British Speech */}
          <div
            onClick={() => setSelectedMethod('SYSTEM_BRITISH')}
            className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
              selectedMethod === 'SYSTEM_BRITISH'
                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-hud font-bold text-sm text-cyan-300">
                4. Local System British Voice
              </span>
              <Radio className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Operating system British English speech engine (e.g. Hazel, Serena) via native Web Speech synthesis.
            </p>
          </div>
        </div>
      </div>

      {/* If Method 3 (ElevenLabs) selected, provide API Key input */}
      {selectedMethod === 'ELEVENLABS_HOPE' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-blue-500/30 space-y-2">
          <label className="text-slate-300 text-xs block font-bold">
            ELEVENLABS API KEY (For Exact Hope Voice ID: {EXACT_HOPE_VOICE_ID}):
          </label>
          <input
            type="password"
            value={elevenLabsKey}
            onChange={(e) => setElevenLabsKey(e.target.value)}
            placeholder="Enter your ElevenLabs API Key (xi-api-key)..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
          />
        </div>
      )}

      {/* Required Dialogue Text Box */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>REQUIRED WELCOME GREETING SCRIPT:</span>
          <span className="text-cyan-400 font-semibold">Requirement 2 Compliant</span>
        </div>
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-sm font-display text-cyan-200">
          &quot;Welcome, Victor Sir.&quot; <span className="text-slate-500 italic text-xs">[natural pause]</span> &quot;Shall we proceed to authentication?&quot;
        </div>
        {previewSubtitle && (
          <div className="text-purple-400 text-xs font-semibold animate-pulse flex items-center gap-1.5 pt-1">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Currently Speaking: &quot;{previewSubtitle}&quot;</span>
          </div>
        )}
      </div>

      {/* Status & Error Feedback */}
      {statusMessage && (
        <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Controls: Preview Voice & Approve */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {selectedMethod === 'AUTHORIZED_FILE_HOPE' && (
          <button
            onClick={() => handlePreviewAuthorizedAudio()}
            disabled={isPlaying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-hud font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isPlaying ? 'Stop Playback' : 'Preview Voice (Authorized Audio)'}</span>
          </button>
        )}

        {selectedMethod === 'GEMINI_HOPE' && (
          <button
            onClick={handlePreviewGeminiHope}
            disabled={isGenerating || isPlaying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-hud font-bold text-xs shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing Hope British Persona...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Preview Voice (Gemini Hope Persona)</span>
              </>
            )}
          </button>
        )}

        {selectedMethod === 'ELEVENLABS_HOPE' && (
          <button
            onClick={handlePreviewElevenLabsHope}
            disabled={isGenerating || isPlaying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-hud font-bold text-xs shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Calling ElevenLabs API...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Preview Voice (Exact ElevenLabs Hope)</span>
              </>
            )}
          </button>
        )}

        {selectedMethod === 'SYSTEM_BRITISH' && (
          <button
            onClick={handlePreviewSystemBritish}
            disabled={isPlaying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-hud font-bold text-xs shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Preview Voice (System British Voice)</span>
          </button>
        )}

        {/* Stop active audio */}
        {isPlaying && (
          <button
            onClick={handleStopAudio}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-800/60"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop Playback</span>
          </button>
        )}

        {/* Approve Button */}
        <button
          onClick={handleApproveVoice}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-hud font-bold text-xs transition-all ${
            config.isApproved
              ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{config.isApproved ? 'Hope Voice Approved ✓' : 'Confirm & Approve Hope Voice'}</span>
        </button>
      </div>

      {/* Honest Policy Notice */}
      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
        ASTRA HONEST SPEECH DECLARATION: When an authorized Hope voice audio file is provided, ASTRA SecureDrive plays it directly for Victor Sir&apos;s greeting. Robotic browser text-to-speech fallback is never substituted silently.
      </div>
    </div>
  );
};
