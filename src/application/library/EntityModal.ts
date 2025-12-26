/**
 * Entity Modal Component.
 *
 * Generic modal for creating and editing entities in the Library.
 * Includes tab navigation for entity-specific sections.
 *
 * @see docs/application/Library.md#create-edit-modal
 * @see Task #2613, #2614
 */

import { App, Modal } from 'obsidian';
import type { EntityType } from '@core/types/common';
import type { ModalMode, ModalSectionConfig } from './types';
import { getEntitySections } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating an EntityModal.
 */
export interface EntityModalOptions {
  /** Create or edit mode */
  mode: ModalMode;

  /** Type of entity being created/edited */
  entityType: EntityType;

  /** Entity ID for edit mode (null for create) */
  entityId: string | null;

  /** Initial section to display */
  currentSection?: string;

  /** Callback when modal is cancelled */
  onCancel: () => void;

  /** Callback when section changes */
  onSectionChange?: (sectionId: string) => void;
}

/**
 * Display names for entity types.
 */
const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  creature: 'Creature',
  character: 'Character',
  npc: 'NPC',
  faction: 'Faction',
  item: 'Item',
  map: 'Map',
  poi: 'POI',
  maplink: 'Map Link',
  terrain: 'Terrain',
  quest: 'Quest',
  encounter: 'Encounter',
  shop: 'Shop',
  party: 'Party',
  calendar: 'Calendar',
  journal: 'Journal',
  worldevent: 'World Event',
  feature: 'Feature',
  track: 'Track',
};

// ============================================================================
// Modal Component
// ============================================================================

/**
 * Generic modal for entity creation and editing.
 *
 * Follows the Obsidian Modal pattern (like CharacterSelectionDialog).
 * Includes tab navigation for entity-specific sections.
 */
export class EntityModal extends Modal {
  private options: EntityModalOptions;
  private contentArea: HTMLElement | null = null;
  private tabContainer: HTMLElement | null = null;
  private sections: ModalSectionConfig[];
  private currentSection: string;

  constructor(app: App, options: EntityModalOptions) {
    super(app);
    this.options = options;
    this.sections = getEntitySections(options.entityType);
    this.currentSection = options.currentSection ?? this.sections[0]?.id ?? 'basic';
  }

  /**
   * Get the display title based on mode and entity type.
   */
  private getTitle(): string {
    const action = this.options.mode === 'create' ? 'Create' : 'Edit';
    const entityLabel = ENTITY_TYPE_LABELS[this.options.entityType] ?? this.options.entityType;
    return `${action} ${entityLabel}`;
  }

  /**
   * Called when modal is opened.
   */
  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
    contentEl.addClass('salt-marcher-entity-modal');

    // Set modal title
    titleEl.setText(this.getTitle());

    // Modal content container
    this.contentArea = contentEl.createDiv('entity-modal-content');
    this.contentArea.style.cssText = `
      min-width: 400px;
      max-width: 600px;
      padding: 16px;
    `;

    // Tab navigation (Task #2614)
    this.renderTabNavigation();

    // Placeholder content (will be replaced by #2616)
    this.renderPlaceholderContent();

    // Footer with actions
    this.renderFooter(contentEl);
  }

  /**
   * Render the tab navigation for sections.
   * @see Library.md#modal-navigation
   */
  private renderTabNavigation(): void {
    if (!this.contentArea) return;

    // Only render tabs if there's more than one section
    if (this.sections.length <= 1) return;

    this.tabContainer = this.contentArea.createDiv('entity-modal-tabs');
    this.tabContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: 8px;
    `;

    for (const section of this.sections) {
      const isActive = section.id === this.currentSection;

      const tab = this.tabContainer.createEl('button', {
        text: section.label,
        cls: `entity-modal-tab ${isActive ? 'is-active' : ''}`,
      });

      tab.dataset.sectionId = section.id;
      tab.style.cssText = `
        padding: 8px 16px;
        border: none;
        border-radius: 4px 4px 0 0;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s ease, color 0.15s ease;
        background: ${isActive ? 'var(--interactive-accent)' : 'transparent'};
        color: ${isActive ? 'var(--text-on-accent)' : 'var(--text-muted)'};
        font-weight: ${isActive ? '500' : 'normal'};
      `;

      // Hover effect for inactive tabs
      if (!isActive) {
        tab.addEventListener('mouseenter', () => {
          tab.style.background = 'var(--background-modifier-hover)';
          tab.style.color = 'var(--text-normal)';
        });
        tab.addEventListener('mouseleave', () => {
          tab.style.background = 'transparent';
          tab.style.color = 'var(--text-muted)';
        });
      }

      // Click handler
      tab.addEventListener('click', () => this.handleTabClick(section.id));
    }
  }

  /**
   * Handle tab click - switch to a different section.
   */
  private handleTabClick(sectionId: string): void {
    if (sectionId === this.currentSection) return;

    this.currentSection = sectionId;

    // Notify callback
    if (this.options.onSectionChange) {
      this.options.onSectionChange(sectionId);
    }

    // Re-render tabs and content
    this.refreshContent();
  }

  /**
   * Refresh the modal content (tabs and placeholder).
   */
  private refreshContent(): void {
    if (!this.contentArea) return;

    // Clear and re-render
    this.contentArea.empty();
    this.renderTabNavigation();
    this.renderPlaceholderContent();
  }

  /**
   * Render placeholder content for the current section.
   * Will be replaced by form generation in Task #2616.
   */
  private renderPlaceholderContent(): void {
    if (!this.contentArea) return;

    // Find current section config
    const sectionConfig = this.sections.find(s => s.id === this.currentSection);
    const sectionLabel = sectionConfig?.label ?? this.currentSection;

    const placeholder = this.contentArea.createDiv('entity-modal-placeholder');
    placeholder.style.cssText = `
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      border: 1px dashed var(--background-modifier-border);
      border-radius: 4px;
      margin-bottom: 16px;
    `;

    const icon = placeholder.createDiv();
    icon.style.cssText = `
      font-size: 32px;
      margin-bottom: 8px;
    `;
    icon.setText(this.options.mode === 'create' ? '➕' : '✏️');

    const message = placeholder.createDiv();
    message.style.cssText = `
      font-size: 14px;
    `;

    const entityLabel = ENTITY_TYPE_LABELS[this.options.entityType] ?? this.options.entityType;

    if (this.options.mode === 'create') {
      message.setText(`${sectionLabel} fields for new ${entityLabel} will appear here.`);
    } else {
      message.setText(`Editing ${entityLabel}: ${this.options.entityId ?? 'unknown'} - ${sectionLabel}`);
    }

    // Info about follow-up tasks
    const info = this.contentArea.createDiv('entity-modal-info');
    info.style.cssText = `
      font-size: 12px;
      color: var(--text-faint);
      margin-top: 8px;
    `;
    info.setText('Form generation, validation, and save actions coming in Tasks #2616-#2618.');
  }

  /**
   * Render modal footer with action buttons.
   */
  private renderFooter(container: HTMLElement): void {
    const footer = container.createDiv('entity-modal-footer');
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--background-modifier-border);
    `;

    // Cancel button
    const cancelButton = footer.createEl('button', {
      text: 'Cancel',
      cls: 'mod-secondary',
    });
    cancelButton.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
    `;
    cancelButton.addEventListener('click', () => {
      this.options.onCancel();
      this.close();
    });

    // Save button placeholder (Task #2618)
    const saveButton = footer.createEl('button', {
      text: 'Save',
      cls: 'mod-cta',
    });
    saveButton.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      opacity: 0.5;
    `;
    saveButton.disabled = true;
    saveButton.title = 'Save functionality coming in Task #2618';
  }

  /**
   * Called when modal is closed.
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.contentArea = null;
    this.tabContainer = null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and open an EntityModal.
 *
 * @param app - Obsidian App instance
 * @param options - Modal options
 * @returns The created modal instance
 *
 * @example
 * ```typescript
 * const modal = openEntityModal(app, {
 *   mode: 'create',
 *   entityType: 'creature',
 *   entityId: null,
 *   onCancel: () => viewModel.closeModal(),
 * });
 * ```
 */
export function openEntityModal(app: App, options: EntityModalOptions): EntityModal {
  const modal = new EntityModal(app, options);
  modal.open();
  return modal;
}
