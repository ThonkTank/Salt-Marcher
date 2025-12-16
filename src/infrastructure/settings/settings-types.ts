/**
 * Settings service types and interfaces.
 */

import type { PluginSettings } from '@core/schemas';

// ============================================================================
// Settings Service Interface
// ============================================================================

/**
 * Settings service for managing plugin configuration.
 * Settings are persisted in Obsidian's plugin data.
 */
export interface SettingsService {
  /**
   * Get current settings (read-only snapshot).
   */
  getSettings(): Readonly<PluginSettings>;

  /**
   * Update settings with partial values.
   * Merges with existing settings and persists to disk.
   */
  updateSettings(partial: Partial<PluginSettings>): Promise<void>;

  /**
   * Get the resolved path for maps storage.
   * Returns: `{basePath}/maps`
   */
  getMapsPath(): string;

  /**
   * Get the resolved path for parties storage.
   * Returns: `{basePath}/parties`
   */
  getPartiesPath(): string;

  /**
   * Subscribe to settings changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: (settings: PluginSettings) => void): () => void;
}
