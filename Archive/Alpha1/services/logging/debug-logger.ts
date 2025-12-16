// src/services/logging/debug-logger.ts
// Flexible debug logging system with field and category filtering

import type { App } from "obsidian";
import { configurableLogger } from './configurable-logger';
const logger = configurableLogger.forModule('debug-logger');

interface DebugConfig {
  enabled: boolean;
  logFields: string[];
  logCategories: string[];
  logAll: boolean;
}

class DebugLogger {
  private config: DebugConfig = {
    enabled: false,
    logFields: [],
    logCategories: [],
    logAll: false,
  };

  /**
   * Load debug configuration from .claude/debug.json
   * Falls back to disabled if file doesn't exist
   */
  async loadConfig(app: App): Promise<void> {
    try {
      const configPath = ".obsidian/plugins/salt-marcher/.claude/debug.json";
      const adapter = app.vault.adapter;

      // Check if file exists
      if (!(await adapter.exists(configPath))) {
        logger.debug("No debug config found, using defaults (all disabled)");
        return;
      }

      const configContent = await adapter.read(configPath);
      this.config = JSON.parse(configContent);
      logger.debug("Config loaded:", this.config);
    } catch (error) {
      // Silently fail - debug config is optional
      logger.debug("Failed to load config, debug logging disabled:", error);
    }
  }

  /**
   * Log a message for a specific field and category
   * Only logs if the field and category match the config
   *
   * @example
   * debugLogger.logField("saveProf", "onChange", "Value changed", { newValue: true });
   */
  logField(fieldId: string, category: string, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(fieldId, category)) return;
    logger.debug(`${message}`, ...args);
  }

  /**
   * Log a message for a specific category (no field filtering)
   * Useful for general debugging that isn't field-specific
   *
   * @example
   * debugLogger.logCategory("onChange", "Callback chain triggered");
   */
  logCategory(category: string, message: string, ...args: unknown[]): void {
    if (!this.shouldLogCategory(category)) return;
    logger.debug(`${message}`, ...args);
  }

  /**
   * Check if we should log for this field and category combination
   */
  private shouldLog(fieldId: string, category: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.logAll) return true;

    const fieldMatch = this.config.logFields.includes(fieldId) ||
                       this.config.logFields.includes("*");
    const categoryMatch = this.config.logCategories.includes(category) ||
                          this.config.logCategories.includes("*");

    return fieldMatch && categoryMatch;
  }

  /**
   * Check if we should log for this category (any field)
   */
  private shouldLogCategory(category: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.logAll) return true;

    return this.config.logCategories.includes(category) ||
           this.config.logCategories.includes("*");
  }

  /**
   * Get current config (for debugging the debugger!)
   */
  getConfig(): DebugConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();
