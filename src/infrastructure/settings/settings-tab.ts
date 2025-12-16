/**
 * Settings tab for Obsidian plugin settings UI.
 */

import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsService } from './settings-types';

// ============================================================================
// Settings Tab
// ============================================================================

/**
 * Salt Marcher settings tab.
 * Displays in Obsidian's Settings → Community plugins → Salt Marcher.
 */
export class SaltMarcherSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly settingsService: SettingsService
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Salt Marcher Settings' });

    // Base Path Setting
    new Setting(containerEl)
      .setName('Data folder')
      .setDesc(
        'Base folder for all Salt Marcher data (relative to vault root). ' +
          'Maps, parties, and other data will be stored here.'
      )
      .addText((text) =>
        text
          .setPlaceholder('SaltMarcher')
          .setValue(this.settingsService.getSettings().basePath)
          .onChange(async (value) => {
            // Sanitize: trim whitespace, use default if empty
            const sanitized = value.trim() || 'SaltMarcher';
            await this.settingsService.updateSettings({ basePath: sanitized });
          })
      );

    // Info section
    containerEl.createEl('h3', { text: 'Data Paths' });
    const pathsDesc = containerEl.createEl('p', {
      cls: 'setting-item-description',
    });
    const settings = this.settingsService.getSettings();
    pathsDesc.innerHTML = `
      Maps: <code>${settings.basePath}/maps/</code><br>
      Parties: <code>${settings.basePath}/parties/</code>
    `;
  }
}
