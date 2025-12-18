/**
 * Combat Tab Panel for DetailView.
 *
 * Displays initiative tracker, HP bars, conditions, and combat controls.
 * Migrated from SessionRunner combat-panel.ts with CSS adjustments for DetailView.
 */

import type { CombatState, CombatParticipant, ConditionType } from '@core/schemas';
import { CONDITION_REMINDERS } from '@core/schemas';
import type { DetailViewState } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface CombatTabCallbacks {
  onNextTurn(): void;
  onEndCombat(): void;
  onApplyDamage(participantId: string, amount: number): void;
  onApplyHealing(participantId: string, amount: number): void;
  onAddCondition(participantId: string, condition: ConditionType): void;
  onRemoveCondition(participantId: string, conditionType: ConditionType): void;
  onUpdateInitiative(participantId: string, initiative: number): void;
}

export interface CombatTab {
  update(state: DetailViewState): void;
  dispose(): void;
}

// ============================================================================
// Combat Tab Factory
// ============================================================================

/**
 * Create combat tab for DetailView.
 */
export function createCombatTab(
  container: HTMLElement,
  callbacks: CombatTabCallbacks
): CombatTab {
  // Create tab content element
  const tabContent = document.createElement('div');
  tabContent.className = 'salt-marcher-combat-tab';
  tabContent.style.cssText = `
    display: none;
    font-family: var(--font-monospace);
    font-size: 12px;
  `;
  container.appendChild(tabContent);

  // State tracking
  let currentState: CombatState | null = null;
  let selectedParticipantId: string | null = null;

  // =========================================================================
  // DOM Creation
  // =========================================================================

  function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 16px; font-weight: bold; color: var(--text-error);';
    title.innerHTML = '&#9876; COMBAT';
    header.appendChild(title);

    const roundBadge = document.createElement('div');
    roundBadge.className = 'round-badge';
    roundBadge.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: bold;
    `;
    header.appendChild(roundBadge);

    return header;
  }

  function createInitiativeList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'initiative-list';
    list.style.cssText = 'margin-bottom: 12px;';
    return list;
  }

  function createActionButtons(): HTMLElement {
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--background-modifier-border);
    `;

    const nextTurnBtn = createButton('⏭️ Next Turn', () => callbacks.onNextTurn());
    nextTurnBtn.style.flex = '1';

    const endBtn = createButton('🏁 End Combat', () => {
      callbacks.onEndCombat();
    });
    endBtn.style.flex = '1';
    endBtn.style.background = 'var(--background-modifier-border)';

    actions.appendChild(nextTurnBtn);
    actions.appendChild(endBtn);

    return actions;
  }

  function createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
    `;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '0.9';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '1';
    });
    return btn;
  }

  // =========================================================================
  // Participant Rendering
  // =========================================================================

  function renderParticipant(
    participant: CombatParticipant,
    isCurrentTurn: boolean
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      background: ${isCurrentTurn ? 'var(--interactive-accent-hover)' : 'var(--background-secondary)'};
      border: ${isCurrentTurn ? '2px solid var(--interactive-accent)' : '1px solid var(--background-modifier-border)'};
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background 0.2s;
    `;

    row.addEventListener('click', () => {
      selectedParticipantId = selectedParticipantId === participant.id ? null : participant.id;
      if (currentState) {
        renderInitiativeList(currentState);
      }
    });

    // Header row (initiative, name, turn indicator)
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

    // Initiative badge
    const initBadge = document.createElement('span');
    initBadge.style.cssText = `
      background: var(--background-modifier-border);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
      min-width: 24px;
      text-align: center;
    `;
    initBadge.textContent = String(participant.initiative);
    initBadge.title = 'Initiative';
    headerRow.appendChild(initBadge);

    // Name
    const name = document.createElement('span');
    name.style.cssText = `flex: 1; font-weight: ${isCurrentTurn ? 'bold' : 'normal'};`;
    name.textContent = participant.name;
    if (participant.type === 'character') {
      name.style.color = 'var(--text-accent)';
    }
    headerRow.appendChild(name);

    // Side indicator (derived from participant type)
    const sideIcon = document.createElement('span');
    const isParty = participant.type === 'character';
    sideIcon.textContent = isParty ? '👤' : '👹';
    sideIcon.title = isParty ? 'Party' : 'Enemy';
    headerRow.appendChild(sideIcon);

    // Current turn indicator
    if (isCurrentTurn) {
      const turnIndicator = document.createElement('span');
      turnIndicator.style.cssText = 'color: var(--interactive-accent); font-weight: bold;';
      turnIndicator.innerHTML = '&#9654;';
      headerRow.appendChild(turnIndicator);
    }

    row.appendChild(headerRow);

    // HP Bar
    const hpBar = createHpBar(participant);
    row.appendChild(hpBar);

    // Conditions
    if (participant.conditions.length > 0) {
      const conditions = document.createElement('div');
      conditions.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;';

      for (const condition of participant.conditions) {
        const badge = document.createElement('span');
        badge.style.cssText = `
          background: var(--background-modifier-error);
          color: var(--text-on-accent);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: help;
        `;
        badge.textContent = condition.type;
        badge.title = CONDITION_REMINDERS[condition.type] || '';

        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onRemoveCondition(participant.id, condition.type);
        });

        conditions.appendChild(badge);
      }

      row.appendChild(conditions);
    }

    // Concentration indicator
    if (participant.concentratingOn) {
      const conc = document.createElement('div');
      conc.style.cssText = 'margin-top: 4px; color: var(--text-accent); font-size: 10px;';
      conc.innerHTML = `&#9733; Concentrating: ${participant.concentratingOn}`;
      row.appendChild(conc);
    }

    // Expanded actions (if selected)
    if (selectedParticipantId === participant.id) {
      const actions = createParticipantActions(participant);
      row.appendChild(actions);
    }

    return row;
  }

  function createHpBar(participant: CombatParticipant): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // HP text
    const hpText = document.createElement('span');
    hpText.style.cssText = 'min-width: 60px; font-size: 11px;';
    hpText.textContent = `${participant.currentHp}/${participant.maxHp}`;
    container.appendChild(hpText);

    // HP bar background
    const barBg = document.createElement('div');
    barBg.style.cssText = `
      flex: 1;
      height: 8px;
      background: var(--background-modifier-border);
      border-radius: 4px;
      overflow: hidden;
    `;

    // HP bar fill
    const hpPercent = Math.max(0, Math.min(100, (participant.currentHp / participant.maxHp) * 100));
    const barFill = document.createElement('div');
    barFill.style.cssText = `
      height: 100%;
      width: ${hpPercent}%;
      background: ${getHpColor(hpPercent)};
      transition: width 0.3s;
    `;
    barBg.appendChild(barFill);
    container.appendChild(barBg);

    return container;
  }

  function getHpColor(percent: number): string {
    if (percent > 50) return 'var(--text-success)';
    if (percent > 25) return 'var(--text-warning)';
    return 'var(--text-error)';
  }

  function createParticipantActions(participant: CombatParticipant): HTMLElement {
    const actions = document.createElement('div');
    actions.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--background-modifier-border);
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    `;

    const damageBtn = createSmallButton('💔 Damage', () => {
      const amount = prompt('Damage amount:');
      if (amount && !isNaN(Number(amount))) {
        callbacks.onApplyDamage(participant.id, Number(amount));
      }
    }, 'var(--text-error)');

    const healBtn = createSmallButton('💚 Heal', () => {
      const amount = prompt('Heal amount:');
      if (amount && !isNaN(Number(amount))) {
        callbacks.onApplyHealing(participant.id, Number(amount));
      }
    }, 'var(--text-success)');

    const conditionBtn = createSmallButton('⚠️ Condition', () => {
      const condition = prompt('Condition (blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion):');
      if (condition) {
        callbacks.onAddCondition(participant.id, condition as ConditionType);
      }
    }, 'var(--text-warning)');

    const initBtn = createSmallButton('🎯 Init', () => {
      const init = prompt('New initiative:', String(participant.initiative));
      if (init && !isNaN(Number(init))) {
        callbacks.onUpdateInitiative(participant.id, Number(init));
      }
    }, 'var(--text-muted)');

    actions.appendChild(damageBtn);
    actions.appendChild(healBtn);
    actions.appendChild(conditionBtn);
    actions.appendChild(initBtn);

    return actions;
  }

  function createSmallButton(text: string, onClick: () => void, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: var(--background-secondary);
      color: ${color};
      border: 1px solid var(--background-modifier-border);
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
      font-size: 10px;
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // =========================================================================
  // Empty State
  // =========================================================================

  function renderEmptyState(): void {
    tabContent.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 12px;">🗡️</div>
        <div style="margin-bottom: 8px;">Kein aktiver Combat</div>
        <div style="font-size: 11px;">Starte einen Encounter, um Combat zu beginnen.</div>
      </div>
    `;
  }

  // =========================================================================
  // Main Render
  // =========================================================================

  const header = createHeader();
  const initiativeList = createInitiativeList();
  const actionButtons = createActionButtons();

  function renderInitiativeList(state: CombatState): void {
    initiativeList.innerHTML = '';

    const currentParticipantId = state.initiativeOrder[state.currentTurnIndex];

    for (const participantId of state.initiativeOrder) {
      const participant = state.participants.find(p => p.id === participantId);
      if (participant) {
        const isCurrentTurn = participantId === currentParticipantId;
        const row = renderParticipant(participant, isCurrentTurn);
        initiativeList.appendChild(row);
      }
    }
  }

  function renderCombat(state: CombatState): void {
    tabContent.innerHTML = '';
    tabContent.appendChild(header);
    tabContent.appendChild(initiativeList);
    tabContent.appendChild(actionButtons);

    // Update round badge
    const roundBadge = header.querySelector('.round-badge') as HTMLElement;
    if (roundBadge) {
      roundBadge.textContent = `Runde ${state.roundNumber}`;
    }

    // Render initiative list
    renderInitiativeList(state);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: DetailViewState): void {
      const combatState = state.combat.combatState;
      const isActive = state.activeTab === 'combat';

      // Show/hide tab
      tabContent.style.display = isActive ? 'block' : 'none';

      if (!isActive) return;

      if (!combatState || combatState.status !== 'active') {
        currentState = null;
        selectedParticipantId = null;
        renderEmptyState();
        return;
      }

      currentState = combatState;
      renderCombat(combatState);
    },

    dispose(): void {
      tabContent.remove();
    },
  };
}
