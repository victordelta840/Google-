import React, { useState, useEffect } from 'react';
import { SecurityLogEvent } from '../types';
import { securityLogger } from '../services/securityLogger';
import { Terminal, X, Trash2, Download } from 'lucide-react';

interface SecurityLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityLogDrawer: React.FC<SecurityLogDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<SecurityLogEvent[]>(() => securityLogger.getLogs());

  useEffect(() => {
    if (!isOpen) return;
    setLogs(securityLogger.getLogs());
    const unsub = securityLogger.subscribe((event) => {
      setLogs((prev) => [event, ...prev.slice(0, 499)]);
    });
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    securityLogger.clear();
    setLogs(securityLogger.getLogs());
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ASTRA-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-accent max-w-3xl w-full rounded-2xl p-6 border border-cyan-500/40 relative shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="font-hud text-xs tracking-widest text-cyan-400">
                AUDIT TRAIL & TAMPER LOG
              </div>
              <h3 className="font-hud text-xl font-bold text-white">
                Live Security Event Telemetry
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              title="Clear log buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              title="Export audit log to JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zero-Leakage Policy Banner */}
        <div className="py-2.5 px-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-code text-slate-400 my-3">
          ASTRA ZERO-LEAKAGE ENFORCEMENT: Passwords, encryption keys, and plaintext data are strictly filtered before reaching this audit stream.
        </div>

        {/* Logs Stream */}
        <div className="flex-1 overflow-y-auto space-y-1.5 font-code text-xs pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No events logged yet.</div>
          ) : (
            logs.map((log) => {
              const levelColor =
                log.level === 'CRITICAL'
                  ? 'text-rose-400 bg-rose-950/40 border-rose-800/60'
                  : log.level === 'WARN'
                  ? 'text-amber-400 bg-amber-950/40 border-amber-800/60'
                  : log.level === 'AUDIT'
                  ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60'
                  : 'text-cyan-300 bg-slate-900/60 border-slate-800';

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border ${levelColor} transition-all`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-bold tracking-wider">{log.level} · {log.category}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-200">{log.message}</div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="text-[10px] text-slate-400 mt-1 overflow-x-auto bg-black/40 p-1.5 rounded">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-code border border-slate-700"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};
