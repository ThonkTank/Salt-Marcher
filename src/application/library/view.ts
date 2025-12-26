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
import { createTabNavigation, type TabNavigation } from './TabNavigation';
import { createBrowseView, type BrowseView } from './BrowseView';
import { EntityModal, openEntityModal } from './EntityModal';

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

  // Tab Navigation
  private tabNavigation: TabNavigation | null = null;

  // Browse View
  private browseView: BrowseView | null = null;

  // Modal
  private currentModal: EntityModal | null = null;

  // Containers for panels
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

    // Create TabNavigation component
    this.tabNavigation = createTabNavigation(this.tabContainer, this.viewModel);

    // === Content Area ===
    this.contentContainer = contentEl.createDiv('library-content');
    this.contentContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
    `;

    // Create BrowseView component
    this.browseView = createBrowseView(this.contentContainer, this.viewModel);

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state, hints) => {
      this.render(state, hints);
    });

    // Initialize ViewModel
    this.viewModel.initialize();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.tabNavigation?.dispose();
    this.browseView?.dispose();
    this.currentModal?.close();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.tabNavigation = null;
    this.browseView = null;
    this.currentModal = null;
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
   * Delegates rendering to TabNavigation and BrowseView components.
   */
  private render(state: Readonly<LibraryState>, hints: LibraryRenderHint[]): void {
    // Render tab navigation
    if (hints.includes('full') || hints.includes('tabs')) {
      this.renderTabs(state);
    }

    // Render content area (BrowseView handles hint filtering internally)
    if (hints.includes('full') || hints.includes('list') || hints.includes('loading') || hints.includes('selection')) {
      this.renderContent(state, hints);
    }

    // Render modal
    if (hints.includes('full') || hints.includes('modal')) {
      this.renderModal(state);
    }
  }

  /**
   * Render tab navigation using TabNavigation component.
   */
  private renderTabs(state: Readonly<LibraryState>): void {
    this.tabNavigation?.render(state.activeTab);

    // Update entity counts for all tabs
    const counts = this.viewModel?.getTabCounts();
    if (counts) {
      this.tabNavigation?.updateCounts(counts);
    }
  }

  /**
   * Render content area using BrowseView component.
   *
   * @see Task #2603 - Browse-View Component
   */
  private renderContent(state: Readonly<LibraryState>, hints?: LibraryRenderHint[]): void {
    this.browseView?.render(state, hints);
  }

  /**
   * Render modal based on state.
   *
   * Opens/closes the EntityModal when state.modal.open changes.
   *
   * @see Task #2613 - Create/Edit Modal Component
   * @see Task #2614 - Modal Tab-Navigation
   */
  private renderModal(state: Readonly<LibraryState>): void {
    const { modal } = state;

    if (modal.open && !this.currentModal) {
      // Open modal with tab navigation support
      this.currentModal = openEntityModal(this.app, {
        mode: modal.mode,
        entityType: state.activeTab,
        entityId: modal.entityId,
        currentSection: modal.currentSection,
        onCancel: () => {
          this.viewModel?.closeModal();
        },
        onSectionChange: (sectionId: string) => {
          this.viewModel?.setModalSection(sectionId);
        },
      });
    } else if (!modal.open && this.currentModal) {
      // Close modal
      this.currentModal.close();
      this.currentModal = null;
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
