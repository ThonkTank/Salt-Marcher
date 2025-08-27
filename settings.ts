/*
* Salt Marcher – Settings Typen & Defaults
*/
import type { LogLevel } from "./logger";


export interface SaltSettings {
logGlobalLevel: LogLevel;
logPerNamespace: Record<string, LogLevel | undefined>;
logEnableConsole: boolean;
logEnableNotice: boolean;
logRingBufferSize: number;
logMaxContextChars: number;
}


export const DEFAULT_SETTINGS: SaltSettings = {
logGlobalLevel: "info",
logPerNamespace: {},
logEnableConsole: true,
logEnableNotice: true,
logRingBufferSize: 500,
logMaxContextChars: 10_000,
};

// ──────────────────────────────────────────────────────────────────────────────
// File: src/settings.ts (Erweiterung um Pfad-Settings)
// ──────────────────────────────────────────────────────────────────────────────
export interface SaltSettings {
logGlobalLevel: import("./logger").LogLevel;
logPerNamespace: Record<string, import("./logger").LogLevel | undefined>;
logEnableConsole: boolean;
logEnableNotice: boolean;
logRingBufferSize: number;
logMaxContextChars: number;


// Neu: Ordnerpfade
hexFolder: string;
locationsFolder: string;
npcFolder: string;
factionsFolder: string;
sessionsFolder: string;


// Neu: Default-Region (falls nicht angegeben)
defaultRegion: string;
}


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


export type { PathConfig } from "./templateService";
