import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  Volume2,
} from 'lucide-react';
import {
  SecurityState,
  UsbDeviceInfo,
  PersonalVoiceEnrollmentState,
  CustomPasswordState,
} from './types';
import { HolographicGlobe3D, GlobeState } from './components/HolographicGlobe3D';
import { MinimalVoiceModal } from './components/MinimalVoiceModal';
import { MinimalPasswordModal } from './components/MinimalPasswordModal';
import { SecureDriveManager } from './components/SecureDriveManager';
import { usbDetectionService } from './services/usbDetectionService';
import { speechSynthesisService } from './services/speechSynthesisService';
import { cryptoContainerService } from './services/cryptoContainerService';
import { securityLogger } from './services/securityLogger';

export default function App() {
  const [securityState, setSecurityState] = useState<SecurityState>('WELCOME');
  const [device, setDevice] = useState<UsbDeviceInfo>(() => usbDetectionService.getDeviceInfo());

  // Globe 4-Phase Visual State: 'IDLE' | 'SPEAKING' | 'AUTHENTICATING' | 'SUCCESS'
  const [globeState, setGlobeState] = useState<GlobeState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Active minimal panels ('VOICE' | 'PASSWORD' | null)
  const [activePanel, setActivePanel] = useState<'VOICE' | 'PASSWORD' | null>(null);

  // 6-Second voice timeout fallback tracking
  const [isFallbackTriggered, setIsFallbackTriggered] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  // Autoplay blocked state
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Personal voice calibration state
  const [personalVoice, setPersonalVoice] = useState<PersonalVoiceEnrollmentState>({
    status: 'NOT_STARTED',
    micPermission: 'prompt',
    samples: [
      {
        id: 'sample-1',
        phraseIndex: 0,
        phraseText: 'ASTRA, verify operator Victor Sir for SecureDrive access.',
        audioBlobUrl: null,
        durationSec: 0,
        isReviewed: false,
        recordedAt: '',
      },
      {
        id: 'sample-2',
        phraseIndex: 1,
        phraseText: 'Authorization Victor Delta One One Four, commence security gateway.',
        audioBlobUrl: null,
        durationSec: 0,
        isReviewed: false,
        recordedAt: '',
      },
      {
        id: 'sample-3',
        phraseIndex: 2,
        phraseText: 'Secure session lock confirmed, authenticate Victor.',
        audioBlobUrl: null,
        durationSec: 0,
        isReviewed: false,
        recordedAt: '',
      },
    ],
    isEnrolled: false,
    enrollmentTimestamp: null,
    activeRecordingIndex: null,
  });

  // Custom password state (strictly NO default password, zero plaintext)
  const [customPassword, setCustomPassword] = useState<CustomPasswordState>({
    status: 'NOT_CONFIGURED',
    isConfirmed: false,
    passwordLength: 0,
    saltHex: null,
    keyHashHex: null,
    setupTimestamp: null,
  });

  const hasPlayedWelcome = useRef<boolean>(false);

  // 1. Play Hope's Greeting Audio
  const playHopeWelcome = useCallback(() => {
    speechSynthesisService.playAudio('/audio/hope_welcome.wav', {
      onStart: () => {
        setGlobeState('SPEAKING'); // Turns 3D Globe to VIOLET
        setAutoplayBlocked(false);
      },
      onEnd: () => {
        setGlobeState('IDLE'); // Returns 3D Globe to GREEN
        setAudioLevel(0);
      },
      onError: () => {
        setGlobeState('IDLE');
        setAudioLevel(0);
      },
      onAudioLevel: (lvl) => {
        setAudioLevel(lvl);
      },
      onAutoplayBlocked: () => {
        setAutoplayBlocked(true);
        setGlobeState('IDLE');
      },
    });
  }, []);

  // 2. Hardware and Voice Lifecycle
  useEffect(() => {
    const unsubUsb = usbDetectionService.onDeviceChange((newDevice, event) => {
      if (newDevice) {
        setDevice(newDevice);
      } else {
        setDevice((prev) => ({ ...prev, isConnected: false }));
      }

      if (event === 'REMOVAL') {
        handleLockDrive();
      }
    });

    // Automatically trigger Hope's welcome sequence once per session
    if (!hasPlayedWelcome.current) {
      hasPlayedWelcome.current = true;
      const timer = setTimeout(() => {
        playHopeWelcome();
      }, 500);

      return () => {
        clearTimeout(timer);
        unsubUsb();
      };
    }

    return () => {
      unsubUsb();
    };
  }, [playHopeWelcome]);

  // 3. User manually starts audio if autoplay was restricted
  const handleUserTriggerAudio = () => {
    setAutoplayBlocked(false);
    playHopeWelcome();
  };

  // 4. Panel Handlers
  const handleOpenVoice = () => {
    speechSynthesisService.stop();
    setGlobeState('AUTHENTICATING'); // Enters Phase 3: Golden-Yellow Scan Rings!
    setIsFallbackTriggered(false);
    setFallbackReason(null);
    setActivePanel('VOICE');
  };

  const handleOpenPassword = () => {
    speechSynthesisService.stop();
    setGlobeState('AUTHENTICATING'); // Enters Phase 3: Golden-Yellow Scan Rings!
    setActivePanel('PASSWORD');
  };

  const handleClosePanel = () => {
    setActivePanel(null);
    setIsFallbackTriggered(false);
    setFallbackReason(null);
    if (securityState !== 'UNLOCKED') {
      setGlobeState('IDLE'); // Returns to GREEN
    }
  };

  // 5. 6-Second Voice Timeout Fallback -> Switches to Password Panel
  const handleVoiceTimeoutFallback = (reason: string) => {
    setIsFallbackTriggered(true);
    setFallbackReason(reason);
    setActivePanel('PASSWORD');
    setGlobeState('AUTHENTICATING'); // Stays in Golden-Yellow
  };

  // 6. Authentication Success
  const handleAuthSuccess = () => {
    setActivePanel(null);
    setIsFallbackTriggered(false);
    setFallbackReason(null);
    setSecurityState('AUTHENTICATION_VERIFIED');
    setGlobeState('SUCCESS'); // Triggers 3D Globe Phase 4: Electric Cyan Shockwave Burst!
  };

  const handleSuccessAnimationComplete = () => {
    setGlobeState('IDLE'); // Return to GREEN
    setSecurityState('UNLOCKED');
    securityLogger.log('AUDIT', 'AUTH', 'Unlocked secure drive container.');
  };

  const handleAuthFailure = (reason: string) => {
    securityLogger.log('WARN', 'AUTH', `Auth failed: ${reason}`);
  };

  // 7. Lock Drive
  const handleLockDrive = useCallback(() => {
    cryptoContainerService.lock();
    setSecurityState('LOCKED');
    setGlobeState('IDLE');
    setActivePanel(null);
    setIsFallbackTriggered(false);
    setFallbackReason(null);
  }, []);

  const isUnlocked = securityState === 'UNLOCKED';

  return (
    <div className="relative min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center justify-center font-sans select-none overflow-hidden">
      {/* Subtle Background Ambience Rings and Grid */}
      <div className="absolute inset-0 bg-tactical-grid opacity-30 pointer-events-none" />
      <div className="absolute w-[680px] h-[680px] rounded-full border border-cyan-500/5 pointer-events-none" />
      <div className="absolute w-[980px] h-[980px] rounded-full border border-blue-500/5 pointer-events-none" />

      {/* Autoplay Fallback Trigger: Discreet button if browser blocked autoplay */}
      {autoplayBlocked && !isUnlocked && activePanel === null && (
        <button
          onClick={handleUserTriggerAudio}
          className="absolute top-6 right-6 z-30 p-2.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/80 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-pulse"
          title="Play Welcome Greeting"
          aria-label="Play Welcome Greeting"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      )}

      {/* 
        DOMINANT CENTRAL 3D HOLOGRAPHIC GLOBE
        Permanently mounted and continuously animated across all application states.
        Never paused, recreated, or remounted when panels open or switch.
      */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <HolographicGlobe3D
          state={globeState}
          size={380}
          audioLevel={audioLevel}
          onSuccessAnimationComplete={handleSuccessAnimationComplete}
        />

        {/* 
          EXACTLY TWO AUTHENTICATION ICONS ON THE MAIN SCREEN:
          - MIC icon: opens voice activation and personal voice setup
          - S icon: opens password setup and password entry
          - Zero text beneath icons, zero visible headings, zero welcome text
        */}
        {!isUnlocked && activePanel === null && (
          <div className="flex items-center justify-center gap-7 mt-6 z-20">
            {/* 1. MIC Icon */}
            <button
              onClick={handleOpenVoice}
              className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 hover:border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_25px_rgba(0,240,255,0.45)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
              aria-label="Voice Authentication and Setup"
              title="Voice Authentication"
            >
              <Mic className="w-6 h-6 md:w-7 md:h-7" />
            </button>

            {/* 2. S Password Icon */}
            <button
              onClick={handleOpenPassword}
              className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-950/80 border border-blue-500/40 hover:border-blue-400 flex items-center justify-center text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_rgba(59,130,246,0.45)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
              aria-label="Password Authentication and Setup"
              title="Password Authentication"
            >
              <span className="font-hud text-xl md:text-2xl font-bold tracking-wider text-blue-300">
                S
              </span>
            </button>
          </div>
        )}
      </div>

      {/* OVERLAY MODAL 1: Voice Authentication & Setup (Globe continues animating behind it) */}
      <MinimalVoiceModal
        isOpen={activePanel === 'VOICE'}
        onClose={handleClosePanel}
        onTimeoutFallback={handleVoiceTimeoutFallback}
        onSelectPasswordDirectly={() => {
          setIsFallbackTriggered(false);
          setFallbackReason(null);
          setActivePanel('PASSWORD');
          setGlobeState('AUTHENTICATING');
        }}
        personalVoice={personalVoice}
        onUpdatePersonalVoice={setPersonalVoice}
        onVoiceVerified={() => {
          // Voice verified, advance to password confirmation or direct unlock
          setIsFallbackTriggered(false);
          setFallbackReason(null);
          setActivePanel('PASSWORD');
        }}
      />

      {/* OVERLAY MODAL 2: Password Authentication & Setup (Globe continues animating behind it) */}
      <MinimalPasswordModal
        isOpen={activePanel === 'PASSWORD'}
        isCustomPasswordConfigured={customPassword.isConfirmed}
        fallbackTriggered={isFallbackTriggered}
        fallbackReason={fallbackReason}
        onClose={handleClosePanel}
        onSuccess={handleAuthSuccess}
        onFailure={handleAuthFailure}
        customPassword={customPassword}
        onUpdateCustomPassword={setCustomPassword}
      />

      {/* UNLOCKED VIEW: Decrypted Container File Manager */}
      {isUnlocked && (
        <div className="fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-md p-4 md:p-6 overflow-y-auto animate-fadeIn">
          <div className="max-w-5xl mx-auto">
            <SecureDriveManager
              device={device}
              onLockDrive={handleLockDrive}
              masterPasswordHint=""
            />
          </div>
        </div>
      )}
    </div>
  );
}
