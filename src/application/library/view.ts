/**
 * Library View.
 *
 * Obsidian ItemView that hosts the Library panels.
 * Layout: Tab Navigation (top) + Content Area (center)
 *
 * The Library is the central CRUD interface for all entity types.
 *
 * @see docs/application/Library.md
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LIBRARY } from './types';
import type { LibraryRenderHint, LibraryState } from './types';
import {
  createLibraryViewModel,
  type LibraryViewModelDeps,
  type LibraryViewModel,
} from './viewmodel';

// ============================================================================
// View Dependencies
// ============================================================================

/**
 * Dependencies for LibraryView.
 *
 * Extends LibraryViewModelDeps with any additional view-specific dependencies.
 * For MVP, this is identical to ViewModelDeps.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Intentionally empty for future extensibility
export interface LibraryViewDeps extends LibraryViewModelDeps {
  // Future: Additional dependencies for panels (e.g., NotificationService)
}

// ============================================================================
// View
// ============================================================================

export class LibraryView extends ItemView {
  private deps: LibraryViewDeps;
  private viewModel: LibraryViewModel | null = null;
  private unsubscribe: (() => void) | null = null;

  // Containers for future panels
  private tabContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, deps: LibraryViewDeps) {
    super(leaf);
    this.deps = deps;
  }

  getViewType(): string {
    return VIEW_TYPE_LIBRARY;
  }

  getDisplayText(): string {
    return 'Library';
  }

  getIcon(): string {
    return 'book-open';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('salt-marcher-library-view');

    // Flex Layout: Tab Navigation + Content
    contentEl.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--background-primary);
    `;

    // Create ViewModel
    this.viewModel = createLibraryViewModel({
      entityRegistry: this.deps.entityRegistry,
      eventBus: this.deps.eventBus,
    });

    // === Tab Navigation ===
    this.tabContainer = contentEl.createDiv('library-tab-nav');
    this.tabContainer.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: var(--background-secondary);
      border-bottom: 1px solid var(--background-modifier-border);
      overflow-x: auto;
      flex-shrink: 0;
    `;

    // === Content Area ===
    this.contentContainer = contentEl.createDiv('library-content');
    this.contentContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 12px;
    `;

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state, hints) => {
      this.render(state, hints);
    });

    // Initialize ViewModel
    this.viewModel.initialize();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.viewModel = null;
    this.tabContainer = null;
    this.contentContainer = null;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Render the view based on state and hints.
   *
   * This is a placeholder implementation for MVP.
   * Full rendering will be implemented in subsequent tasks.
   */
  private render(state: Readonly<LibraryState>, hints: LibraryRenderHint[]): void {
    // Render tab navigation
    if (hints.includes('full') || hints.includes('tabs')) {
      this.renderTabs(state);
    }

    // Render content area
    if (hints.includes('full') || hints.includes('list') || hints.includes('loading')) {
      this.renderContent(state);
    }
  }

  /**
   * Render tab navigation (placeholder).
   */
  private renderTabs(state: Readonly<LibraryState>): void {
    if (!this.tabContainer) return;

    this.tabContainer.empty();

    // Placeholder tabs - will be replaced by Tab-Navigation Component (Task #2600)
    const tabs: Array<{ id: string; label: string }> = [
      { id: 'creature', label: 'Creatures' },
      { id: 'character', label: 'Characters' },
      { id: 'item', label: 'Items' },
      { id: 'poi', label: 'Locations' },
      { id: 'faction', label: 'Factions' },
    ];

    for (const tab of tabs) {
      const tabEl = this.tabContainer.createEl('button', {
        text: tab.label,
        cls: 'library-tab',
      });

      tabEl.style.cssText = `
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: ${state.activeTab === tab.id ? 'var(--interactive-accent)' : 'var(--background-primary)'};
        color: ${state.activeTab === tab.id ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        font-size: 13px;
        white-space: nowrap;
      `;

      tabEl.addEventListener('click', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.viewModel?.setActiveTab(tab.id as any);
      });
    }
  }

  /**
   * Render content area (placeholder).
   */
  private renderContent(state: Readonly<LibraryState>): void {
    if (!this.contentContainer) return;

    this.contentContainer.empty();

    // Loading state
    if (state.isLoading) {
      const loadingEl = this.contentContainer.createDiv('library-loading');
      loadingEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
      `;
      loadingEl.textContent = 'Loading...';
      return;
    }

    // Error state
    if (state.error) {
      const errorEl = this.contentContainer.createDiv('library-error');
      errorEl.style.cssText = `
        padding: 12px;
        background: var(--background-modifier-error);
        border-radius: 4px;
        color: var(--text-error);
      `;
      errorEl.textContent = state.error;
      return;
    }

    // Empty state
    if (state.entities.length === 0) {
      const emptyEl = this.contentContainer.createDiv('library-empty');
      emptyEl.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        gap: 8px;
      `;
      emptyEl.createEl('div', { text: 'No entities found' });
      emptyEl.createEl('div', {
        text: `Active tab: ${state.activeTab}`,
        cls: 'library-empty-hint',
      }).style.fontSize = '12px';
      return;
    }

    // Entity list (placeholder - will be replaced by Browse-View Component Task #2603)
    const listEl = this.contentContainer.createDiv('library-list');
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Header with count
    const headerEl = listEl.createDiv('library-list-header');
    headerEl.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
      margin-bottom: 8px;
    `;
    headerEl.createEl('span', {
      text: `${state.totalCount} ${state.activeTab}(s)`,
    });

    // Simple entity cards
    for (const entity of state.entities) {
      const record = entity as Record<string, unknown>;
      const cardEl = listEl.createDiv('library-card');
      cardEl.style.cssText = `
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid var(--background-modifier-border);
      `;

      cardEl.createEl('div', {
        text: (record.name as string) || (record.id as string) || 'Unnamed',
        cls: 'library-card-name',
      }).style.fontWeight = '500';

      if (record.id) {
        cardEl.createEl('div', {
          text: `ID: ${record.id}`,
          cls: 'library-card-id',
        }).style.cssText = 'font-size: 11px; color: var(--text-muted);';
      }

      // Click to select
      cardEl.addEventListener('click', () => {
        this.viewModel?.selectEntity(record.id as string);
      });

      // Double-click to edit
      cardEl.addEventListener('dblclick', () => {
        this.viewModel?.openEditModal(record.id as string);
      });
    }

    // Pagination info
    if (state.totalCount > state.pageSize) {
      const paginationEl = listEl.createDiv('library-pagination');
      paginationEl.style.cssText = `
        display: flex;
        justify-content: center;
        padding-top: 12px;
        color: var(--text-muted);
        font-size: 12px;
      `;
      const showing = Math.min((state.page + 1) * state.pageSize, state.totalCount);
      paginationEl.textContent = `Showing ${showing} of ${state.totalCount}`;
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Factory function for LibraryView registration.
 *
 * @param deps - Dependencies for the view
 * @returns Factory function for Obsidian's registerView
 *
 * @example
 * ```typescript
 * this.registerView(
 *   VIEW_TYPE_LIBRARY,
 *   createLibraryViewFactory({
 *     entityRegistry,
 *     eventBus,
 *   })
 * );
 * ```
 */
export function createLibraryViewFactory(deps: LibraryViewDeps) {
  return (leaf: WorkspaceLeaf) => new LibraryView(leaf, deps);
}
