/**
 * Tab Navigation Component for Library.
 *
 * Renders horizontal tab navigation for switching between entity types.
 * All 17 MVP entity types are supported.
 *
 * @see docs/application/Library.md#tab-navigation
 */

import type { EntityType } from '@core/types/common';
import type { LibraryViewModel } from './viewmodel';

// ============================================================================
// Tab Configuration
// ============================================================================

/**
 * Configuration for a single tab.
 */
interface TabConfig {
  readonly id: EntityType;
  readonly label: string;
  readonly icon: string;
}

/**
 * Complete tab configuration for all 17 MVP entity types.
 *
 * Order follows the Library.md specification.
 */
const TAB_CONFIGS: readonly TabConfig[] = [
  // Core Entities
  { id: 'creature', label: 'Creatures', icon: '\u{1F43A}' },      // Wolf
  { id: 'character', label: 'Characters', icon: '\u{1F464}' },    // Bust in Silhouette
  { id: 'npc', label: 'NPCs', icon: '\u{1F3AD}' },                // Performing Arts
  { id: 'faction', label: 'Factions', icon: '\u{1F3F4}' },        // Black Flag
  { id: 'item', label: 'Items', icon: '\u{1F5E1}' },              // Dagger

  // World Entities
  { id: 'map', label: 'Maps', icon: '\u{1F5FA}' },                // World Map
  { id: 'poi', label: 'Locations', icon: '\u{1F4CD}' },           // Round Pushpin
  { id: 'maplink', label: 'Map Links', icon: '\u{1F517}' },       // Link
  { id: 'terrain', label: 'Terrains', icon: '\u{1F332}' },        // Evergreen Tree

  // Session Entities
  { id: 'quest', label: 'Quests', icon: '\u{1F4DC}' },            // Scroll
  { id: 'encounter', label: 'Encounters', icon: '\u2694\uFE0F' }, // Crossed Swords
  { id: 'shop', label: 'Shops', icon: '\u{1F3EA}' },              // Convenience Store
  { id: 'party', label: 'Parties', icon: '\u{1F465}' },           // Busts in Silhouette

  // Time & Events
  { id: 'calendar', label: 'Calendars', icon: '\u{1F4C5}' },      // Calendar
  { id: 'journal', label: 'Journal', icon: '\u{1F4D6}' },         // Open Book
  { id: 'worldevent', label: 'World Events', icon: '\u{1F30D}' }, // Earth Globe Europe-Africa

  // Audio
  { id: 'track', label: 'Tracks', icon: '\u{1F3B5}' },            // Musical Note
] as const;

// ============================================================================
// Tab Navigation Component
// ============================================================================

/**
 * Tab Navigation for the Library view.
 *
 * Renders a horizontal tab bar with all entity types.
 * Clicking a tab calls viewModel.setActiveTab().
 *
 * @example
 * ```typescript
 * const tabNav = createTabNavigation(container, viewModel);
 * tabNav.render(state.activeTab);
 *
 * // Later:
 * tabNav.dispose();
 * ```
 */
export class TabNavigation {
  private readonly container: HTMLElement;
  private readonly viewModel: LibraryViewModel;
  private readonly tabs: Map<EntityType, HTMLElement> = new Map();
  private readonly countElements: Map<EntityType, HTMLElement> = new Map();
  private currentActiveTab: EntityType | null = null;

  constructor(container: HTMLElement, viewModel: LibraryViewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.createTabs();
  }

  /**
   * Create all tab elements once.
   */
  private createTabs(): void {
    this.container.empty();

    for (const config of TAB_CONFIGS) {
      const tabEl = this.container.createEl('button', {
        cls: 'library-tab',
        attr: {
          'data-entity-type': config.id,
          'aria-label': config.label,
          role: 'tab',
        },
      });

      // Tab content: icon + label + count
      tabEl.createSpan({ cls: 'library-tab-icon', text: config.icon });
      tabEl.createSpan({ cls: 'library-tab-label', text: config.label });

      // Count badge element
      const countEl = tabEl.createSpan({ cls: 'library-tab-count' });
      countEl.style.cssText = `
        font-size: 11px;
        color: var(--text-muted);
        margin-left: 2px;
      `;
      this.countElements.set(config.id, countEl);

      // Base styling
      this.applyTabStyles(tabEl, false);

      // Click handler
      tabEl.addEventListener('click', () => {
        this.viewModel.setActiveTab(config.id);
      });

      this.tabs.set(config.id, tabEl);
    }
  }

  /**
   * Apply styles to a tab element.
   */
  private applyTabStyles(tabEl: HTMLElement, isActive: boolean): void {
    tabEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: ${isActive ? 'var(--interactive-accent)' : 'var(--background-primary)'};
      color: ${isActive ? 'var(--text-on-accent)' : 'var(--text-normal)'};
      font-size: 13px;
      white-space: nowrap;
      transition: background 0.15s ease, color 0.15s ease;
    `;

    // Hover effect for non-active tabs
    if (!isActive) {
      tabEl.addEventListener('mouseenter', () => {
        if (tabEl.dataset.entityType !== this.currentActiveTab) {
          tabEl.style.background = 'var(--background-modifier-hover)';
        }
      });
      tabEl.addEventListener('mouseleave', () => {
        if (tabEl.dataset.entityType !== this.currentActiveTab) {
          tabEl.style.background = 'var(--background-primary)';
        }
      });
    }
  }

  /**
   * Render/update the tab navigation.
   *
   * Only updates styling if the active tab has changed.
   *
   * @param activeTab - The currently active entity type
   */
  render(activeTab: EntityType): void {
    // Skip if no change
    if (this.currentActiveTab === activeTab) {
      return;
    }

    // Update previous active tab styling
    if (this.currentActiveTab) {
      const prevTab = this.tabs.get(this.currentActiveTab);
      if (prevTab) {
        this.applyTabStyles(prevTab, false);
        prevTab.setAttribute('aria-selected', 'false');
      }
    }

    // Update new active tab styling
    const newTab = this.tabs.get(activeTab);
    if (newTab) {
      this.applyTabStyles(newTab, true);
      newTab.setAttribute('aria-selected', 'true');

      // Scroll into view if needed
      newTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    this.currentActiveTab = activeTab;
  }

  /**
   * Update entity counts for all tabs.
   *
   * @param counts - Map of EntityType to count
   */
  updateCounts(counts: Map<EntityType, number>): void {
    for (const [type, count] of counts) {
      const countEl = this.countElements.get(type);
      if (countEl) {
        countEl.textContent = `(${count})`;
      }
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.tabs.clear();
    this.countElements.clear();
    this.container.empty();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a TabNavigation instance.
 *
 * @param container - The container element for tabs
 * @param viewModel - The LibraryViewModel instance
 * @returns TabNavigation instance
 */
export function createTabNavigation(
  container: HTMLElement,
  viewModel: LibraryViewModel
): TabNavigation {
  return new TabNavigation(container, viewModel);
}

/**
 * Get all available tab configurations.
 *
 * Useful for testing or generating tab-related UI elsewhere.
 */
export function getTabConfigs(): readonly TabConfig[] {
  return TAB_CONFIGS;
}

// Export type for external use
export type { TabConfig };
