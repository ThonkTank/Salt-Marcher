/**
 * DetailView
 *
 * Companion view to SessionRunner that displays contextual information
 * in the right sidebar. Currently contains the Encounter Panel.
 *
 * Lifecycle:
 * - Opened by SessionRunner on activation
 * - Closed by SessionRunner on deactivation
 * - Receives context via EventBus (session:context-changed)
 *
 * Future: Multi-tab support for Location, NPC, Treasure panels.
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { EventBus } from '@core/events/event-bus';
import { createEvent } from '@core/events/event-bus';
import { EventTypes } from '@core/events/domain-events';
import { initializeViewContainer } from '@shared/layout';
import { DETAIL_VIEW_TYPE } from './types';
import {
  type PanelContext,
  createDefaultContext,
} from '../session-runner/panels/base-panel';
import { EncounterPanel } from './panels/encounter';

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  container: 'detail-view-container',
  content: 'detail-view-content',
  panelSection: 'detail-view-panel-section',
  header: 'detail-view-header',
} as const;

// ═══════════════════════════════════════════════════════════════
// View Dependencies
// ═══════════════════════════════════════════════════════════════

export interface DetailViewDependencies {
  eventBus: EventBus;
}

// ═══════════════════════════════════════════════════════════════
// DetailView
// ═══════════════════════════════════════════════════════════════

export class DetailView extends ItemView {
  private deps: DetailViewDependencies;
  private panelContext: PanelContext;
  private encounterPanel: EncounterPanel | null = null;
  private panelContainerEl: HTMLElement | null = null;
  private unsubscribeContext: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, deps: DetailViewDependencies) {
    super(leaf);
    this.deps = deps;
    this.panelContext = createDefaultContext();
  }

  // ─────────────────────────────────────────────────────────────
  // ItemView Implementation
  // ─────────────────────────────────────────────────────────────

  getViewType(): string {
    return DETAIL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Details';
  }

  getIcon(): string {
    return 'info';
  }

  async onOpen(): Promise<void> {
    // Initialize container
    const container = initializeViewContainer(this, CSS.container);

    // Create content area
    this.panelContainerEl = container.createDiv({ cls: CSS.content });

    // Setup encounter panel
    this.setupEncounterPanel();

    // Subscribe to context changes from SessionRunner
    this.subscribeToContextChanges();
  }

  async onClose(): Promise<void> {
    // Cleanup subscription
    if (this.unsubscribeContext) {
      this.unsubscribeContext();
      this.unsubscribeContext = null;
    }

    // Cleanup panel
    if (this.encounterPanel) {
      this.encounterPanel.dispose();
      this.encounterPanel = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Panel Setup
  // ─────────────────────────────────────────────────────────────

  private setupEncounterPanel(): void {
    if (!this.panelContainerEl) return;

    // Create panel container with header
    const section = this.panelContainerEl.createDiv({ cls: CSS.panelSection });

    // Panel header
    const header = section.createDiv({ cls: CSS.header });
    header.createSpan({ text: 'Encounter' });

    // Panel content area
    const panelContainer = section.createDiv();

    // Create panel with callbacks wired to EventBus
    this.encounterPanel = new EncounterPanel({
      onResolve: (outcome) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.ENCOUNTER_RESOLVE_REQUESTED,
            { outcome },
            'detail-view'
          )
        );
      },
      onDismiss: () => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.ENCOUNTER_DISMISS_REQUESTED,
            {},
            'detail-view'
          )
        );
      },
    });

    // Render panel
    this.encounterPanel.render(panelContainer);

    // Initial update with default context
    this.encounterPanel.update(this.panelContext);
  }

  // ─────────────────────────────────────────────────────────────
  // EventBus Subscription
  // ─────────────────────────────────────────────────────────────

  private subscribeToContextChanges(): void {
    this.unsubscribeContext = this.deps.eventBus.subscribe(
      EventTypes.SESSION_CONTEXT_CHANGED,
      (event) => {
        // Cast context from generic event payload to PanelContext
        this.panelContext = event.payload.context as PanelContext;
        this.updatePanels();
      }
    );
  }

  private updatePanels(): void {
    if (this.encounterPanel) {
      this.encounterPanel.update(this.panelContext);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// View Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a view factory for Obsidian
 */
export function createDetailViewFactory(deps: DetailViewDependencies) {
  return (leaf: WorkspaceLeaf) => new DetailView(leaf, deps);
}
