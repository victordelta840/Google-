/**
 * ASTRA SecureDrive - Core Types & State Definitions
 * Compliant with Phase Update: Female Welcome Voice, Personal Voice Setup, Custom Password
 */

export type SecurityState =
  | 'INITIALIZING'
  | 'DEVICE_DETECTED'
  | 'LOCKED'
  | 'WELCOME'
  | 'AUTHENTICATION_PENDING'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHENTICATION_VERIFIED'
  | 'UNLOCKING'
  | 'UNLOCKED'
  | 'LOCKING'
  | 'ERROR';

export type WelcomePhase =
  | 'PHASE_1_DEVICE_DETECTED'
  | 'PHASE_2_SECURITY_INIT'
  | 'PHASE_3_ASTRA_CORE'
  | 'PHASE_4_WELCOME_MESSAGE'
  | 'PHASE_5_AUTH_SELECTION';

export type AuthMode = 'PASSWORD' | 'VOICE';

export interface UsbDeviceInfo {
  vendorId: string;
  productId: string;
  manufacturer: string;
  productName: string;
  serialNumber: string;
  totalCapacityBytes: number;
  freeSpaceBytes: number;
  fileSystem: 'FAT32' | 'exFAT' | 'NTFS' | 'ext4';
  mountPath: string;
  isConnected: boolean;
  isSimulated: boolean;
  driveLabel: string;
}

export interface EncryptedContainerHeader {
  magic: string; // 'ASTRA_SEC_V1'
  version: number;
  salt: string; // hex
  iv: string; // hex
  iterations: number;
  authTag: string; // hex HMAC integrity verification
  createdAt: string;
  lastModifiedAt: string;
  payloadLength: number;
}

export interface EncryptedFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  lastModified: string;
  content: string; // Plaintext representation in authenticated memory only
  checksum: string;
}

export interface SecurityLogEvent {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'CRITICAL' | 'AUDIT';
  category: 'AUTH' | 'CRYPTO' | 'USB' | 'STATE' | 'VOICE';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceEngineStatus {
  available: boolean;
  isMicrosoftZira: boolean;
  detectedVoiceName: string;
  engineName: string;
  platform: 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  speechSynthesisSupported: boolean;
  speechRecognitionSupported: boolean;
  micPermission: 'prompt' | 'granted' | 'denied';
}

export interface TestCaseResult {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  executionType: 'AUTOMATED' | 'INTERACTIVE_VERIFICATION';
  details: string;
  durationMs?: number;
}

// ==========================================
// Phase Update: Voice & Password Setup Types
// ==========================================

export type WelcomeVoiceStatus = 'NOT_CONFIGURED' | 'PREVIEWED' | 'APPROVED';

export interface WelcomeVoiceConfig {
  voiceEngine: 'GEMINI_HOPE' | 'ELEVENLABS_HOPE' | 'AUTHORIZED_FILE_HOPE' | 'SYSTEM_BRITISH' | 'SYSTEM_ZIRA';
  voiceName: string; // 'Hope'
  providerName: string; // 'ElevenLabs' | 'Google AI Studio Gemini' | 'Authorized Audio File' | 'Local System TTS'
  voiceId?: string; // 'tnSpp4vdxKPjI9w0GnoV' or 'gemini-hope-british-persona'
  isExactVoice: boolean; // true if ElevenLabs Hope or authorized audio asset; false if Gemini AI British Hope Persona
  accent: 'British English' | 'Multilingual';
  status: WelcomeVoiceStatus;
  dialogueText: string;
  audioBlobUrl: string | null;
  audioBase64: string | null;
  customFileName: string | null;
  isApproved: boolean;
  approvedTimestamp?: string | null;
}

export type PersonalVoiceStatus = 'NOT_STARTED' | 'RECORDING' | 'ENROLLED_PROTOTYPE';

export interface VoiceSampleItem {
  id: string;
  phraseIndex: number;
  phraseText: string;
  audioBlobUrl: string | null;
  audioBlob?: Blob;
  durationSec: number;
  isReviewed: boolean;
  recordedAt: string;
}

export interface PersonalVoiceEnrollmentState {
  status: PersonalVoiceStatus;
  micPermission: 'prompt' | 'granted' | 'denied';
  samples: VoiceSampleItem[];
  isEnrolled: boolean;
  enrollmentTimestamp: string | null;
  activeRecordingIndex: number | null;
  acousticFeatureCount?: number;
}

export type CustomPasswordStatus = 'NOT_CONFIGURED' | 'CONFIRMED_PROTOTYPE';

export interface CustomPasswordState {
  status: CustomPasswordStatus;
  isConfirmed: boolean;
  passwordLength: number;
  saltHex: string | null;
  keyHashHex: string | null;
  setupTimestamp: string | null;
}

export interface SetupDashboardState {
  welcomeVoice: WelcomeVoiceConfig;
  personalVoice: PersonalVoiceEnrollmentState;
  customPassword: CustomPasswordState;
}
