// src/app/settings-tab.ts
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { IPluginHost } from "./interfaces";

/**
 * Settings tab for Salt Marcher plugin configuration
 */
export class SaltMarcherSettingTab extends PluginSettingTab {
    plugin: IPluginHost;

    constructor(app: App, plugin: IPluginHost) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", { text: "Salt Marcher Settings" });

        // Currently no settings are available
        containerEl.createEl("p", { text: "No configuration options available at this time." });
    }
}
