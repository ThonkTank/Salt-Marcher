// src/app/interfaces.ts
import type { App } from "obsidian";
import type { SaltMarcherSettings } from "@services/domain/settings-types";

// Re-export SaltMarcherSettings for backward compatibility
export type { SaltMarcherSettings };

/**
 * Minimal interface for the plugin host
 * Used by SettingTab to avoid circular dependency with main.ts
 * Only includes properties and methods needed by settings-tab.ts
 */
export interface IPluginHost {
	app: App;
	settings: SaltMarcherSettings;
	manifest: { id: string; name: string; version: string };
	saveSettings(): Promise<void>;
	loadSettings(): Promise<void>;
}
