/**
 * Toolbar Component
 *
 * Top toolbar with map actions (Open, New, Save, Delete).
 */

import { setIcon } from 'obsidian';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ToolbarCallbacks {
  onOpen: () => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export interface ToolbarState {
  mapName: string;
  isDirty: boolean;
  hasMap: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Toolbar
// ═══════════════════════════════════════════════════════════════

export class Toolbar {
  private container: HTMLElement;
  private callbacks: ToolbarCallbacks;

  private openBtn!: HTMLButtonElement;
  private newBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;
  private deleteBtn!: HTMLButtonElement;
  private mapNameEl!: HTMLSpanElement;
  private dirtyIndicator!: HTMLSpanElement;

  constructor(container: HTMLElement, callbacks: ToolbarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.render();
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  private render(): void {
    this.container.addClass('cartographer-toolbar');

    // Left section: Action buttons
    const leftSection = this.container.createDiv('toolbar-left');

    this.openBtn = this.createButton(leftSection, 'folder-open', 'Open Map', () =>
      this.callbacks.onOpen()
    );
    this.newBtn = this.createButton(leftSection, 'file-plus', 'New Map', () =>
      this.callbacks.onNew()
    );
    this.saveBtn = this.createButton(leftSection, 'save', 'Save Map', () =>
      this.callbacks.onSave()
    );
    this.deleteBtn = this.createButton(leftSection, 'trash-2', 'Delete Map', () =>
      this.callbacks.onDelete()
    );

    // Right section: Map name
    const rightSection = this.container.createDiv('toolbar-right');

    const mapLabel = rightSection.createSpan('toolbar-map-label');
    mapLabel.setText('Map:');

    this.mapNameEl = rightSection.createSpan('toolbar-map-name');
    this.mapNameEl.setText('(none)');

    this.dirtyIndicator = rightSection.createSpan('toolbar-dirty');
    this.dirtyIndicator.setText('*');
    this.dirtyIndicator.style.display = 'none';
  }

  private createButton(
    parent: HTMLElement,
    icon: string,
    tooltip: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = parent.createEl('button', {
      cls: 'toolbar-button',
      attr: { 'aria-label': tooltip, title: tooltip },
    });
    setIcon(btn, icon);
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ─────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────

  /**
   * Update toolbar state
   */
  update(state: ToolbarState): void {
    // Update map name
    this.mapNameEl.setText(state.mapName || '(none)');

    // Update dirty indicator
    this.dirtyIndicator.style.display = state.isDirty ? 'inline' : 'none';

    // Enable/disable buttons based on map presence
    this.saveBtn.disabled = !state.hasMap;
    this.deleteBtn.disabled = !state.hasMap;

    // Visual feedback for disabled state
    this.saveBtn.toggleClass('is-disabled', !state.hasMap);
    this.deleteBtn.toggleClass('is-disabled', !state.hasMap);
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.container.empty();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createToolbar(
  container: HTMLElement,
  callbacks: ToolbarCallbacks
): Toolbar {
  return new Toolbar(container, callbacks);
}
