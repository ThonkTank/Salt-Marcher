/**
 * Browse View Component for Library.
 *
 * Renders the entity list with pagination support.
 * This is the main content area of the Library view.
 *
 * @see docs/application/Library.md#browse-view
 */

import type { EntityType } from '@core/types/common';
import type { LibraryViewModel } from './viewmodel';
import type { LibraryState, LibraryRenderHint } from './types';

// ============================================================================
// Tab Icon Configuration
// ============================================================================

/**
 * Icon mapping for entity types.
 * Used for displaying entity type icons in cards.
 */
const ENTITY_ICONS: Record<EntityType, string> = {
  creature: '\u{1F43A}',      // Wolf
  character: '\u{1F464}',     // Bust in Silhouette
  npc: '\u{1F3AD}',           // Performing Arts
  faction: '\u{1F3F4}',       // Black Flag
  item: '\u{1F5E1}',          // Dagger
  map: '\u{1F5FA}',           // World Map
  poi: '\u{1F4CD}',           // Round Pushpin
  maplink: '\u{1F517}',       // Link
  terrain: '\u{1F332}',       // Evergreen Tree
  quest: '\u{1F4DC}',         // Scroll
  encounter: '\u2694\uFE0F',  // Crossed Swords
  shop: '\u{1F3EA}',          // Convenience Store
  party: '\u{1F465}',         // Busts in Silhouette
  calendar: '\u{1F4C5}',      // Calendar
  journal: '\u{1F4D6}',       // Open Book
  feature: '\u26A0\uFE0F',    // Warning Sign (hazards/features)
  worldevent: '\u{1F30D}',    // Earth Globe
  track: '\u{1F3B5}',         // Musical Note
};

// ============================================================================
// Browse View Component
// ============================================================================

/**
 * Browse View for the Library.
 *
 * Renders the entity list with:
 * - Loading state
 * - Error state
 * - Empty state
 * - Entity cards with click/double-click handlers
 * - Pagination (Load More button, count display)
 *
 * @example
 * ```typescript
 * const browseView = createBrowseView(container, viewModel);
 *
 * // Render when state changes
 * viewModel.subscribe((state, hints) => {
 *   if (hints.includes('list') || hints.includes('loading')) {
 *     browseView.render(state);
 *   }
 * });
 *
 * // Later:
 * browseView.dispose();
 * ```
 */
export class BrowseView {
  private readonly container: HTMLElement;
  private readonly viewModel: LibraryViewModel;

  // Child elements
  private listContainer: HTMLElement | null = null;
  private paginationContainer: HTMLElement | null = null;

  constructor(container: HTMLElement, viewModel: LibraryViewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.createStructure();
  }

  /**
   * Create the base DOM structure.
   */
  private createStructure(): void {
    this.container.empty();
    this.container.addClass('library-browse-view');

    // List container (scrollable)
    this.listContainer = this.container.createDiv('library-entity-list');
    this.listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      overflow-y: auto;
    `;

    // Pagination container (fixed at bottom)
    this.paginationContainer = this.container.createDiv('library-pagination');
    this.paginationContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--background-modifier-border);
      margin-top: 12px;
    `;
  }

  /**
   * Render the browse view based on current state.
   *
   * @param state - The current LibraryState
   * @param hints - Optional render hints for optimization
   */
  render(state: Readonly<LibraryState>, hints?: LibraryRenderHint[]): void {
    // Check if we need to render
    const shouldRenderList = !hints || hints.includes('full') || hints.includes('list') || hints.includes('loading');
    if (!shouldRenderList) return;

    if (!this.listContainer || !this.paginationContainer) return;

    // Clear list container
    this.listContainer.empty();

    // Loading state
    if (state.isLoading) {
      this.renderLoading();
      this.paginationContainer.empty();
      return;
    }

    // Error state
    if (state.error) {
      this.renderError(state.error);
      this.paginationContainer.empty();
      return;
    }

    // Empty state
    if (state.entities.length === 0) {
      this.renderEmpty(state.activeTab);
      this.paginationContainer.empty();
      return;
    }

    // Render entity list
    this.renderEntityList(state);

    // Render pagination
    this.renderPagination(state);
  }

  /**
   * Render loading state.
   */
  private renderLoading(): void {
    if (!this.listContainer) return;

    const loadingEl = this.listContainer.createDiv('library-loading');
    loadingEl.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-muted);
    `;
    loadingEl.textContent = 'Loading...';
  }

  /**
   * Render error state.
   */
  private renderError(error: string): void {
    if (!this.listContainer) return;

    const errorEl = this.listContainer.createDiv('library-error');
    errorEl.style.cssText = `
      padding: 16px;
      background: var(--background-modifier-error);
      border-radius: 6px;
      color: var(--text-error);
    `;
    errorEl.textContent = error;
  }

  /**
   * Render empty state.
   */
  private renderEmpty(activeTab: EntityType): void {
    if (!this.listContainer) return;

    const emptyEl = this.listContainer.createDiv('library-empty');
    emptyEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-muted);
      gap: 8px;
    `;

    emptyEl.createEl('div', {
      text: ENTITY_ICONS[activeTab] || '\u{1F4C1}',
      cls: 'library-empty-icon',
    }).style.fontSize = '48px';

    emptyEl.createEl('div', {
      text: `No ${activeTab}s found`,
      cls: 'library-empty-text',
    }).style.fontSize = '16px';

    emptyEl.createEl('div', {
      text: 'Try adjusting your filters or create a new one.',
      cls: 'library-empty-hint',
    }).style.fontSize = '12px';
  }

  /**
   * Render the entity list.
   */
  private renderEntityList(state: Readonly<LibraryState>): void {
    if (!this.listContainer) return;

    // Header with count
    const headerEl = this.listContainer.createDiv('library-list-header');
    headerEl.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    headerEl.createEl('span', {
      text: `${state.totalCount} ${state.activeTab}${state.totalCount !== 1 ? 's' : ''}`,
      cls: 'library-list-count',
    }).style.color = 'var(--text-muted)';

    // Entity cards
    for (const entity of state.entities) {
      this.renderEntityCard(entity, state.activeTab, state.selectedEntityId);
    }
  }

  /**
   * Render a single entity card.
   */
  private renderEntityCard(
    entity: unknown,
    entityType: EntityType,
    selectedId: string | null
  ): void {
    if (!this.listContainer) return;

    const record = entity as Record<string, unknown>;
    const id = record.id as string;
    const name = (record.name as string) || id || 'Unnamed';
    const isSelected = id === selectedId;

    const cardEl = this.listContainer.createDiv('library-card');
    cardEl.dataset.entityId = id;

    // Card styling
    cardEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: ${isSelected ? 'var(--interactive-accent)' : 'var(--background-secondary)'};
      color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid ${isSelected ? 'var(--interactive-accent)' : 'var(--background-modifier-border)'};
      transition: background 0.15s ease, border-color 0.15s ease;
    `;

    // Hover effect
    if (!isSelected) {
      cardEl.addEventListener('mouseenter', () => {
        cardEl.style.background = 'var(--background-modifier-hover)';
        cardEl.style.borderColor = 'var(--background-modifier-border-hover)';
      });
      cardEl.addEventListener('mouseleave', () => {
        cardEl.style.background = 'var(--background-secondary)';
        cardEl.style.borderColor = 'var(--background-modifier-border)';
      });
    }

    // Icon
    const iconEl = cardEl.createDiv('library-card-icon');
    iconEl.textContent = ENTITY_ICONS[entityType] || '\u{1F4C4}';
    iconEl.style.cssText = `
      font-size: 24px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    // Content
    const contentEl = cardEl.createDiv('library-card-content');
    contentEl.style.cssText = `
      flex: 1;
      min-width: 0;
      overflow: hidden;
    `;

    // Name
    const nameEl = contentEl.createDiv('library-card-name');
    nameEl.textContent = name;
    nameEl.style.cssText = `
      font-weight: 500;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // ID / Subtitle
    const subtitleEl = contentEl.createDiv('library-card-subtitle');
    subtitleEl.textContent = `ID: ${id}`;
    subtitleEl.style.cssText = `
      font-size: 11px;
      color: ${isSelected ? 'var(--text-on-accent-muted, var(--text-on-accent))' : 'var(--text-muted)'};
      opacity: 0.8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // Click to select
    cardEl.addEventListener('click', () => {
      this.viewModel.selectEntity(id);
    });

    // Double-click to edit
    cardEl.addEventListener('dblclick', () => {
      this.viewModel.openEditModal(id);
    });
  }

  /**
   * Render pagination controls.
   */
  private renderPagination(state: Readonly<LibraryState>): void {
    if (!this.paginationContainer) return;

    this.paginationContainer.empty();

    const { entities, totalCount } = state;
    const showingCount = entities.length;
    const hasMore = showingCount < totalCount;

    // Count display
    const countEl = this.paginationContainer.createDiv('library-pagination-count');
    countEl.textContent = `Showing ${showingCount} of ${totalCount}`;
    countEl.style.cssText = `
      font-size: 12px;
      color: var(--text-muted);
    `;

    // Load More button (only if there are more items)
    if (hasMore) {
      const loadMoreBtn = this.paginationContainer.createEl('button', {
        text: 'Load More',
        cls: 'library-load-more-btn',
      });
      loadMoreBtn.style.cssText = `
        padding: 8px 16px;
        background: var(--interactive-normal);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-normal);
        font-size: 13px;
        transition: background 0.15s ease;
      `;

      loadMoreBtn.addEventListener('mouseenter', () => {
        loadMoreBtn.style.background = 'var(--interactive-hover)';
      });
      loadMoreBtn.addEventListener('mouseleave', () => {
        loadMoreBtn.style.background = 'var(--interactive-normal)';
      });

      loadMoreBtn.addEventListener('click', () => {
        this.viewModel.loadMore();
      });
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.listContainer = null;
    this.paginationContainer = null;
    this.container.empty();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a BrowseView instance.
 *
 * @param container - The container element for the browse view
 * @param viewModel - The LibraryViewModel instance
 * @returns BrowseView instance
 */
export function createBrowseView(
  container: HTMLElement,
  viewModel: LibraryViewModel
): BrowseView {
  return new BrowseView(container, viewModel);
}
