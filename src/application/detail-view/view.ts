/**
 * DetailView View.
 *
 * Obsidian ItemView that hosts context-dependent detail panels.
 * Shows Encounter, Combat tabs (MVP), with more tabs to be added later.
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { EventBus } from '@core/index';
import type { EncounterFeaturePort } from '@/features/encounter';
import type { CombatFeaturePort } from '@/features/combat';
import type { ConditionType } from '@core/schemas';
import { EventTypes, createEvent, newCorrelationId } from '@core/events';
import { now } from '@core/types';
import { VIEW_TYPE_DETAIL_VIEW, type TabId } from './types';
import {
  createDetailViewModel,
  type DetailViewModelDeps,
} from './viewmodel';
import {
  createCombatTab,
  createEncounterTab,
  type CombatTab,
  type EncounterTab,
} from './panels';

// ============================================================================
// View Dependencies
// ============================================================================

export interface DetailViewDeps extends DetailViewModelDeps {
  eventBus: EventBus;
  encounterFeature?: EncounterFeaturePort;
  combatFeature?: CombatFeaturePort;
}

// ============================================================================
// View
// ============================================================================

export class DetailView extends ItemView {
  private deps: DetailViewDeps;
  private viewModel: ReturnType<typeof createDetailViewModel> | null = null;
  private unsubscribe: (() => void) | null = null;

  // UI Elements
  private tabNav: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;
  private idleState: HTMLElement | null = null;

  // Panels
  private encounterTabPanel: EncounterTab | null = null;
  private combatTabPanel: CombatTab | null = null;

  constructor(leaf: WorkspaceLeaf, deps: DetailViewDeps) {
    super(leaf);
    this.deps = deps;
  }

  getViewType(): string {
    return VIEW_TYPE_DETAIL_VIEW;
  }

  getDisplayText(): string {
    return 'Detail View';
  }

  getIcon(): string {
    return 'info';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    // Container setup
    contentEl.addClass('salt-marcher-detail-view');
    contentEl.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--background-primary);
    `;

    // Create ViewModel
    this.viewModel = createDetailViewModel({
      eventBus: this.deps.eventBus,
      encounterFeature: this.deps.encounterFeature,
      combatFeature: this.deps.combatFeature,
    });

    // Create tab navigation
    this.tabNav = contentEl.createDiv('detail-view-tab-nav');
    this.tabNav.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
      background: var(--background-secondary);
    `;
    this.createTabButtons();

    // Create content container
    this.contentContainer = contentEl.createDiv('detail-view-content');
    this.contentContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    `;

    // Create idle state element
    this.idleState = this.contentContainer.createDiv('detail-view-idle');
    this.idleState.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
    `;
    this.idleState.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 12px;">📋</div>
      <div style="margin-bottom: 8px;">Kein aktiver Kontext</div>
      <div style="font-size: 12px;">Klicke auf einen Tab oder generiere einen Encounter im SessionRunner.</div>
    `;

    // Create tab panels
    this.encounterTabPanel = createEncounterTab(
      this.contentContainer,
      this.createEncounterCallbacks()
    );

    this.combatTabPanel = createCombatTab(
      this.contentContainer,
      this.createCombatCallbacks()
    );

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.encounterTabPanel?.dispose();
    this.combatTabPanel?.dispose();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.viewModel = null;
    this.tabNav = null;
    this.contentContainer = null;
    this.idleState = null;
    this.encounterTabPanel = null;
    this.combatTabPanel = null;
  }

  // =========================================================================
  // Tab Navigation
  // =========================================================================

  private createTabButtons(): void {
    if (!this.tabNav) return;

    const tabs: { id: TabId; label: string; icon: string }[] = [
      { id: 'encounter', label: 'Encounter', icon: '⚔️' },
      { id: 'combat', label: 'Combat', icon: '🗡️' },
    ];

    for (const tab of tabs) {
      const btn = this.tabNav.createEl('button', {
        text: `${tab.icon} ${tab.label}`,
        attr: { 'data-tab': tab.id },
      });
      btn.style.cssText = `
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        cursor: pointer;
        font-size: 12px;
      `;
      btn.addEventListener('click', () => {
        this.viewModel?.setActiveTab(tab.id);
      });
    }
  }

  private updateTabButtons(activeTab: TabId | null): void {
    if (!this.tabNav) return;

    const buttons = this.tabNav.querySelectorAll('button');
    buttons.forEach((btn) => {
      const tabId = btn.getAttribute('data-tab');
      const isActive = tabId === activeTab;
      btn.style.background = isActive
        ? 'var(--interactive-accent)'
        : 'var(--background-primary)';
      btn.style.color = isActive
        ? 'var(--text-on-accent)'
        : 'var(--text-normal)';
    });
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  private render(state: ReturnType<typeof createDetailViewModel>['getState'] extends () => infer R ? R : never): void {
    // Update tab buttons
    this.updateTabButtons(state.activeTab);

    // Show/hide idle state
    if (this.idleState) {
      this.idleState.style.display = state.activeTab === null ? 'block' : 'none';
    }

    // Update panels
    this.encounterTabPanel?.update(state);
    this.combatTabPanel?.update(state);
  }

  // =========================================================================
  // Callbacks
  // =========================================================================

  private eventOptions() {
    return {
      correlationId: newCorrelationId(),
      timestamp: now(),
      source: 'detail-view',
    };
  }

  private createEncounterCallbacks() {
    return {
      onStartEncounter: (encounterId: string) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.ENCOUNTER_START_REQUESTED,
            { encounterId },
            this.eventOptions()
          )
        );
      },
      onDismissEncounter: (encounterId: string) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.ENCOUNTER_DISMISS_REQUESTED,
            { encounterId, reason: 'user-dismissed' },
            this.eventOptions()
          )
        );
      },
      onRegenerateEncounter: () => {
        // Get current party position from encounter if available
        const state = this.viewModel?.getState();
        const position = state?.encounter.currentEncounter?.position;

        if (position) {
          this.deps.eventBus.publish(
            createEvent(
              EventTypes.ENCOUNTER_GENERATE_REQUESTED,
              { position, trigger: 'manual' as const },
              this.eventOptions()
            )
          );
        }
      },
    };
  }

  private createCombatCallbacks() {
    return {
      onNextTurn: () => {
        this.deps.eventBus.publish(
          createEvent(EventTypes.COMBAT_NEXT_TURN_REQUESTED, {}, this.eventOptions())
        );
      },
      onEndCombat: () => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_END_REQUESTED,
            {},
            this.eventOptions()
          )
        );
      },
      onApplyDamage: (participantId: string, amount: number) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_APPLY_DAMAGE_REQUESTED,
            { participantId, amount },
            this.eventOptions()
          )
        );
      },
      onApplyHealing: (participantId: string, amount: number) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_APPLY_HEALING_REQUESTED,
            { participantId, amount },
            this.eventOptions()
          )
        );
      },
      onAddCondition: (participantId: string, conditionType: ConditionType) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_ADD_CONDITION_REQUESTED,
            { participantId, condition: { type: conditionType, reminder: '' } },
            this.eventOptions()
          )
        );
      },
      onRemoveCondition: (participantId: string, conditionType: ConditionType) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_REMOVE_CONDITION_REQUESTED,
            { participantId, conditionType },
            this.eventOptions()
          )
        );
      },
      onUpdateInitiative: (participantId: string, initiative: number) => {
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.COMBAT_UPDATE_INITIATIVE_REQUESTED,
            { participantId, initiative },
            this.eventOptions()
          )
        );
      },
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Factory function for view registration.
 */
export function createDetailViewFactory(deps: DetailViewDeps) {
  return (leaf: WorkspaceLeaf) => new DetailView(leaf, deps);
}
