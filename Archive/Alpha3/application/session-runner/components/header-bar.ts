/**
 * Header Bar Component
 *
 * Top bar for SessionRunner with map selection and quick actions.
 */

import { setIcon } from 'obsidian';
import type { EntityId } from '@core/types/common';

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  header: 'session-runner-header',
  left: 'session-runner-header-left',
  center: 'session-runner-header-center',
  right: 'session-runner-header-right',
  title: 'session-runner-header-title',
  mapName: 'session-runner-header-map-name',
  button: 'session-runner-header-button',
  dropdown: 'session-runner-header-dropdown',
  dropdownButton: 'session-runner-header-dropdown-button',
  dropdownMenu: 'session-runner-header-dropdown-menu',
  dropdownMenuItem: 'session-runner-header-dropdown-menu-item',
  dropdownMenuItemActive: 'session-runner-header-dropdown-menu-item--active',
} as const;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface HeaderBarConfig {
  title?: string;
}

export interface MapInfo {
  id: EntityId<'map'>;
  name: string;
}

export type MapSelectCallback = (mapId: EntityId<'map'>) => void;

// ═══════════════════════════════════════════════════════════════
// Header Bar
// ═══════════════════════════════════════════════════════════════

export class HeaderBar {
  private readonly container: HTMLElement;
  private readonly leftSection: HTMLElement;
  private readonly centerSection: HTMLElement;
  private readonly rightSection: HTMLElement;

  private mapNameEl: HTMLElement | null = null;
  private mapDropdown: HTMLElement | null = null;
  private mapDropdownMenu: HTMLElement | null = null;

  private availableMaps: MapInfo[] = [];
  private currentMapId: EntityId<'map'> | null = null;
  private onMapSelect: MapSelectCallback | null = null;

  constructor(container: HTMLElement, config: HeaderBarConfig = {}) {
    this.container = container;
    this.container.addClass(CSS.header);
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'space-between';
    this.container.style.padding = '8px 12px';
    this.container.style.borderBottom = '1px solid var(--background-modifier-border)';
    this.container.style.backgroundColor = 'var(--background-secondary)';

    // Create sections
    this.leftSection = this.container.createDiv({ cls: CSS.left });
    this.leftSection.style.display = 'flex';
    this.leftSection.style.alignItems = 'center';
    this.leftSection.style.gap = '8px';

    this.centerSection = this.container.createDiv({ cls: CSS.center });
    this.centerSection.style.flex = '1';
    this.centerSection.style.textAlign = 'center';

    this.rightSection = this.container.createDiv({ cls: CSS.right });
    this.rightSection.style.display = 'flex';
    this.rightSection.style.alignItems = 'center';
    this.rightSection.style.gap = '4px';

    // Title
    const titleEl = this.centerSection.createDiv({ cls: CSS.title });
    titleEl.style.fontWeight = '600';
    titleEl.style.fontSize = '1.1em';
    titleEl.setText(config.title ?? 'Session Runner');

    // Setup map selector in left section
    this.setupMapSelector();

    // Setup click outside handler
    document.addEventListener('click', this.handleClickOutside.bind(this));
  }

  // ─────────────────────────────────────────────────────────────
  // Map Selection
  // ─────────────────────────────────────────────────────────────

  private setupMapSelector(): void {
    this.mapDropdown = this.leftSection.createDiv({ cls: CSS.dropdown });
    this.mapDropdown.style.position = 'relative';

    // Dropdown button
    const button = this.mapDropdown.createEl('button', { cls: CSS.dropdownButton });
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.gap = '6px';
    button.style.padding = '4px 8px';
    button.style.cursor = 'pointer';
    button.style.border = '1px solid var(--background-modifier-border)';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = 'var(--background-primary)';

    const iconEl = button.createSpan();
    iconEl.style.display = 'flex';
    iconEl.style.alignItems = 'center';
    setIcon(iconEl, 'map');
    this.mapNameEl = button.createSpan({ cls: CSS.mapName, text: 'No Map' });
    const chevronEl = button.createSpan();
    chevronEl.style.display = 'flex';
    chevronEl.style.alignItems = 'center';
    chevronEl.style.color = 'var(--text-muted)';
    setIcon(chevronEl, 'chevron-down');

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Dropdown menu (hidden by default)
    this.mapDropdownMenu = this.mapDropdown.createDiv({ cls: CSS.dropdownMenu });
    this.mapDropdownMenu.style.display = 'none';
    this.mapDropdownMenu.style.position = 'absolute';
    this.mapDropdownMenu.style.top = '100%';
    this.mapDropdownMenu.style.left = '0';
    this.mapDropdownMenu.style.marginTop = '4px';
    this.mapDropdownMenu.style.minWidth = '180px';
    this.mapDropdownMenu.style.backgroundColor = 'var(--background-primary)';
    this.mapDropdownMenu.style.border = '1px solid var(--background-modifier-border)';
    this.mapDropdownMenu.style.borderRadius = '6px';
    this.mapDropdownMenu.style.boxShadow = '0 2px 8px var(--background-modifier-box-shadow)';
    this.mapDropdownMenu.style.zIndex = '100';
    this.mapDropdownMenu.style.overflow = 'hidden';
  }

  /**
   * Set available maps for dropdown
   */
  setAvailableMaps(maps: MapInfo[]): void {
    this.availableMaps = maps;
    this.renderDropdownMenu();
  }

  /**
   * Set current map
   */
  setCurrentMap(mapId: EntityId<'map'> | null, mapName: string): void {
    this.currentMapId = mapId;
    if (this.mapNameEl) {
      this.mapNameEl.setText(mapName || 'No Map');
    }
    this.renderDropdownMenu();
  }

  /**
   * Set map select callback
   */
  setMapSelectHandler(callback: MapSelectCallback): () => void {
    this.onMapSelect = callback;
    return () => {
      this.onMapSelect = null;
    };
  }

  private toggleDropdown(): void {
    if (!this.mapDropdownMenu) return;

    const isVisible = this.mapDropdownMenu.style.display !== 'none';
    this.mapDropdownMenu.style.display = isVisible ? 'none' : 'block';
  }

  private closeDropdown(): void {
    if (this.mapDropdownMenu) {
      this.mapDropdownMenu.style.display = 'none';
    }
  }

  private handleClickOutside(e: MouseEvent): void {
    if (this.mapDropdown && !this.mapDropdown.contains(e.target as Node)) {
      this.closeDropdown();
    }
  }

  private renderDropdownMenu(): void {
    if (!this.mapDropdownMenu) return;

    this.mapDropdownMenu.empty();

    if (this.availableMaps.length === 0) {
      const emptyItem = this.mapDropdownMenu.createDiv({ cls: CSS.dropdownMenuItem });
      emptyItem.style.padding = '8px 12px';
      emptyItem.setText('No maps available');
      emptyItem.style.fontStyle = 'italic';
      emptyItem.style.color = 'var(--text-muted)';
      return;
    }

    for (const map of this.availableMaps) {
      const item = this.mapDropdownMenu.createDiv({
        cls: [
          CSS.dropdownMenuItem,
          map.id === this.currentMapId ? CSS.dropdownMenuItemActive : '',
        ].filter(Boolean),
      });
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.padding = '8px 12px';
      item.style.cursor = 'pointer';
      if (map.id === this.currentMapId) {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
        item.style.fontWeight = '500';
      }

      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = map.id === this.currentMapId
          ? 'var(--background-modifier-hover)'
          : '';
      });

      const iconEl = item.createSpan();
      iconEl.style.display = 'flex';
      iconEl.style.alignItems = 'center';
      setIcon(iconEl, 'map');
      item.createSpan({ text: map.name });

      item.addEventListener('click', () => {
        this.closeDropdown();
        if (this.onMapSelect && map.id !== this.currentMapId) {
          this.onMapSelect(map.id);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Actions (Right Section)
  // ─────────────────────────────────────────────────────────────

  /**
   * Add action button to right section
   */
  addAction(icon: string, tooltip: string, onClick: () => void): HTMLButtonElement {
    const button = this.rightSection.createEl('button', {
      cls: CSS.button,
      attr: { 'aria-label': tooltip, title: tooltip },
    });
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.padding = '6px';
    button.style.cursor = 'pointer';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = 'transparent';

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'var(--background-modifier-hover)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    const iconEl = button.createSpan();
    iconEl.style.display = 'flex';
    iconEl.style.alignItems = 'center';
    setIcon(iconEl, icon);

    button.addEventListener('click', onClick);
    return button;
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  dispose(): void {
    document.removeEventListener('click', this.handleClickOutside.bind(this));
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createHeaderBar(container: HTMLElement, config?: HeaderBarConfig): HeaderBar {
  return new HeaderBar(container, config);
}
