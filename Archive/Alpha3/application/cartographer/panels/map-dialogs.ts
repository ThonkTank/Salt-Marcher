/**
 * Map Dialogs Component
 *
 * Modal dialogs for map operations: New, Open, Delete.
 */

import { App, Modal, Setting } from 'obsidian';
import type { EntityId } from '@core/types/common';

// ═══════════════════════════════════════════════════════════════
// New Map Dialog
// ═══════════════════════════════════════════════════════════════

export interface NewMapResult {
  name: string;
  radius: number;
  defaultTerrain: string;
}

export class NewMapDialog extends Modal {
  private result: NewMapResult | null = null;
  private onSubmit: (result: NewMapResult) => void;
  private terrainOptions: Array<{ id: string; name: string }>;

  constructor(
    app: App,
    terrainOptions: Array<{ id: string; name: string }>,
    onSubmit: (result: NewMapResult) => void
  ) {
    super(app);
    this.terrainOptions = terrainOptions;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Create New Map' });

    let nameValue = 'New Map';
    let radiusValue = 10;
    let terrainValue = 'grassland';

    // Name input
    new Setting(contentEl)
      .setName('Map Name')
      .setDesc('Display name for the map')
      .addText((text) => {
        text
          .setPlaceholder('Enter map name')
          .setValue(nameValue)
          .onChange((value) => {
            nameValue = value;
          });
        text.inputEl.focus();
      });

    // Radius slider
    new Setting(contentEl)
      .setName('Radius')
      .setDesc('Map size in hexes from center (1-30)')
      .addSlider((slider) => {
        slider
          .setLimits(1, 30, 1)
          .setValue(radiusValue)
          .setDynamicTooltip()
          .onChange((value) => {
            radiusValue = value;
          });
      });

    // Default terrain dropdown
    new Setting(contentEl)
      .setName('Default Terrain')
      .setDesc('Initial terrain type for all tiles')
      .addDropdown((dropdown) => {
        for (const terrain of this.terrainOptions) {
          dropdown.addOption(terrain.id, terrain.name);
        }
        dropdown.setValue(terrainValue);
        dropdown.onChange((value) => {
          terrainValue = value;
        });
      });

    // Buttons
    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText('Cancel')
          .onClick(() => {
            this.close();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText('Create')
          .setCta()
          .onClick(() => {
            if (nameValue.trim()) {
              this.result = {
                name: nameValue.trim(),
                radius: radiusValue,
                defaultTerrain: terrainValue,
              };
              this.onSubmit(this.result);
              this.close();
            }
          });
      });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Open Map Dialog
// ═══════════════════════════════════════════════════════════════

export interface MapListEntry {
  id: EntityId<'map'>;
  name: string;
  type: string;
}

export class OpenMapDialog extends Modal {
  private onSelect: (mapId: EntityId<'map'>) => void;
  private maps: MapListEntry[];

  constructor(
    app: App,
    maps: MapListEntry[],
    onSelect: (mapId: EntityId<'map'>) => void
  ) {
    super(app);
    this.maps = maps;
    this.onSelect = onSelect;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Open Map' });

    if (this.maps.length === 0) {
      contentEl.createEl('p', {
        text: 'No maps found. Create a new map first.',
        cls: 'no-maps-message',
      });

      new Setting(contentEl).addButton((btn) => {
        btn.setButtonText('Close').onClick(() => this.close());
      });
      return;
    }

    // Map list
    const listEl = contentEl.createDiv('map-list');

    for (const map of this.maps) {
      const itemEl = listEl.createDiv('map-list-item');
      itemEl.createSpan({ text: map.name, cls: 'map-name' });
      itemEl.createSpan({ text: ` (${map.type})`, cls: 'map-type' });

      itemEl.addEventListener('click', () => {
        this.onSelect(map.id);
        this.close();
      });
    }

    // Cancel button
    new Setting(contentEl).addButton((btn) => {
      btn.setButtonText('Cancel').onClick(() => this.close());
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Delete Confirm Dialog
// ═══════════════════════════════════════════════════════════════

export class DeleteMapDialog extends Modal {
  private onConfirm: () => void;
  private mapName: string;

  constructor(app: App, mapName: string, onConfirm: () => void) {
    super(app);
    this.mapName = mapName;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Delete Map' });

    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${this.mapName}"?`,
    });

    contentEl.createEl('p', {
      text: 'This action cannot be undone.',
      cls: 'delete-warning',
    });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText('Cancel').onClick(() => this.close());
      })
      .addButton((btn) => {
        btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(() => {
            this.onConfirm();
            this.close();
          });
      });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Unsaved Changes Dialog
// ═══════════════════════════════════════════════════════════════

export type UnsavedChangesAction = 'save' | 'discard' | 'cancel';

export class UnsavedChangesDialog extends Modal {
  private onAction: (action: UnsavedChangesAction) => void;

  constructor(app: App, onAction: (action: UnsavedChangesAction) => void) {
    super(app);
    this.onAction = onAction;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Unsaved Changes' });

    contentEl.createEl('p', {
      text: 'You have unsaved changes. What would you like to do?',
    });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText('Cancel').onClick(() => {
          this.onAction('cancel');
          this.close();
        });
      })
      .addButton((btn) => {
        btn.setButtonText('Discard').onClick(() => {
          this.onAction('discard');
          this.close();
        });
      })
      .addButton((btn) => {
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(() => {
            this.onAction('save');
            this.close();
          });
      });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════

export function showNewMapDialog(
  app: App,
  terrainOptions: Array<{ id: string; name: string }>,
  onSubmit: (result: NewMapResult) => void
): void {
  new NewMapDialog(app, terrainOptions, onSubmit).open();
}

export function showOpenMapDialog(
  app: App,
  maps: MapListEntry[],
  onSelect: (mapId: EntityId<'map'>) => void
): void {
  new OpenMapDialog(app, maps, onSelect).open();
}

export function showDeleteMapDialog(
  app: App,
  mapName: string,
  onConfirm: () => void
): void {
  new DeleteMapDialog(app, mapName, onConfirm).open();
}

export function showUnsavedChangesDialog(
  app: App,
  onAction: (action: UnsavedChangesAction) => void
): void {
  new UnsavedChangesDialog(app, onAction).open();
}
