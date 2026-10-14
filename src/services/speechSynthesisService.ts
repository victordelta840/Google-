/**
 * ASTRA SecureDrive - Text-To-Speech (TTS) Integration Engine
 * 
 * Strict Compliance with Hope Voice Specifications:
 * - Uses authorized Hope audio recording (/audio/hope_welcome.wav) directly
 * - Detects browser autoplay policy blocks and coordinates smooth user-click resumption
 * - Synchronizes real-time audio playback events with 3D Holographic Globe visual states
 * - Supports Gemini AI Hope Persona generation & ElevenLabs Hope voice
 * - Detects Microsoft Zira on Windows where installed
 * - Natural pause handling and synchronized subtitles
 */

import { VoiceEngineStatus, WelcomeVoiceConfig } from '../types';
import { securityLogger } from './securityLogger';

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onAudioLevel?: (level: number) => void;
  onAutoplayBlocked?: () => void;
  rate?: number;
  pitch?: number;
}

export interface VoiceAssetStatus {
  exists: boolean;
  fileName?: string;
  filePath?: string;
  url?: string;
  sizeBytes?: number;
  mimeType?: string;
  voiceName?: string;
  greetingText?: string;
  lastModified?: string;
  exactAudioProvided?: boolean;
  error?: string;
  instructions?: string;
}

class SpeechSynthesisService {
  private isSilent: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private levelInterval: NodeJS.Timeout | null = null;
  private statusListeners: ((status: VoiceEngineStatus) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.notifyStatus();
      };
    }
  }

  public detectPlatform(): VoiceEngineStatus['platform'] {
    if (typeof navigator === 'undefined') return 'Unknown';
    const ua = navigator.userAgent;
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux') || ua.includes('X11')) return 'Linux';
    return 'Unknown';
  }

  public getStatus(): VoiceEngineStatus {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const recognitionSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    const platform = this.detectPlatform();

    if (!supported) {
      return {
        available: false,
        isMicrosoftZira: false,
        detectedVoiceName: 'None (SpeechSynthesis unavailable)',
        engineName: 'Browser Fallback (Text-Only)',
        platform,
        speechSynthesisSupported: false,
        speechRecognitionSupported: recognitionSupported,
        micPermission: 'prompt',
      };
    }

    const voices = window.speechSynthesis.getVoices();
    // Look specifically for Microsoft Zira Desktop or Mobile
    const ziraVoice = voices.find(
      (v) =>
        v.name.toLowerCase().includes('zira') ||
        v.name.includes('Microsoft Zira')
    );

    if (ziraVoice) {
      return {
        available: true,
        isMicrosoftZira: true,
        detectedVoiceName: ziraVoice.name,
        engineName: 'Microsoft Speech API (SAPI 5 / OneCore)',
        platform,
        speechSynthesisSupported: true,
        speechRecognitionSupported: recognitionSupported,
        micPermission: 'prompt',
      };
    }

    // Secondary platform default voices
    let fallbackVoice: SpeechSynthesisVoice | undefined;
    if (platform === 'macOS') {
      fallbackVoice = voices.find((v) => v.name.includes('Samantha') || v.lang.startsWith('en'));
    } else {
      fallbackVoice = voices.find((v) => v.lang.startsWith('en')) || voices[0];
    }

    return {
      available: voices.length > 0,
      isMicrosoftZira: false,
      detectedVoiceName: fallbackVoice?.name ?? 'Generic System Default',
      engineName: platform === 'macOS' ? 'Apple Speech Synthesis (AVSpeechSynthesizer)' : 'Host System WebSpeech Voice',
      platform,
      speechSynthesisSupported: true,
      speechRecognitionSupported: recognitionSupported,
      micPermission: 'prompt',
    };
  }

  public setSilentMode(silent: boolean): void {
    this.isSilent = silent;
    this.stop();
    securityLogger.log(
      'INFO',
      'VOICE',
      `Audio speech playback set to ${silent ? 'MUTED / SILENT_MODE' : 'ACTIVE'}`
    );
  }

  public isSilentMode(): boolean {
    return this.isSilent;
  }

  public stop(): void {
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Queries the server endpoint to verify whether the authorized Hope audio asset is present
   */
  public async checkVoiceAssetStatus(): Promise<VoiceAssetStatus> {
    try {
      const res = await fetch('/api/voice-asset/status');
      if (!res.ok) {
        return {
          exists: false,
          error: `HTTP ${res.status} returned while checking voice asset.`,
        };
      }
      return await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exists: false,
        error: `Could not reach voice asset endpoint: ${msg}`,
      };
    }
  }

  /**
   * Uploads and persists a replacement voice file to the public audio directory
   */
  public async uploadVoiceAsset(
    audioBase64: string,
    fileName: string = 'hope_welcome.wav'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const res = await fetch('/api/voice-asset/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, fileName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload audio asset.');
      }
      return { success: true, url: data.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Generates natural female welcome voice using Gemini TTS via server proxy with British Hope persona
   */
  public async generateGeminiTTS(
    voiceName: string = 'Hope',
    dialogueText: string = 'Welcome, Victor Sir. Shall we proceed to authentication?'
  ): Promise<{ success: boolean; audioUrl?: string; audioBase64?: string; isExactVoice?: boolean; error?: string; notice?: string }> {
    try {
      securityLogger.log('INFO', 'VOICE', `Requesting Gemini TTS generation (${voiceName})...`);
      
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: dialogueText,
          voiceName,
          stylePrompt: 'Hope persona: natural, warm, elegant, confident British English female voice with human-like pacing and expressive intonation. Addressing Victor Sir with poise and warmth.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gemini TTS request returned failure.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);

      securityLogger.log(
        'AUDIT',
        'VOICE',
        `Gemini Hope Persona audio generated successfully (${(blob.size / 1024).toFixed(1)} KB)`
      );

      return {
        success: true,
        audioUrl,
        audioBase64: data.audioBase64,
        isExactVoice: false,
        notice: data.notice,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      securityLogger.log('WARN', 'VOICE', `Gemini TTS failed: ${msg}`);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Generates exact proprietary Hope voice via ElevenLabs API (Voice ID: tnSpp4vdxKPjI9w0GnoV)
   */
  public async generateHopeElevenLabs(
    apiKey?: string,
    dialogueText: string = 'Welcome, Victor Sir. Shall we proceed to authentication?'
  ): Promise<{ success: boolean; audioUrl?: string; audioBase64?: string; voiceId?: string; isExactVoice?: boolean; error?: string }> {
    try {
      securityLogger.log('INFO', 'VOICE', 'Requesting ElevenLabs Hope Voice (ID: tnSpp4vdxKPjI9w0GnoV)...');

      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: dialogueText,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ElevenLabs request failed.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      securityLogger.log('AUDIT', 'VOICE', 'Exact ElevenLabs Hope voice generated successfully.');

      return {
        success: true,
        audioUrl,
        audioBase64: data.audioBase64,
        voiceId: data.voiceId,
        isExactVoice: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      securityLogger.log('WARN', 'VOICE', `ElevenLabs generation error: ${msg}`);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Finds any installed British English voice on the local operating system
   */
  public getBritishSystemVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === 'en-GB' || v.lang === 'en_GB') ||
      voices.find((v) => v.name.includes('UK') || v.name.includes('British') || v.name.includes('Hazel') || v.name.includes('Serena')) ||
      null
    );
  }

  /**
   * Plays a pre-rendered audio asset with real-time level feedback and browser autoplay detection
   */
  public async playAudio(
    audioSource: string,
    options?: SpeakOptions
  ): Promise<{ success: boolean; autoplayBlocked?: boolean; error?: string }> {
    if (this.isSilent) {
      options?.onStart?.();
      options?.onEnd?.();
      return { success: true };
    }

    this.stop();

    return new Promise((resolve) => {
      const audio = new Audio(audioSource);
      this.currentAudioElement = audio;

      let startTime = Date.now();
      let hasEnded = false;

      const cleanupMonitoring = () => {
        if (this.levelInterval) {
          clearInterval(this.levelInterval);
          this.levelInterval = null;
        }
        options?.onAudioLevel?.(0);
      };

      const startLevelMonitoring = () => {
        startTime = Date.now();
        this.levelInterval = setInterval(() => {
          if (!this.currentAudioElement || this.currentAudioElement.paused || hasEnded) {
            cleanupMonitoring();
            return;
          }
          const elapsed = (Date.now() - startTime) / 1000;
          // Natural speech cadence envelope with natural pause between 1.8s and 2.4s
          let level = 0.38 + Math.sin(elapsed * 11) * 0.28 + Math.sin(elapsed * 22) * 0.16;
          if (elapsed > 1.8 && elapsed < 2.35) {
            level = 0.04; // Natural pause in speech
          }
          options?.onAudioLevel?.(Math.max(0.05, Math.min(1.0, level)));
        }, 50);
      };

      audio.onplay = () => {
        securityLogger.log('INFO', 'VOICE', `Audio playback started: ${audioSource}`);
        options?.onStart?.();
        startLevelMonitoring();
      };

      audio.onended = () => {
        hasEnded = true;
        cleanupMonitoring();
        this.currentAudioElement = null;
        securityLogger.log('INFO', 'VOICE', 'Audio playback completed normally.');
        options?.onEnd?.();
        resolve({ success: true });
      };

      audio.onerror = (e) => {
        hasEnded = true;
        cleanupMonitoring();
        securityLogger.log('WARN', 'VOICE', 'Audio element playback error', { error: String(e) });
        this.currentAudioElement = null;
        options?.onError?.(e);
        options?.onEnd?.();
        resolve({ success: false, error: String(e) });
      };

      // Play audio and handle browser autoplay policy restriction
      audio.play().catch((err: unknown) => {
        hasEnded = true;
        cleanupMonitoring();
        this.currentAudioElement = null;

        const errStr = String(err);
        const errorName = (err as Error)?.name || '';
        const isAutoplayBlocked =
          errorName === 'NotAllowedError' ||
          errStr.includes('NotAllowedError') ||
          errStr.includes('play() failed') ||
          errStr.includes('user didn\'t interact');

        if (isAutoplayBlocked) {
          securityLogger.log(
            'WARN',
            'VOICE',
            'Audio autoplay prevented by browser policy. Displaying user activation trigger.'
          );
          options?.onAutoplayBlocked?.();
          resolve({ success: false, autoplayBlocked: true });
        } else {
          securityLogger.log('WARN', 'VOICE', 'Audio playback exception', { error: errStr });
          options?.onError?.(err);
          options?.onEnd?.();
          resolve({ success: false, error: errStr });
        }
      });
    });
  }

  /**
   * Executes the exact welcome dialogue with natural pause, utilizing the authorized Hope audio asset
   * Synchronizes subtitles and 3D globe violet speaking state
   */
  public async playWelcomeDialogue(
    approvedConfig: WelcomeVoiceConfig | null,
    onSubtitleChange: (text: string) => void,
    options?: SpeakOptions
  ): Promise<{ success: boolean; autoplayBlocked?: boolean; error?: string }> {
    if (this.isSilent) {
      options?.onStart?.();
      onSubtitleChange('Welcome, Victor Sir.');
      await new Promise((r) => setTimeout(r, 1600));
      onSubtitleChange('Shall we proceed to authentication?');
      await new Promise((r) => setTimeout(r, 1800));
      options?.onEnd?.();
      return { success: true };
    }

    // Determine target audio asset source:
    // 1. approvedConfig.audioBlobUrl if set
    // 2. Defaulting directly to /audio/hope_welcome.wav
    const audioTarget = approvedConfig?.audioBlobUrl || '/audio/hope_welcome.wav';

    // Subtitle timer handles
    let subTimer: NodeJS.Timeout | null = null;

    const wrappedOptions: SpeakOptions = {
      ...options,
      onStart: () => {
        onSubtitleChange('Welcome, Victor Sir.');
        subTimer = setTimeout(() => {
          onSubtitleChange('Shall we proceed to authentication?');
        }, 2100);
        options?.onStart?.();
      },
      onEnd: () => {
        if (subTimer) clearTimeout(subTimer);
        options?.onEnd?.();
      },
      onError: (e) => {
        if (subTimer) clearTimeout(subTimer);
        options?.onError?.(e);
      },
      onAutoplayBlocked: () => {
        if (subTimer) clearTimeout(subTimer);
        options?.onAutoplayBlocked?.();
      },
    };

    const result = await this.playAudio(audioTarget, wrappedOptions);
    return result;
  }

  public async speak(text: string, options?: SpeakOptions): Promise<void> {
    if (this.isSilent) {
      options?.onStart?.();
      options?.onEnd?.();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      securityLogger.log('WARN', 'VOICE', 'Speech synthesis is unsupported in this environment.');
      options?.onStart?.();
      options?.onEnd?.();
      return;
    }

    this.stop();

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      const voices = window.speechSynthesis.getVoices();
      const ziraVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes('zira') ||
          v.name.includes('Microsoft Zira')
      );

      if (ziraVoice) {
        utterance.voice = ziraVoice;
      } else {
        const enVoice = voices.find((v) => v.lang.startsWith('en'));
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }

      utterance.rate = options?.rate ?? 1.0;
      utterance.pitch = options?.pitch ?? 1.0;

      utterance.onstart = () => {
        securityLogger.log('INFO', 'VOICE', `Speech output triggered: "${text.substring(0, 40)}..."`);
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          securityLogger.log('WARN', 'VOICE', `Speech synthesis error: ${event.error}`);
        }
        this.currentUtterance = null;
        options?.onError?.(event);
        options?.onEnd?.();
        resolve();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        securityLogger.log('WARN', 'VOICE', 'Exception during SpeechSynthesis.speak', { error: String(err) });
        options?.onEnd?.();
        resolve();
      }
    });
  }

  public onStatusChange(fn: (status: VoiceEngineStatus) => void): () => void {
    this.statusListeners.push(fn);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== fn);
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => fn(status));
  }
}

export const speechSynthesisService = new SpeechSynthesisService();
