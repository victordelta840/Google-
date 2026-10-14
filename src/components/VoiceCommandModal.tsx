import React, { useState, useEffect } from 'react';
import {
  voiceCommandService,
  VoiceCommand,
  CommandMatchResult,
} from '../services/voiceCommandService';
import {
  Mic,
  MicOff,
  X,
  ShieldAlert,
  Volume2,
  Terminal,
  Play,
  Info,
} from 'lucide-react';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword: () => void;
  onLockDrive: () => void;
  onCheckStatus: () => void;
}

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onSelectPassword,
  onLockDrive,
  onCheckStatus,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommandResult, setLastCommandResult] = useState<CommandMatchResult | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const isAvailable = voiceCommandService.isAvailable();

  useEffect(() => {
    if (!isOpen) {
      voiceCommandService.stopListening();
      setIsListening(false);
      return;
    }

    const unsubscribe = voiceCommandService.onCommand((result) => {
      setLastCommandResult(result);
      setCommandHistory((prev) => [
        `[${new Date().toLocaleTimeString()}] "${result.rawTranscript}" → ${result.command}`,
        ...prev.slice(0, 9),
      ]);

      // Handle the command workflow
      if (result.command === 'USE_PASSWORD_AUTHENTICATION') {
        onSelectPassword();
      } else if (result.command === 'LOCK_SECUREDRIVE') {
        onLockDrive();
      } else if (result.command === 'CHECK_SECURITY_STATUS') {
        onCheckStatus();
      } else if (result.command === 'CANCEL_AUTHENTICATION') {
        onClose();
      }
    });

    return () => {
      unsubscribe();
      voiceCommandService.stopListening();
    };
  }, [isOpen, onClose, onSelectPassword, onLockDrive, onCheckStatus]);

  if (!isOpen) return null;

  const toggleListening = async () => {
    if (isListening) {
      voiceCommandService.stopListening();
      setIsListening(false);
    } else {
      const started = await voiceCommandService.startListening();
      setIsListening(started);
    }
  };

  const handleManualCommandClick = (cmd: VoiceCommand) => {
    const result = voiceCommandService.triggerManualCommand(cmd);
    setLastCommandResult(result);
    setCommandHistory((prev) => [
      `[MANUAL] "${result.rawTranscript}" → ${result.command}`,
      ...prev.slice(0, 9),
    ]);

    if (cmd === 'USE_PASSWORD_AUTHENTICATION') {
      setTimeout(onSelectPassword, 600);
    } else if (cmd === 'LOCK_SECUREDRIVE') {
      onLockDrive();
    } else if (cmd === 'CHECK_SECURITY_STATUS') {
      onCheckStatus();
    } else if (cmd === 'CANCEL_AUTHENTICATION') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-xl w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_50px_rgba(0,240,255,0.2)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="font-hud text-xs tracking-widest text-cyan-400">
              VOICE COMMAND SUBSYSTEM
            </div>
            <h3 className="font-hud text-xl font-bold text-white">
              Voice Interface & Command Mode
            </h3>
          </div>
        </div>

        {/* Speaker Verification Limitation Notice */}
        <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-code space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>CRITICAL SECURITY BOUNDARY: SPEAKER IDENTITY VERIFICATION</span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Speech Recognition converts spoken audio to text. It DOES NOT prove Victor Sir&apos;s biological identity. ASTRA strictly prevents simple voice phrase matching from bypassing encryption. To unlock the physical container, Master Password authorization is enforced.
          </p>
        </div>

        {/* Live Mic Activation Controller */}
        <div className="flex flex-col items-center justify-center py-4 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-5">
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_30px_#00f0ff] animate-pulse'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-500/50'
            }`}
            title={isListening ? 'Click to stop listening' : 'Click to start microphone listening'}
          >
            {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
          </button>

          <div className="mt-3 font-code text-xs text-center">
            {isListening ? (
              <span className="text-cyan-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Listening for commands... Speak now
              </span>
            ) : (
              <span className="text-slate-400">
                Microphone idle. Click button to activate or use manual command fallback below.
              </span>
            )}
          </div>
          {!isAvailable && (
            <div className="mt-2 text-[11px] font-code text-rose-400">
              WebSpeech recognition API not supported in this browser. Use manual buttons below.
            </div>
          )}
        </div>

        {/* Supported Commands (Manual Clickable Fallback) */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-code text-slate-400 mb-2">
            <span>SUPPORTED COMMANDS (CLICK TO SIMULATE / MANUAL OVERRIDE):</span>
            <span className="text-[10px] text-cyan-400">Section 5 Compliant</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-code">
            {[
              { cmd: 'ACTIVATE_COMMAND_MODE' as VoiceCommand, label: '"Activate Command Mode"' },
              { cmd: 'USE_PASSWORD_AUTHENTICATION' as VoiceCommand, label: '"Use Password Authentication"' },
              { cmd: 'USE_VOICE_AUTHENTICATION' as VoiceCommand, label: '"Use Voice Authentication"' },
              { cmd: 'LOCK_SECUREDRIVE' as VoiceCommand, label: '"Lock SecureDrive"' },
              { cmd: 'CANCEL_AUTHENTICATION' as VoiceCommand, label: '"Cancel Authentication"' },
              { cmd: 'CHECK_SECURITY_STATUS' as VoiceCommand, label: '"Check Security Status"' },
            ].map((item) => (
              <button
                key={item.cmd}
                onClick={() => handleManualCommandClick(item.cmd)}
                className="flex items-center justify-between p-2 rounded bg-slate-900/90 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-700/60 text-slate-300 hover:text-cyan-200 transition-colors text-left"
              >
                <span>{item.label}</span>
                <Play className="w-3 h-3 text-cyan-500 opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* Last Command Result & Live Security Notice */}
        {lastCommandResult && (
          <div className="mb-4 p-3 rounded-lg bg-slate-900/90 border border-cyan-900/50 font-code text-xs space-y-1">
            <div className="text-slate-400">
              Recognized: <span className="text-white font-semibold">&quot;{lastCommandResult.rawTranscript}&quot;</span>
            </div>
            <div className="text-cyan-400">
              Parsed Command: <span className="font-bold">{lastCommandResult.command}</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <Info className="w-3 h-3 text-blue-400" />
              <span>{lastCommandResult.securityNotice}</span>
            </div>
          </div>
        )}

        {/* Transcript Feed */}
        {commandHistory.length > 0 && (
          <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 font-code text-[11px] text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1">
              <Terminal className="w-3 h-3" /> Voice Event Transcript Feed:
            </div>
            {commandHistory.map((item, idx) => (
              <div key={idx} className="truncate text-slate-300">{item}</div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSelectPassword}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-hud text-xs font-bold tracking-wider transition-colors shadow-[0_0_12px_rgba(0,240,255,0.25)]"
          >
            Proceed to Password Verification →
          </button>
        </div>
      </div>
    </div>
  );
};
