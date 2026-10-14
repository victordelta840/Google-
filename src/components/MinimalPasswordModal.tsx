import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cryptoContainerService } from '../services/cryptoContainerService';
import { CustomPasswordState } from '../types';
import { securityLogger } from '../services/securityLogger';

interface MinimalPasswordModalProps {
  isOpen: boolean;
  isCustomPasswordConfigured: boolean;
  fallbackTriggered?: boolean;
  fallbackReason?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onFailure: (reason: string) => void;
  customPassword: CustomPasswordState;
  onUpdateCustomPassword: (updated: CustomPasswordState) => void;
}

export const MinimalPasswordModal: React.FC<MinimalPasswordModalProps> = ({
  isOpen,
  isCustomPasswordConfigured,
  fallbackTriggered = false,
  fallbackReason,
  onClose,
  onSuccess,
  onFailure,
  customPassword,
  onUpdateCustomPassword,
}) => {
  const [mode, setMode] = useState<'AUTH' | 'SETUP'>(
    isCustomPasswordConfigured ? 'AUTH' : 'SETUP'
  );

  // Authentication Fields
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Setup Fields (strictly no default password, zero plaintext storage)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage(null);
      setMode(isCustomPasswordConfigured ? 'AUTH' : 'SETUP');

      const timer = setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 120);

      return () => clearTimeout(timer);
    }
  }, [isOpen, isCustomPasswordConfigured]);

  // Lockout countdown
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

  // Handle Authentication Attempt
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Password required');
      return;
    }

    if (lockoutRemaining > 0) {
      setErrorMessage(`Rate limit active (${lockoutRemaining}s)`);
      return;
    }

    setIsVerifying(true);

    try {
      const result = await cryptoContainerService.unlock(password);
      setIsVerifying(false);

      if (result.success) {
        setPassword('');
        onSuccess();
      } else {
        setErrorMessage(result.error || 'Invalid password.');
        onFailure('Invalid password attempt');
      }
    } catch {
      setIsVerifying(false);
      setErrorMessage('Verification failed');
      onFailure('Error during verification');
    }
  };

  // Handle Password Setup
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (!newPassword || newPassword.length < 8) {
      setSetupError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSetupError('Passwords do not match');
      return;
    }

    try {
      // Initialize encrypted container storage with custom password
      await cryptoContainerService.initializeWithCustomPassword(newPassword);

      // Derive PBKDF2 hash
      const enc = new TextEncoder();
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(newPassword),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );

      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const hashHex = Array.from(new Uint8Array(derivedBits))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      onUpdateCustomPassword({
        status: 'CONFIRMED_PROTOTYPE',
        isConfirmed: true,
        passwordLength: newPassword.length,
        saltHex,
        keyHashHex: hashHex,
        setupTimestamp: new Date().toISOString(),
      });

      securityLogger.log('AUDIT', 'AUTH', 'Custom password configured and encrypted.');
      setPassword(newPassword);
      setMode('AUTH');
    } catch {
      setSetupError('Cryptographic initialization failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-950/95 border border-blue-500/40 p-5 shadow-[0_0_35px_rgba(59,130,246,0.25)] flex flex-col">
        {/* Header with Mode Toggle and Close */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300">
              <span className="font-hud font-bold text-sm">S</span>
            </div>
            <span className="font-hud text-xs font-bold text-slate-200 tracking-wider">
              {mode === 'AUTH' ? 'AUTHENTICATION' : 'PASSWORD SETUP'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fallback Banner if arriving from 6s timeout */}
        {fallbackTriggered && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] font-code text-amber-300 flex items-center justify-between">
            <span>Voice timeout expired (6.0s)</span>
            <span className="text-[10px] text-amber-400">Password active</span>
          </div>
        )}

        {/* MODE 1: Authentication */}
        {mode === 'AUTH' && (
          <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={isVerifying || lockoutRemaining > 0}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-400 text-white font-code text-sm placeholder:text-slate-500 outline-none transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMessage && (
              <div className="text-xs font-code text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || lockoutRemaining > 0 || !password}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-hud text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>VERIFYING...</span>
                </>
              ) : lockoutRemaining > 0 ? (
                <span>LOCKED ({lockoutRemaining}s)</span>
              ) : (
                <span>UNLOCK</span>
              )}
            </button>

            <div className="pt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setMode('SETUP')}
                className="text-[11px] font-code text-slate-400 hover:text-blue-300 transition-colors"
              >
                Change password
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: Setup / Change Password */}
        {mode === 'SETUP' && (
          <form onSubmit={handleSetupSubmit} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-400 text-white font-code text-xs placeholder:text-slate-500 outline-none transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-400 text-white font-code text-xs placeholder:text-slate-500 outline-none transition-all"
              />
            </div>

            {setupError && (
              <div className="text-xs font-code text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-hud text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              SAVE PASSWORD
            </button>

            {isCustomPasswordConfigured && (
              <div className="pt-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setMode('AUTH')}
                  className="text-[11px] font-code text-slate-400 hover:text-blue-300 transition-colors"
                >
                  Return to unlock
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
