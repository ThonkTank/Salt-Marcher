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
