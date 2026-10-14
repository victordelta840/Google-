import React, { useState, useEffect, useRef } from 'react';
import { cryptoContainerService } from '../services/cryptoContainerService';
import { speechSynthesisService } from '../services/speechSynthesisService';
import { platformCapabilityService } from '../services/platformCapabilityService';
import {
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  X,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Info,
} from 'lucide-react';

interface PasswordAuthModalProps {
  isOpen: boolean;
  isCustomPasswordConfigured?: boolean;
  fallbackTriggered?: boolean;
  fallbackReason?: string | null;
  onOpenSetupWizard?: () => void;
  onClose: () => void;
  onSuccess: () => void;
  onFailure: (reason: string) => void;
}

export const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({
  isOpen,
  isCustomPasswordConfigured = false,
  fallbackTriggered = false,
  fallbackReason,
  onOpenSetupWizard,
  onClose,
  onSuccess,
  onFailure,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const capabilities = platformCapabilityService.detectCapabilities();

  // Auto-focus the input element whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage(null);
      // Immediate and delayed focus attempt to ensure virtual keyboard triggers where OS allows
      const timer = setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Monitor lockout countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const updateLockout = () => {
      const remainingMs = cryptoContainerService.getLockoutRemainingMs();
      setLockoutRemaining(Math.ceil(remainingMs / 1000));
    };

    updateLockout();
    interval = setInterval(updateLockout, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Master password is required. There is no default password.');
      return;
    }

    if (lockoutRemaining > 0) {
      setErrorMessage(`Rate limit active. Please wait ${lockoutRemaining} seconds.`);
      return;
    }

    setIsDerivingKey(true);

    try {
      // Execute real cryptographic derivation and AES-GCM container decryption
      const result = await cryptoContainerService.unlock(password);

      if (result.success) {
        // Voice confirmation
        speechSynthesisService.speak('Authentication successful. Welcome back, Victor Sir.', {
          rate: 1.0,
        });

        // Clear local state safely
        setPassword('');
        setIsDerivingKey(false);
        onSuccess();
      } else {
        setIsDerivingKey(false);
        const reason = result.error || 'Authentication failed.';
        setErrorMessage(reason);
        if (result.delayMs && result.delayMs > 0) {
          setLockoutRemaining(Math.ceil(result.delayMs / 1000));
        }
        onFailure(reason);
      }
    } catch (err) {
      setIsDerivingKey(false);
      setErrorMessage('Cryptographic operation failed. Check container integrity.');
      onFailure(String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-md w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_50px_rgba(0,240,255,0.25)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 6-Second Timeout Fallback Badge */}
        {fallbackTriggered && (
          <div className="mb-4 p-2.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs font-code flex items-center gap-2 animate-fadeIn">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <strong className="text-amber-300">6-Second Voice Timeout Fallback:</strong>
              <div className="text-[11px] text-amber-200/90">
                {fallbackReason || 'No voice command received within 6s. Master password required.'}
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="font-hud text-xs tracking-widest text-cyan-400 font-bold">
              CRYPTOGRAPHIC GATEWAY
            </div>
            <h3 className="font-hud text-xl font-bold text-white">
              Password Authentication
            </h3>
          </div>
        </div>

        {/* Custom Password Notice */}
        {!isCustomPasswordConfigured && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-code space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>NO DEFAULT PASSWORD ENFORCED</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Victor Sir has not configured a custom password yet. To authenticate, create and confirm your custom master password in the setup dashboard.
            </p>
            {onOpenSetupWizard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSetupWizard();
                }}
                className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                Launch Password Setup Wizard →
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Provide Victor Sir&apos;s Custom Master Key to derive the AES-256-GCM symmetric decryption key using PBKDF2 (100,000 SHA-256 iterations).
        </p>

        {/* Password Form with Mobile Keyboard Focus Optimization */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-code text-slate-300 mb-1.5 flex items-center justify-between">
              <span>MASTER PASSWORD</span>
              <span className="text-[10px] text-amber-400/90 font-medium">Custom User Key (No Default)</span>
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isDerivingKey || lockoutRemaining > 0}
                placeholder="Enter your custom master password..."
                className="w-full bg-slate-900/90 border border-cyan-500/40 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-code tracking-wider"
                autoFocus
                autoComplete="current-password"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="go"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-300 p-0.5"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Mobile Keyboard Guidance Instruction (Requirement 2.6) */}
            {capabilities.isMobile && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-code text-cyan-400/80">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Tap input field to open keyboard on mobile if not automatically raised.</span>
              </div>
            )}
          </div>

          {/* Rate-Limit / Lockout warning banner */}
          {lockoutRemaining > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-code flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
              <span>
                Anti-Brute-Force Rate Limiting Active. Retry available in {lockoutRemaining}s.
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && lockoutRemaining <= 0 && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-code flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cryptographic Standards Display */}
          <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 text-[11px] font-code text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Key Derivation:
              </span>
              <span>PBKDF2-SHA256 (100k rounds)</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" /> Cipher:
              </span>
              <span>AES-256-GCM Zero-Plaintext</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDerivingKey}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDerivingKey || lockoutRemaining > 0}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-hud text-sm font-bold tracking-wider transition-all duration-200 flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.3)] disabled:shadow-none"
            >
              {isDerivingKey ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deriving Key...</span>
                </>
              ) : (
                <span>Unlock Container</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
