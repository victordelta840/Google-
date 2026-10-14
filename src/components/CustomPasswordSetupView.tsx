import React, { useState } from 'react';
import { CustomPasswordState } from '../types';
import { securityLogger } from '../services/securityLogger';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface CustomPasswordSetupViewProps {
  state: CustomPasswordState;
  onUpdateState: (updated: CustomPasswordState) => void;
  onClearPassword: () => void;
}

export const CustomPasswordSetupView: React.FC<CustomPasswordSetupViewProps> = ({
  state,
  onUpdateState,
  onClearPassword,
}) => {
  // STRICT COMPLIANCE: NO DEFAULT PASSWORD. Both fields start completely empty.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Validation rules
  const isLengthValid = password.length >= 8;
  const isMatch = password.length > 0 && password === confirmPassword;
  const isEmpty = password.trim().length === 0;

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    // 1. Validate empty
    if (isEmpty) {
      setErrorMessage('Password cannot be empty. Please create a custom master password.');
      return;
    }

    // 2. Validate length
    if (!isLengthValid) {
      setErrorMessage('Password must be at least 8 characters long for adequate entropy.');
      return;
    }

    // 3. Validate matching confirmation
    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match. Please re-enter both entries carefully.');
      return;
    }

    setIsProcessing(true);

    try {
      // Derive PBKDF2 hash with unique 16-byte cryptographically secure salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );

      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const keyHashHex = Array.from(new Uint8Array(derivedBits))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const updated: CustomPasswordState = {
        status: 'CONFIRMED_PROTOTYPE',
        isConfirmed: true,
        passwordLength: password.length,
        saltHex,
        keyHashHex,
        setupTimestamp: new Date().toISOString(),
      };

      onUpdateState(updated);

      // Instantly wipe plaintext password from input state for security
      setPassword('');
      setConfirmPassword('');
      setIsProcessing(false);
      setSuccessNotice('Custom password confirmed and cryptographic salt generated successfully.');

      securityLogger.log(
        'AUDIT',
        'AUTH',
        `Custom password confirmed. PBKDF2 hash calculated (Salt: ${saltHex.substring(0, 8)}...). Zero plaintext stored.`
      );
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Cryptographic validation error: ${msg}`);
      securityLogger.log('CRITICAL', 'AUTH', `Key derivation failure: ${msg}`);
    }
  };

  const handleResetPasswordSetup = () => {
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessNotice(null);
    onClearPassword();
    securityLogger.log('INFO', 'AUTH', 'Custom password configuration reset by user.');
  };

  return (
    <div className="space-y-6 text-xs font-code">
      {/* Header Banner */}
      <div className="p-4 rounded-xl glass-panel-accent border border-cyan-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-cyan-400 font-hud text-sm font-bold tracking-wider">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <span>3. CUSTOM MASTER PASSWORD SETUP WIZARD</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
              state.isConfirmed
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {state.isConfirmed ? 'Confirmed (Prototype only)' : 'Not configured'}
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          There is <strong>no default password</strong>. Create your own master password and enter it again for confirmation. Both entries are validated using PBKDF2-SHA256 (100k iterations) without logging or storing plaintext.
        </p>
      </div>

      {/* Honest Storage Status Banner */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300 font-hud text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>PROTOTYPE STORAGE DISCLOSURE</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-200/90">
          This wizard operates in <strong>Prototype Verification Mode</strong>. The derived verification hash and random salt exist in authenticated memory for this session. The physical USB flash drive is NOT partitioned or modified, and no plaintext passwords are ever persisted to disk.
        </p>
      </div>

      {/* Setup Form or Confirmation Card */}
      {state.isConfirmed ? (
        <div className="p-6 rounded-xl bg-slate-900/80 border border-emerald-500/40 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-hud text-base font-bold text-white">
                Custom Password Setup Confirmed
              </div>
              <p className="text-slate-400 text-[11px]">
                Setup completed at: {state.setupTimestamp ? new Date(state.setupTimestamp).toLocaleString() : 'Active Session'}
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Password Length:</span>
              <span className="font-bold text-cyan-300">{state.passwordLength} characters</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Salt (Random 16 bytes):</span>
              <span className="font-mono text-slate-300 truncate max-w-[220px]">{state.saltHex}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">PBKDF2 Derived Digest:</span>
              <span className="font-mono text-emerald-400 truncate max-w-[220px]">{state.keyHashHex}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Need to change your password? Reset to run the wizard again.
            </span>
            <button
              onClick={handleResetPasswordSetup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change Password / Reset</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSetupPassword} className="space-y-4 max-w-lg">
          {/* Step 1: Create Password */}
          <div>
            <label className="block text-slate-300 text-xs mb-1.5 font-bold flex items-center justify-between">
              <span>1. CREATE YOUR OWN PASSWORD:</span>
              <span className="text-[10px] text-slate-500 font-normal">Min 8 characters</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Type your new master password..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 tracking-wider"
                autoComplete="new-password"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-300 p-0.5"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Step 2: Confirm Password */}
          <div>
            <label className="block text-slate-300 text-xs mb-1.5 font-bold">
              2. CONFIRM YOUR PASSWORD:
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password to confirm..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 tracking-wider"
                autoComplete="new-password"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-300 p-0.5"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                  isLengthValid ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                }`}
              >
                ✓
              </span>
              <span className={isLengthValid ? 'text-slate-200' : 'text-slate-500'}>
                At least 8 characters ({password.length}/8)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                  isMatch ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                }`}
              >
                ✓
              </span>
              <span className={isMatch ? 'text-slate-200' : 'text-slate-500'}>
                Password entries match
              </span>
            </div>
          </div>

          {/* Error & Success Feedback */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!isLengthValid || !isMatch || isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-hud font-bold text-xs shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:shadow-none transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>{isProcessing ? 'Validating & Deriving Salt...' : 'Confirm Custom Password'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Security Best Practices */}
      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
        CONFIDENTIALITY DIRECTIVE: ASTRA never asks for Victor Sir&apos;s actual password in prompts, chat windows, or source files. Passwords are handled exclusively by client-side WebCrypto routines.
      </div>
    </div>
  );
};
