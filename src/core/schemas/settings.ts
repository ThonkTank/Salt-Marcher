/**
 * Plugin settings schema definitions.
 *
 * Defines the structure for user-configurable plugin settings.
 * Settings are stored in Obsidian's plugin data (.obsidian/plugins/salt-marcher/data.json).
 */

import { z } from 'zod';

// ============================================================================
// Settings Schema
// ============================================================================

/**
 * Schema for plugin settings.
 */
export const pluginSettingsSchema = z.object({
  /**
   * Base path for all Salt Marcher data in the vault.
   * Relative to vault root.
   */
  basePath: z.string().min(1).default('SaltMarcher'),

  /**
   * Schema version for future migrations.
   */
  version: z.number().int().positive().default(1),
});

export type PluginSettings = z.infer<typeof pluginSettingsSchema>;

// ============================================================================
// Defaults
// ============================================================================

/**
 * Default settings values.
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  basePath: 'SaltMarcher',
  version: 1,
};
