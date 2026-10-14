/**
 * ASTRA SecureDrive - Voice Command Interface & Speaker Verification Adapter
 * 
 * Strict Security Principles:
 * - Recognizes spoken commands locally using Web Speech Recognition.
 * - "Activate Command Mode" activates the interface, never grants access.
 * - Speech recognition is NOT speaker identity verification.
 * - Explicitly prevents speech matching from unlocking the cryptographic container.
 * - Provides immediate manual keyboard / click alternatives for noisy or permission-denied environments.
 */

import { securityLogger } from './securityLogger';

export type VoiceCommand =
  | 'ACTIVATE_COMMAND_MODE'
  | 'USE_PASSWORD_AUTHENTICATION'
  | 'USE_VOICE_AUTHENTICATION'
  | 'LOCK_SECUREDRIVE'
  | 'CANCEL_AUTHENTICATION'
  | 'CHECK_SECURITY_STATUS'
  | 'UNKNOWN';

export interface CommandMatchResult {
  command: VoiceCommand;
  rawTranscript: string;
  confidence: number;
  isRecognized: boolean;
  speakerVerificationSupported: boolean;
  speakerVerificationPassed: boolean;
  securityNotice: string;
}

export type CommandCallback = (result: CommandMatchResult) => void;

class VoiceCommandService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening: boolean = false;
  private listeners: CommandCallback[] = [];

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript.trim();
          const confidence = event.results[current][0].confidence || 0.85;

          const match = this.parseCommand(transcript, confidence);
          securityLogger.log(
            'INFO',
            'VOICE',
            `Voice Command processed: "${transcript}" -> ${match.command} (Confidence: ${(confidence * 100).toFixed(0)}%)`
          );

          this.listeners.forEach((fn) => fn(match));
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.recognition.onerror = (event: any) => {
          securityLogger.log('WARN', 'VOICE', `Speech recognition error event: ${event.error}`);
          if (event.error === 'not-allowed') {
            this.isListening = false;
          }
        };

        this.recognition.onend = () => {
          if (this.isListening) {
            // Keep active if supposed to be listening
            try {
              this.recognition.start();
            } catch {
              this.isListening = false;
            }
          }
        };
      } catch (err) {
        securityLogger.log('WARN', 'VOICE', 'Failed to initialize WebSpeech SpeechRecognition', { error: String(err) });
      }
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.recognition);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public async startListening(): Promise<boolean> {
    if (!this.recognition) {
      securityLogger.log('WARN', 'VOICE', 'Speech recognition engine not supported in this browser.');
      return false;
    }

    try {
      this.isListening = true;
      this.recognition.start();
      securityLogger.log('INFO', 'VOICE', 'Voice command recognition started (local processing).');
      return true;
    } catch {
      // Might already be running
      this.isListening = true;
      return true;
    }
  }

  public stopListening(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
        securityLogger.log('INFO', 'VOICE', 'Voice command recognition stopped.');
      } catch {
        // Ignored
      }
    }
  }

  public onCommand(callback: CommandCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  public parseCommand(rawText: string, confidence = 1.0): CommandMatchResult {
    const text = rawText.toLowerCase().trim();

    let cmd: VoiceCommand = 'UNKNOWN';

    if (text.includes('activate command mode') || text.includes('command mode')) {
      cmd = 'ACTIVATE_COMMAND_MODE';
    } else if (text.includes('use password authentication') || text.includes('password authentication') || text.includes('use password')) {
      cmd = 'USE_PASSWORD_AUTHENTICATION';
    } else if (text.includes('use voice authentication') || text.includes('voice authentication') || text.includes('use voice')) {
      cmd = 'USE_VOICE_AUTHENTICATION';
    } else if (text.includes('lock securedrive') || text.includes('lock drive') || text.includes('lock container')) {
      cmd = 'LOCK_SECUREDRIVE';
    } else if (text.includes('cancel authentication') || text.includes('cancel') || text.includes('abort')) {
      cmd = 'CANCEL_AUTHENTICATION';
    } else if (text.includes('check security status') || text.includes('security status') || text.includes('system status')) {
      cmd = 'CHECK_SECURITY_STATUS';
    }

    // SPEAKER VERIFICATION DISTINCTION:
    // Speech Recognition recognizes *words*.
    // Speaker Identity Verification requires acoustic biometric feature extraction (MFCC/GMM/ECAPA-TDNN).
    // ASTRA explicitly notes this limitation and will NEVER unlock encrypted data based solely on recognized words.
    const isVoiceAuthCommand = cmd === 'USE_VOICE_AUTHENTICATION';

    return {
      command: cmd,
      rawTranscript: rawText,
      confidence,
      isRecognized: cmd !== 'UNKNOWN',
      speakerVerificationSupported: false, // Honest reporting: no raw acoustic biometric model loaded in browser
      speakerVerificationPassed: false,
      securityNotice: isVoiceAuthCommand
        ? 'SECURITY ENFORCEMENT: Spoken words verify command intent, NOT biological identity. Biometric speaker verification is unavailable. Primary cryptographic access requires Master Password.'
        : 'Local voice command processed.',
    };
  }

  /**
   * Manual fallback simulator to test voice commands without mic
   */
  public triggerManualCommand(command: VoiceCommand): CommandMatchResult {
    const mapping: Record<VoiceCommand, string> = {
      ACTIVATE_COMMAND_MODE: 'Activate Command Mode',
      USE_PASSWORD_AUTHENTICATION: 'Use Password Authentication',
      USE_VOICE_AUTHENTICATION: 'Use Voice Authentication',
      LOCK_SECUREDRIVE: 'Lock SecureDrive',
      CANCEL_AUTHENTICATION: 'Cancel Authentication',
      CHECK_SECURITY_STATUS: 'Check Security Status',
      UNKNOWN: 'Unknown command',
    };

    const transcript = mapping[command];
    const match = this.parseCommand(transcript, 1.0);
    this.listeners.forEach((fn) => fn(match));
    return match;
  }
}

export const voiceCommandService = new VoiceCommandService();
