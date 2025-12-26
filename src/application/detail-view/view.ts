/**
 * DetailView View.
 *
 * Obsidian ItemView that hosts context-dependent detail panels.
 * Shows Encounter, Combat tabs (MVP), with more tabs to be added later.
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { EventBus, CharacterId } from '@core/index';
import type { EntityRegistryPort } from '@core/types/entity-registry.port';
import type { CombatFeaturePort } from '@/features/combat';
import type { PartyFeaturePort } from '@/features/party';
import type { ConditionType, Character } from '@core/schemas';
import { EventTypes, createEvent, newCorrelationId } from '@core/events';
import { now, isSome } from '@core/types';
import { VIEW_TYPE_DETAIL_VIEW, type TabId } from './types';
import {
  createDetailViewModel,
  type DetailViewModelDeps,
} from './viewmodel';
import {
  createCombatTab,
  createPartyTab,
  type CombatTab,
  type PartyTab,
} from './panels';
import { showCharacterSelectionDialog } from '@shared/dialogs';

// ============================================================================
// View Dependencies
// ============================================================================

export interface DetailViewDeps extends DetailViewModelDeps {
  eventBus: EventBus;
  combatFeature?: CombatFeaturePort;
  partyFeature?: PartyFeaturePort;
  entityRegistry?: EntityRegistryPort;
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
  private combatTabPanel: CombatTab | null = null;
  private partyTabPanel: PartyTab | null = null;

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
      combatFeature: this.deps.combatFeature,
      partyFeature: this.deps.partyFeature,
      entityRegistry: this.deps.entityRegistry,
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
      <div style="font-size: 12px;">Klicke auf einen Tab.</div>
    `;

    // Create tab panels
    this.combatTabPanel = createCombatTab(
      this.contentContainer,
      this.createCombatCallbacks()
    );

    this.partyTabPanel = createPartyTab(
      this.contentContainer,
      this.createPartyCallbacks()
    );

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.combatTabPanel?.dispose();
    this.partyTabPanel?.dispose();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.viewModel = null;
    this.tabNav = null;
    this.contentContainer = null;
    this.idleState = null;
    this.combatTabPanel = null;
    this.partyTabPanel = null;
  }

  /**
   * Handle state changes from setViewState().
   * Allows external code to open a specific tab via workspace.setViewState().
   */
  async setState(state: { activeTab?: TabId }): Promise<void> {
    if (state.activeTab && this.viewModel) {
      this.viewModel.setActiveTab(state.activeTab);
    }
  }

  // =========================================================================
  // Tab Navigation
  // =========================================================================

  private createTabButtons(): void {
    if (!this.tabNav) return;

    const tabs: { id: TabId; label: string; icon: string }[] = [
      { id: 'combat', label: 'Combat', icon: '🗡️' },
      { id: 'party', label: 'Party', icon: '👥' },
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
    this.combatTabPanel?.update(state);
    this.partyTabPanel?.update(state);
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

  private createPartyCallbacks() {
    return {
      onHpChange: (characterId: string, delta: number) => {
        // #3219 - HP-Eingabe Pattern
        const state = this.viewModel?.getState();
        const member = state?.party.members.find((m) => m.id === characterId);

        if (!member) {
          console.warn(`[DetailView] Character ${characterId} not found in party members`);
          return;
        }

        const previousHp = member.currentHp;
        const newHp = Math.max(0, Math.min(member.maxHp, previousHp + delta));

        // Publish CHARACTER_HP_CHANGED event
        this.deps.eventBus.publish(
          createEvent(
            EventTypes.CHARACTER_HP_CHANGED,
            {
              characterId: characterId as CharacterId,
              previousHp,
              currentHp: newHp,
              reason: delta > 0 ? 'heal' : 'damage',
            },
            this.eventOptions()
          )
        );
      },
      onRemoveMember: async (characterId: string) => {
        if (!this.deps.partyFeature) {
          console.warn('[DetailView] partyFeature not available');
          return;
        }
        const result = await this.deps.partyFeature.removeMember(characterId as CharacterId);
        if (!result.ok) {
          console.error('[DetailView] Failed to remove member:', result.error);
        }
      },
      onAddMember: async () => {
        // #3222 - Add Button + Character-Auswahl-Dialog
        if (!this.deps.entityRegistry || !this.deps.partyFeature) {
          console.warn('[DetailView] entityRegistry or partyFeature not available');
          return;
        }

        // 1. Get all characters from EntityRegistry
        const allCharacters = this.deps.entityRegistry.getAll('character');

        // 2. Get current party member IDs
        const membersOption = this.deps.partyFeature.getMembers();
        const currentMemberIds = isSome(membersOption)
          ? membersOption.value.map(m => m.id)
          : [];

        // 3. Filter out characters already in party
        const availableCharacters = allCharacters.filter(
          (c: Character) => !currentMemberIds.includes(c.id)
        );

        // 4. Show character selection dialog
        const result = await showCharacterSelectionDialog(this.app, {
          availableCharacters: availableCharacters.map((c: Character) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            class: c.class,
          })),
        });

        // 5. Add selected character to party
        if (result.selected && result.characterId) {
          const addResult = await this.deps.partyFeature.addMember(
            result.characterId as CharacterId
          );
          if (!addResult.ok) {
            console.error('[DetailView] Failed to add member:', addResult.error);
          }
        }
      },
      onOpenInventory: (characterId: string) => {
        // Placeholder for #3220 - Inventory Button + Dialog
        console.log(`[DetailView] Open inventory for ${characterId} - not yet implemented (#3220)`);
      },
      onToggleExpanded: (characterId: string) => {
        this.viewModel?.togglePartyMemberExpanded(characterId);
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
