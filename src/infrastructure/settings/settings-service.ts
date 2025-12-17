/**
 * Settings service implementation.
 *
 * Manages plugin settings with persistence to Obsidian's plugin data.
 */

import type { Plugin } from 'obsidian';
import type { PluginSettings } from '@core/schemas';
import { pluginSettingsSchema, DEFAULT_SETTINGS } from '@core/schemas';
import type { SettingsService } from './settings-types';

// ============================================================================
// Settings Loading
// ============================================================================

/**
 * Load settings from plugin data.
 * Returns DEFAULT_SETTINGS if no data exists or parsing fails.
 */
export async function loadSettings(plugin: Plugin): Promise<PluginSettings> {
  const data = await plugin.loadData();

  if (!data) {
    return DEFAULT_SETTINGS;
  }

  const result = pluginSettingsSchema.safeParse(data);

  if (!result.success) {
    console.warn('Salt Marcher: Invalid settings data, using defaults', result.error);
    return DEFAULT_SETTINGS;
  }

  return result.data;
}

// ============================================================================
// Settings Service Factory
// ============================================================================

/**
 * Create a settings service instance.
 *
 * @param plugin - Obsidian plugin instance for data persistence
 * @param initialSettings - Initial settings (typically from loadSettings)
 */
export function createSettingsService(
  plugin: Plugin,
  initialSettings: PluginSettings = DEFAULT_SETTINGS
): SettingsService {
  let settings: PluginSettings = { ...initialSettings };
  const listeners = new Set<(settings: PluginSettings) => void>();

  return {
    getSettings(): Readonly<PluginSettings> {
      return settings;
    },

    async updateSettings(partial: Partial<PluginSettings>): Promise<void> {
      settings = { ...settings, ...partial };
      await plugin.saveData(settings);
      listeners.forEach((listener) => listener(settings));
    },

    getMapsPath(): string {
      return `${settings.basePath}/maps`;
    },

    getPartiesPath(): string {
      return `${settings.basePath}/parties`;
    },

    getTimePath(): string {
      return `${settings.basePath}/time`;
    },

    getAlmanacPath(): string {
      return `${settings.basePath}/almanac`;
    },

    subscribe(listener: (settings: PluginSettings) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
