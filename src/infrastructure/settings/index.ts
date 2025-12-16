/**
 * Settings infrastructure - Public API
 */

// Types
export type { SettingsService } from './settings-types';

// Service
export { loadSettings, createSettingsService } from './settings-service';

// UI
export { SaltMarcherSettingTab } from './settings-tab';
