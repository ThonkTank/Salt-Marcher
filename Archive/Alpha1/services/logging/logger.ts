// src/services/logging/logger.ts
// Dedicated logger for Salt Marcher plugin that captures all console output to CONSOLE_LOG.txt

import type { App} from "obsidian";
import { TFile } from "obsidian";

export type LogLevel = 'LOG' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
}

const LOG_FILE_PATH = '.obsidian/plugins/salt-marcher/CONSOLE_LOG.txt';

/**
 * Singleton logger that captures all Salt Marcher console output
 * and writes it to CONSOLE_LOG.txt
 */
class PluginLogger {
    private static instance?: PluginLogger;
    private buffer: LogEntry[] = [];
    private app?: App;
    private flushInterval?: number;
    private isShutdown = false;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): PluginLogger {
        if (!PluginLogger.instance) {
            PluginLogger.instance = new PluginLogger();
        }
        return PluginLogger.instance;
    }

    /**
     * Initialize logger with Obsidian app instance.
     * Clears previous log file and starts new session.
     */
    async init(app: App): Promise<void> {
        this.app = app;
        this.isShutdown = false;
        this.buffer = [];

        // Clear/create log file for new session
        await this.clearLogFile();

        this.log('='.repeat(80));
        this.log('Salt Marcher Plugin Logger - Session Start');
        this.log(`Timestamp: ${new Date().toISOString()}`);
        this.log('='.repeat(80));

        // Periodically flush logs every 10 seconds (crash safety)
        this.flushInterval = window.setInterval(() => {
            void this.flush();
        }, 10000);
    }

    /**
     * Shutdown logger and perform final flush
     */
    async shutdown(): Promise<void> {
        if (this.isShutdown) return;
        this.isShutdown = true;

        this.log('='.repeat(80));
        this.log('Salt Marcher Plugin Logger - Session End');
        this.log('='.repeat(80));

        if (this.flushInterval !== undefined) {
            window.clearInterval(this.flushInterval);
            this.flushInterval = undefined;
        }

        await this.flush();
        this.buffer = [];
    }

    /**
     * Log a message
     */
    log(...args: unknown[]): void {
        this.capture('LOG', args);
        console.log('[salt-marcher]', ...args);
    }

    /**
     * Log an error with stack trace
     */
    error(...args: unknown[]): void {
        this.capture('ERROR', args);
        console.error('[salt-marcher]', ...args);
    }

    /**
     * Log a warning
     */
    warn(...args: unknown[]): void {
        this.capture('WARN', args);
        console.warn('[salt-marcher]', ...args);
    }

    /**
     * Log info
     */
    info(...args: unknown[]): void {
        this.capture('INFO', args);
        console.info('[salt-marcher]', ...args);
    }

    /**
     * Log debug (detailed diagnostic information)
     */
    debug(...args: unknown[]): void {
        this.capture('DEBUG', args);
        console.debug('[salt-marcher]', ...args);
    }

    /**
     * Capture log entry to buffer
     */
    private capture(level: LogLevel, args: unknown[]): void {
        if (this.isShutdown) return;

        const message = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.message}\n${arg.stack || ''}`;
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        this.buffer.push({
            timestamp: new Date().toISOString(),
            level,
            message
        });
    }

    /**
     * Flush buffer to log file
     */
    private async flush(): Promise<void> {
        if (!this.app || this.buffer.length === 0) return;

        try {
            const entries = [...this.buffer];
            this.buffer = [];

            const content = entries.map(entry =>
                `[${entry.timestamp}] ${entry.level}: ${entry.message}`
            ).join('\n') + '\n';

            // Try to read and modify existing file first (most common case)
            try {
                const file = this.app.vault.getAbstractFileByPath(LOG_FILE_PATH);
                if (file instanceof TFile) {
                    const existing = await this.app.vault.read(file);
                    await this.app.vault.modify(file, existing + content);
                    return; // Success!
                }
            } catch (readErr) {
                // File might not exist or read failed, try create below
            }

            // File doesn't exist in cache, try to create it
            try {
                await this.app.vault.create(LOG_FILE_PATH, content);
            } catch (createErr: unknown) {
                // Race condition: file was created by another operation
                const error = createErr instanceof Error ? createErr : new Error(String(createErr));
                if (error.message?.includes('already exists')) {
                    // Retry with adapter (bypasses cache)
                    const existing = await this.app.vault.adapter.read(LOG_FILE_PATH);
                    await this.app.vault.adapter.write(LOG_FILE_PATH, existing + content);
                } else {
                    throw error;
                }
            }
        } catch (err: unknown) {
            // Fallback to console if file operations fail completely
            console.error('[salt-marcher] Failed to flush logs to file:', err);
        }
    }

    /**
     * Clear/recreate log file for new session
     */
    private async clearLogFile(): Promise<void> {
        if (!this.app) return;

        try {
            // Try to modify existing file first (most common case)
            const file = this.app.vault.getAbstractFileByPath(LOG_FILE_PATH);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, '');
                return; // Success!
            }

            // File doesn't exist in cache, try to create it
            try {
                await this.app.vault.create(LOG_FILE_PATH, '');
            } catch (createErr: unknown) {
                // Race condition: file exists but wasn't in cache
                const error = createErr instanceof Error ? createErr : new Error(String(createErr));
                if (error.message?.includes('already exists')) {
                    // Use adapter to bypass cache
                    await this.app.vault.adapter.write(LOG_FILE_PATH, '');
                } else {
                    throw error;
                }
            }
        } catch (err: unknown) {
            console.error('[salt-marcher] Failed to clear log file:', err);
        }
    }
}

// Export singleton instance
export const logger = PluginLogger.getInstance();
