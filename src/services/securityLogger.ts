/**
 * ASTRA SecureDrive - Security Event Logger
 * Enforces zero-leakage logging policy:
 * - Never logs passwords, encryption keys, or plaintext data.
 * - Records timestamps, state transitions, authentication attempts, and crypto tamper detections.
 */

import { SecurityLogEvent } from '../types';

class SecurityLogger {
  private logs: SecurityLogEvent[] = [];
  private listeners: ((event: SecurityLogEvent) => void)[] = [];

  public log(
    level: SecurityLogEvent['level'],
    category: SecurityLogEvent['category'],
    message: string,
    metadata?: Record<string, unknown>
  ): SecurityLogEvent {
    // Sanitize any metadata to ensure secrets never get logged
    const sanitizedMetadata = metadata ? this.sanitize(metadata) : undefined;

    const event: SecurityLogEvent = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata: sanitizedMetadata,
    };

    this.logs.unshift(event);
    if (this.logs.length > 500) {
      this.logs.pop();
    }

    // Notify listeners (UI telemetry feed)
    this.listeners.forEach((fn) => fn(event));

    // Console output for development debugging (with security sanitization)
    const prefix = `[ASTRA-${level}][${category}]`;
    if (level === 'CRITICAL' || level === 'WARN') {
      console.warn(`${prefix} ${message}`, sanitizedMetadata ?? '');
    } else {
      console.info(`${prefix} ${message}`, sanitizedMetadata ?? '');
    }

    return event;
  }

  public getLogs(): SecurityLogEvent[] {
    return [...this.logs];
  }

  public subscribe(fn: (event: SecurityLogEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public clear(): void {
    this.logs = [];
    this.log('INFO', 'STATE', 'Security audit log buffer cleared by administrator.');
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const forbiddenKeys = ['password', 'key', 'token', 'secret', 'content', 'private', 'plaintext'];
    const sanitized: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      if (forbiddenKeys.some((f) => k.toLowerCase().includes(f))) {
        sanitized[k] = '[REDACTED_BY_ASTRA_SECURITY_POLICY]';
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitize(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }
}

export const securityLogger = new SecurityLogger();
