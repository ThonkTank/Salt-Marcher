// src/services/logging/configurable-logger.ts
// Configurable logging system with per-module log levels and category toggles

import type { App } from "obsidian";
import { logger } from './logger';

/**
 * Log levels in order of verbosity (trace = most verbose, error = least verbose)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Configuration for the configurable logger
 */
export interface LogConfig {
  /** Global log level - logs below this level are suppressed */
  logLevel: LogLevel;
  /** Per-module log level overrides */
  modules: Record<string, LogLevel>;
  /** Category toggles for debug categories */
  categories: Record<string, boolean>;
}

/**
 * Legacy debug config format (for backwards compatibility)
 */
interface LegacyDebugConfig {
  enabled?: boolean;
  logAll?: boolean;
  logFields?: string[];
  logCategories?: string[];
}

/**
 * Module logger interface returned by forModule()
 */
export interface ModuleLogger {
  trace: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

// Log level priority (higher = more important, always shown)
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/**
 * Default configuration for production use
 * Only shows INFO, WARN, and ERROR logs
 */
const DEFAULT_CONFIG: LogConfig = {
  logLevel: 'info',
  modules: {},
  categories: {},
};

/**
 * ConfigurableLogger provides module-specific logging with configurable log levels.
 *
 * Usage:
 * ```typescript
 * const log = configurableLogger.forModule('tile-cache');
 * log.trace('Detailed iteration data');  // Only shown if level <= trace
 * log.debug('Checkpoint reached');       // Only shown if level <= debug
 * log.info('Operation completed');       // Shown by default
 * log.warn('Potential issue');           // Shown by default
 * log.error('Something failed');         // Always shown
 * ```
 */
class ConfigurableLogger {
  private config: LogConfig = { ...DEFAULT_CONFIG };
  private moduleLoggers: Map<string, ModuleLogger> = new Map();

  /**
   * Load configuration from .claude/debug.json
   * Supports both new format (logLevel, modules, categories) and legacy format (enabled, logAll)
   * Falls back to default config if file doesn't exist
   */
  async loadConfig(app: App): Promise<void> {
    try {
      const configPath = ".obsidian/plugins/salt-marcher/.claude/debug.json";
      const adapter = app.vault.adapter;

      if (!(await adapter.exists(configPath))) {
        // No config file - use defaults (production mode)
        return;
      }

      const configContent = await adapter.read(configPath);
      const parsed = JSON.parse(configContent) as Partial<LogConfig> & LegacyDebugConfig;

      // Check if this is a legacy config format
      if ('enabled' in parsed || 'logAll' in parsed) {
        // Legacy format: convert to new format
        this.config = this.convertLegacyConfig(parsed);
      } else {
        // New format: merge with defaults
        this.config = {
          logLevel: parsed.logLevel ?? DEFAULT_CONFIG.logLevel,
          modules: parsed.modules ?? DEFAULT_CONFIG.modules,
          categories: parsed.categories ?? DEFAULT_CONFIG.categories,
        };
      }

      // Log config if we're in debug mode
      if (this.shouldLog('configurable-logger', 'debug')) {
        logger.debug('[ConfigurableLogger] Config loaded:', this.config);
      }
    } catch (error) {
      // Config load failed - use defaults
      logger.warn('[ConfigurableLogger] Failed to load config, using defaults:', error);
    }
  }

  /**
   * Convert legacy debug config to new format
   */
  private convertLegacyConfig(legacy: LegacyDebugConfig): LogConfig {
    // If not enabled, use production defaults (info level)
    if (!legacy.enabled) {
      return { ...DEFAULT_CONFIG };
    }

    // If logAll is true, enable everything at trace level
    if (legacy.logAll) {
      return {
        logLevel: 'trace',
        modules: {},
        categories: {},
      };
    }

    // Convert logCategories to category toggles
    const categories: Record<string, boolean> = {};
    if (legacy.logCategories) {
      for (const cat of legacy.logCategories) {
        if (cat !== '*') {
          categories[cat] = true;
        }
      }
      // If * is in categories, enable all at debug level
      if (legacy.logCategories.includes('*')) {
        return {
          logLevel: 'debug',
          modules: {},
          categories: {},
        };
      }
    }

    return {
      logLevel: 'info',
      modules: {},
      categories,
    };
  }

  /**
   * Get a module-specific logger
   * Returns cached logger if already created for this module
   */
  forModule(moduleName: string): ModuleLogger {
    let moduleLogger = this.moduleLoggers.get(moduleName);
    if (moduleLogger) {
      return moduleLogger;
    }

    moduleLogger = {
      trace: (msg: string, ...args: unknown[]) => {
        if (this.shouldLog(moduleName, 'trace')) {
          logger.debug(`[${moduleName}] ${msg}`, ...args);
        }
      },
      debug: (msg: string, ...args: unknown[]) => {
        if (this.shouldLog(moduleName, 'debug')) {
          logger.debug(`[${moduleName}] ${msg}`, ...args);
        }
      },
      info: (msg: string, ...args: unknown[]) => {
        if (this.shouldLog(moduleName, 'info')) {
          logger.info(`[${moduleName}] ${msg}`, ...args);
        }
      },
      warn: (msg: string, ...args: unknown[]) => {
        if (this.shouldLog(moduleName, 'warn')) {
          logger.warn(`[${moduleName}] ${msg}`, ...args);
        }
      },
      error: (msg: string, ...args: unknown[]) => {
        // Errors are always logged
        logger.error(`[${moduleName}] ${msg}`, ...args);
      },
    };

    this.moduleLoggers.set(moduleName, moduleLogger);
    return moduleLogger;
  }

  /**
   * Log a message for a specific category (only if enabled)
   * Categories are independent of log levels - they're on/off toggles
   */
  category(categoryName: string, msg: string, ...args: unknown[]): void {
    if (this.config.categories[categoryName]) {
      logger.debug(`[${categoryName}] ${msg}`, ...args);
    }
  }

  /**
   * Check if a log should be shown based on module and level
   */
  private shouldLog(moduleName: string, level: LogLevel): boolean {
    // Get effective level for this module (module override or global)
    const effectiveLevel = this.config.modules[moduleName] ?? this.config.logLevel;
    const effectivePriority = LEVEL_PRIORITY[effectiveLevel];
    const messagePriority = LEVEL_PRIORITY[level];

    // Log if message priority is >= effective level priority
    return messagePriority >= effectivePriority;
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime (useful for testing)
   */
  setConfig(config: Partial<LogConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    // Clear cached loggers so they pick up new config
    this.moduleLoggers.clear();
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.moduleLoggers.clear();
  }
}

// Singleton instance
export const configurableLogger = new ConfigurableLogger();

// Re-export the logger for convenience
export { logger };
