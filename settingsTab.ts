/*
* Salt Marcher – Settings Tab (Obsidian UI)
*/
import { App, PluginSettingTab, Setting } from "obsidian";
import type SaltMarcherPlugin from "./main";
import type { LogLevel } from "./logger";
import { getKnownNamespaces, getLoggerConfig, setLoggerConfig } from "./logger";


export class SaltSettingsTab extends PluginSettingTab {
plugin: SaltMarcherPlugin;


constructor(app: App, plugin: SaltMarcherPlugin) {
super(app, plugin);
this.plugin = plugin;
}


display(): void {
const { containerEl } = this;
containerEl.empty();
containerEl.createEl("h2", { text: "Salt Marcher – Einstellungen" });


// — Globales Log Level —
new Setting(containerEl)
.setName("Log-Level (global)")
.setDesc("Mindeststufe für Logs. Per-Namespace-Overrides sind möglich.")
.addDropdown((dd) => {
([("error"), ("warn"), ("info"), ("debug"), ("trace")] as LogLevel[]).forEach((lvl) =>
dd.addOption(lvl, lvl.toUpperCase())
);
dd.setValue(this.plugin.settings.logGlobalLevel);
dd.onChange(async (value: LogLevel) => {
this.plugin.settings.logGlobalLevel = value;
await this.plugin.saveSettings();
setLoggerConfig({ globalLevel: value });
});
});


// — Sinks —
new Setting(containerEl)
.setName("Console-Ausgabe aktivieren")
.setDesc("Logs in der DevTools-Konsole anzeigen")
.addToggle((tg) => {
tg.setValue(this.plugin.settings.logEnableConsole);
tg.onChange(async (v) => {
this.plugin.settings.logEnableConsole = v;
await this.plugin.saveSettings();
setLoggerConfig({ enableConsole: v });
});
});


new Setting(containerEl)
.setName("Notice bei WARN/ERROR")
.setDesc("Zeige kurze Popups bei wichtigen Problemen")
.addToggle((tg) => {
tg.setValue(this.plugin.settings.logEnableNotice);
tg.onChange(async (v) => {
this.plugin.settings.logEnableNotice = v;
await this.plugin.saveSettings();
setLoggerConfig({ enableNotice: v });
});
});


// — Ring-Buffer Größe —
new Setting(containerEl)
.setName("Ring-Buffer Größe")
.setDesc("Wieviele Logeinträge intern gepuffert werden (für Export/Support)")
}

// ──────────────────────────────────────────────────────────────────────────────
// File: src/settingsTab.ts (UI-Ergänzungen für Pfade)
// ──────────────────────────────────────────────────────────────────────────────
import { App, PluginSettingTab, Setting } from "obsidian";
import type SaltMarcherPlugin from "./main";
import { setLoggerConfig } from "./logger";


export class SaltSettingsTab extends PluginSettingTab {
plugin: SaltMarcherPlugin;


constructor(app: App, plugin: SaltMarcherPlugin) {
super(app, plugin);
this.plugin = plugin;
}


display(): void {
const { containerEl } = this;
containerEl.empty();
containerEl.createEl("h2", { text: "Salt Marcher – Einstellungen" });


// … (bestehende Logger-Controls belassen)


containerEl.createEl("h3", { text: "Ordner & Vorlagen" });
this.pathSetting(containerEl, "Hex-Ordner", "hexFolder");
this.pathSetting(containerEl, "Locations-Ordner", "locationsFolder");
this.pathSetting(containerEl, "NPC-Ordner", "npcFolder");
this.pathSetting(containerEl, "Fraktionen-Ordner", "factionsFolder");
this.pathSetting(containerEl, "Sessions-Ordner", "sessionsFolder");


new Setting(containerEl)
.setName("Default-Region")
.setDesc("Wird genutzt, wenn keine Region angegeben ist")
.addText((tb) => {
tb.setPlaceholder("Spitzberge");
tb.setValue(this.plugin.settings.defaultRegion);
tb.onChange(async (v) => {
this.plugin.settings.defaultRegion = v.trim() || "Spitzberge";
await this.plugin.saveSettings();
});
});
}


private pathSetting(containerEl: HTMLElement, label: string, key: keyof import("./settings").SaltSettings) {
new Setting(containerEl)
.setName(label)
.addText((tb) => {
tb.setPlaceholder("Ordnername");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
tb.setValue(String((this.plugin.settings as any)[key]));
tb.onChange(async (v) => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(this.plugin.settings as any)[key] = v.trim() || (this.plugin.settings as any)[key];
await this.plugin.saveSettings();
});
});
}
