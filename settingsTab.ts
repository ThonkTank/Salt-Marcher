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
