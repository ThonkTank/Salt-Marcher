/*
 * Salt Marcher – Settings (integriert)
 * - Enthält Log-/Debug-Optionen
 * - Enthält Pfad-Settings + defaultRegion
 * - Liefert DEFAULT_SETTINGS
 * - withDefaults(): defensives Mergen & Pfad-Normalisierung
 */

import type { LogLevel } from "./logger";

// Export für template-bezogene Typen (z. B. von TemplateService genutzt)
export type { PathConfig } from "./templateService";

/** Zentrale Settings-Struktur für das Plugin. */
export interface SaltSettings {
  // Logger / Debug
  logGlobalLevel: LogLevel;
  logPerNamespace: Record<string, LogLevel | undefined>;
  logEnableConsole: boolean;
  logEnableNotice: boolean;
  logRingBufferSize: number;
  logMaxContextChars: number;

  // Projektpfade
  hexFolder: string;
  locationsFolder: string;
  npcFolder: string;
  factionsFolder: string;
  sessionsFolder: string;

  // Defaults
  defaultRegion: string;
}

/** Voreinstellungen – bewusst konservativ und sprachneutral. */
export const DEFAULT_SETTINGS: SaltSettings = {
  logGlobalLevel: "info",
  logPerNamespace: {},
  logEnableConsole: true,
  logEnableNotice: true,
  logRingBufferSize: 500,
  logMaxContextChars: 10_000,

  hexFolder: "Hexes",
  locationsFolder: "Locations",
  npcFolder: "NPC",
  factionsFolder: "Factions",
  sessionsFolder: "Sessions",

  defaultRegion: "Spitzberge",
};

/* ───────────────────────────── Helper ───────────────────────────── */

/**
 * Normalisiert einen Obsidian-Ordnerpfad:
 * - Backslashes -> Slashes
 * - Trim
 * - führt/endet nicht mit Slash
 * - doppelte Slashes werden reduziert
 */
function sanitizePath(raw: string | undefined | null): string {
  const s = String(raw ?? "")
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "") // leading/trailing slashes
    .replace(/\/{2,}/g, "/");  // collapse multiple slashes
  return s;
}

/**
 * Merge-Funktion für geladene Settings aus `loadData()`.
 * Nutzt DEFAULT_SETTINGS als Basis und normalisiert Pfade sauber.
 * Tipp: In `main.ts` statt `Object.assign({}, DEFAULT_SETTINGS, loaded)` verwenden.
 */
export function withDefaults(
  loaded: Partial<SaltSettings> | null | undefined
): SaltSettings {
  const merged: SaltSettings = {
    ...DEFAULT_SETTINGS,
    ...(loaded ?? {}),
  };

  // Pfade robust normalisieren; leere Werte auf Defaults zurücksetzen
  merged.hexFolder = sanitizePath(merged.hexFolder) || DEFAULT_SETTINGS.hexFolder;
  merged.locationsFolder =
    sanitizePath(merged.locationsFolder) || DEFAULT_SETTINGS.locationsFolder;
  merged.npcFolder = sanitizePath(merged.npcFolder) || DEFAULT_SETTINGS.npcFolder;
  merged.factionsFolder =
    sanitizePath(merged.factionsFolder) || DEFAULT_SETTINGS.factionsFolder;
  merged.sessionsFolder =
    sanitizePath(merged.sessionsFolder) || DEFAULT_SETTINGS.sessionsFolder;

  // defaultRegion defensiv trimmen
  merged.defaultRegion = (merged.defaultRegion ?? DEFAULT_SETTINGS.defaultRegion).trim() || DEFAULT_SETTINGS.defaultRegion;

  return merged;
}
