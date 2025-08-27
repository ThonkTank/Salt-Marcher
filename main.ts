/*
* Salt Marcher – Plugin Entry
* Bindet Logger & Settings ein, zeigt beispielhafte Debug-Ausgaben beim Laden.
*/
import { Plugin } from "obsidian";
import { createLogger, logCore, setLoggerConfig } from "./logger";
import { DEFAULT_SETTINGS, type SaltSettings } from "./settings";
import { SaltSettingsTab } from "./settingsTab";


export default class SaltMarcherPlugin extends Plugin {
settings: SaltSettings;


async onload() {
// Settings laden → Logger konfigurieren
await this.loadSettings();
setLoggerConfig({
globalLevel: this.settings.logGlobalLevel,
perNamespace: this.settings.logPerNamespace,
enableConsole: this.settings.logEnableConsole,
enableNotice: this.settings.logEnableNotice,
ringBufferSize: this.settings.logRingBufferSize,
maxContextChars: this.settings.logMaxContextChars,
});


// Settings-Tab registrieren
this.addSettingTab(new SaltSettingsTab(this.app, this));


// Beispiel-Logs (zeigen, dass Logger läuft)
logCore.info("Plugin geladen", { version: this.manifest.version });
const testLogger = createLogger("SelfTest");
testLogger.debug("Debugprobe – sollte bei Level >= DEBUG sichtbar sein", { env: process.env?.NODE_ENV });


// TODO: weitere Initialisierung (HexView etc.)
}


onunload() {
logCore.info("Plugin entladen");
}


async loadSettings() {
const loaded = await this.loadData();
this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
}


async saveSettings() {
await this.saveData(this.settings);
}
}

// ──────────────────────────────────────────────────────────────────────────────
// File: src/main.ts (Integration: Settings laden + Logger updaten + Beispielaktion)
// ──────────────────────────────────────────────────────────────────────────────
import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type SaltSettings } from "./settings";
import { SaltSettingsTab } from "./settingsTab";
import { setLoggerConfig, createLogger } from "./logger";
import { createOrOpenTileNote } from "./templateService";


export default class SaltMarcherPlugin extends Plugin {
settings: SaltSettings;


async onload() {
await this.loadSettings();


// Logger aktualisieren
setLoggerConfig({
globalLevel: this.settings.logGlobalLevel,
perNamespace: this.settings.logPerNamespace,
enableConsole: this.settings.logEnableConsole,
enableNotice: this.settings.logEnableNotice,
ringBufferSize: this.settings.logRingBufferSize,
maxContextChars: this.settings.logMaxContextChars,
});


this.addSettingTab(new SaltSettingsTab(this.app, this));


const logCore = createLogger("Core");
logCore.info("Plugin geladen – Settings & Schemas aktiv", { version: this.manifest.version });


// Demo-Command: "Create Tile at (0,0)"
this.addCommand({
id: "salt-create-tile-0-0",
name: "Demo: Erzeuge Tile 0,0 in Default-Region",
callback: async () => {
const region = this.settings.defaultRegion || "Region";
await createOrOpenTileNote(this.app, 0, 0, region, this.settings);
},
});
}


async loadSettings() {
const loaded = await this.loadData();
this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
}


async saveSettings() {
await this.saveData(this.settings);
}
}
