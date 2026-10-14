import React, { useState } from 'react';
import {
  Layers,
  X,
  Shield,
  HardDrive,
  Cpu,
  AlertTriangle,
  FolderTree,
  Terminal,
} from 'lucide-react';

interface ArchitectureViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureViewer: React.FC<ArchitectureViewerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'STACK' | 'CONTAINER_VS_HW' | 'LIMITATIONS' | 'TREE'>('STACK');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-4xl w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-hud text-xs tracking-widest text-cyan-400">
                SYSTEM ARCHITECTURE & SECURITY SPECIFICATION
              </div>
              <h3 className="font-hud text-xl font-bold text-white">
                ASTRA SecureDrive Cross-Platform Blueprint
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 py-3 border-b border-slate-800 overflow-x-auto text-xs font-code">
          {[
            { id: 'STACK', label: '1. Recommended Stack & 12 Layers' },
            { id: 'CONTAINER_VS_HW', label: '2. Container vs HW Controller' },
            { id: 'LIMITATIONS', label: '3. Cross-Platform & Startup Limits' },
            { id: 'TREE', label: '4. USB Project Folder Layout' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 text-xs font-code space-y-4 pr-2">
          {activeTab === 'STACK' && (
            <div className="space-y-4 text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <h4 className="font-hud text-base font-bold text-cyan-300 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" /> RECOMMENDED PRODUCTION TECHNOLOGY STACK
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  For deploying ASTRA SecureDrive directly on a 16 GB HP USB flash drive across Windows, Linux, and macOS, the optimal production architecture pairs a <strong>Rust Core (or Electron/Tauri with Node.js native addons)</strong> with a <strong>React/TypeScript HUD interface</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li><strong>Core Native Runtime:</strong> Rust / Tauri (or Electron) with static linking to avoid requiring host runtime installations.</li>
                  <li><strong>Cryptographic Primitive:</strong> AES-256-GCM authenticated cipher with PBKDF2-HMAC-SHA256 (100,000+ rounds) or Argon2id via ring/libsodium.</li>
                  <li><strong>Interface:</strong> React + Tailwind CSS with hardware-accelerated WebGL/Canvas reticle animations.</li>
                  <li><strong>Audio & Speech:</strong> Native SAPI 5 / Microsoft OneCore integration on Windows (specifically targeting Microsoft Zira Desktop), NSSpeechSynthesizer on macOS, and Speech Dispatcher on Linux.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <h4 className="font-hud text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" /> THE 12 ARCHITECTURAL LAYERS
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {[
                    '1. User Interface (Cinematic HUD, Accessibility & Reduced Motion)',
                    '2. Welcome Animation Engine (5 Sequential Phases)',
                    '3. Speech Synthesis Service (Zira & Multi-OS Detection)',
                    '4. Voice Command Service (Local Audio Tokenizer)',
                    '5. Speaker Verification Adapter (Biometric Boundary Guard)',
                    '6. Password Authentication Service (Rate-Limiter & Backoff)',
                    '7. Encryption & Key Management (PBKDF2/AES-256-GCM)',
                    '8. Encrypted Storage Manager (Container Serialization)',
                    '9. USB Detection Service (Cross-Platform VID/PID Monitor)',
                    '10. Session Lock Manager (Disconnection & Window Hooks)',
                    '11. Security Event Logger (Zero-Secret Sanitized Audit)',
                    '12. Platform Compatibility Layer (Win/Mac/Linux Dispatcher)',
                  ].map((layer, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-slate-300">
                      {layer}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CONTAINER_VS_HW' && (
            <div className="space-y-4 text-slate-300">
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                <h4 className="font-hud text-base font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  CONTAINER-BASED PROTECTION VS. HARDWARE-ENFORCED USB PROTECTION
                </h4>
                <p className="leading-relaxed">
                  Honest cybersecurity evaluation for a standard 16 GB HP flash drive (HP v150w / x796w):
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-800/60 space-y-2">
                  <h5 className="font-bold text-cyan-300 text-sm">Container-Based Software Protection (ASTRA)</h5>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    • The entire physical drive is a standard mass-storage device formatted as FAT32/exFAT.<br />
                    • Files placed in the container (<code className="text-cyan-400">storage/secure-container.astra</code>) are encrypted with AES-256-GCM.<br />
                    • Without the password, ciphertext is mathematically unreadable without compromising AES-256.<br />
                    • <strong>Limitation:</strong> The unencrypted FAT32 partition is visible to the OS file explorer; a malicious user could delete or format the drive if they possess physical access.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h5 className="font-bold text-slate-300 text-sm">Hardware-Enforced USB Protection (IronKey / Apricorn)</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    • Requires a dedicated physical cryptographic controller on the USB PCB.<br />
                    • Blocks read/write SCSI commands at the controller bus level until a hardware PIN or keypad is submitted.<br />
                    • Flash memory NAND chips are epoxied/tamper-resistant.<br />
                    • <strong>Conclusion:</strong> Because the user&apos;s drive is a standard 16 GB HP flash drive without a security microchip, ASTRA correctly and honestly implements an encrypted-container software architecture rather than claiming impossible hardware-level physical bus locking.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'LIMITATIONS' && (
            <div className="space-y-4 text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <h4 className="font-hud text-base font-bold text-cyan-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  CROSS-PLATFORM & AUTOMATIC STARTUP LIMITATIONS
                </h4>
                <p className="leading-relaxed">
                  Operating system security policies have evolved to permanently block untrusted automatic code execution from removable flash media:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-white">1. Windows 10 & 11:</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    AutoRun (<code className="text-cyan-300">autorun.inf</code>) was permanently disabled by Microsoft in KB971029 for all USB flash drives to prevent Stuxnet and worm infections. AutoPlay can only open file explorer or offer registered applications. Automatic execution requires installing an ASTRA Background Service or Task Scheduler event listening to Event ID 2003 (DriverFrameworks-UserMode).
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-white">2. Linux (Ubuntu, Debian, Fedora, Arch):</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Modern desktop environments (GNOME/KDE) mount USB devices with the <code className="text-cyan-300">noexec</code> mount flag by default. Automatic startup requires installing a <code className="text-cyan-300">/etc/udev/rules.d/99-astra.rules</code> rule triggering a user systemd service.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-white">3. macOS (Sonoma, Sequoia):</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    macOS Gatekeeper, SIP, and Sandboxing block any external flash drive from executing without explicit user double-click or notarized app bundle authorization. Startup requires a <code className="text-cyan-300">LaunchAgent</code> registered in <code className="text-cyan-300">~/Library/LaunchAgents/</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TREE' && (
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h4 className="font-hud text-base font-bold text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-400" />
                USB FLASH DRIVE STORAGE ARCHITECTURE
              </h4>
              <p className="text-slate-300 text-xs">
                When deployed on the 16 GB HP flash drive, the directory layout is structured as follows:
              </p>
              <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-cyan-300 overflow-x-auto font-mono">
{`ASTRA_SECUREDRIVE/
├── app/
│   ├── astra-linux-x64
│   ├── astra-macos.app
│   ├── astra-win-x64.exe
│   └── web-assets/
├── config/
│   ├── runtime.json           # Non-secret parameters (drive label, log verbosity)
│   └── device-identity.json   # HP Flash drive VID/PID/Serial baseline
├── logs/
│   └── astra-audit.log        # Sanitized security events (Zero plaintext/keys)
├── storage/
│   └── secure-container.astra # The AES-256-GCM encrypted container
├── autorun.inf                # Legacy metadata / icon pointer only
├── astra-launcher.bat         # Windows double-click fallback
├── astra-launcher.sh          # Linux/macOS terminal fallback
└── README.md                  # Verification, password recovery policy & manuals`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
          >
            Close Specification Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
