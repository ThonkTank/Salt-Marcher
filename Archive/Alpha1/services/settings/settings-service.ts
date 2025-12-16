/**
 * Settings Service - Provides access to plugin settings
 *
 * This service provides a clean way to access plugin settings without
 * violating layer boundaries or using @ts-ignore hacks.
 */

import type { SaltMarcherSettings } from "@services/domain/settings-types";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('settings-service');

/**
 * Settings Service for accessing plugin configuration
 */
export class SettingsService {
  private static instance: SettingsService | null = null;
  private settings: SaltMarcherSettings | null = null;

  /**
   * Initialize the settings service with plugin settings
   * Should be called once during plugin initialization
   */
  static initialize(settings: SaltMarcherSettings): void {
    if (this.instance) {
      logger.warn("Already initialized, updating settings");
    }
    this.instance = new SettingsService(settings);
    logger.debug("Initialized with settings");
  }

  /**
   * Get the singleton instance
   * @throws Error if not initialized
   */
  static getInstance(): SettingsService {
    if (!this.instance) {
      throw new Error(
        "SettingsService not initialized. Call SettingsService.initialize() first."
      );
    }
    return this.instance;
  }

  /**
   * Update settings (called when settings change)
   */
  static updateSettings(settings: SaltMarcherSettings): void {
    if (!this.instance) {
      throw new Error("SettingsService not initialized");
    }
    this.instance.settings = settings;
    logger.debug("Settings updated");
  }

  /**
   * Cleanup the service
   */
  static cleanup(): void {
    this.instance = null;
    logger.debug("Cleaned up");
  }

  private constructor(settings: SaltMarcherSettings) {
    this.settings = settings;
  }

  /**
   * Get all settings (for debugging/testing)
   */
  getAllSettings(): SaltMarcherSettings | null {
    return this.settings;
  }

  /**
   * Check if service is initialized (for defensive programming)
   */
  static isInitialized(): boolean {
    return this.instance !== null;
  }
}