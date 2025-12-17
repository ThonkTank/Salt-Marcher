/**
 * Encounter Tab Panel for DetailView.
 *
 * Displays encounter preview, creatures list, and action buttons.
 */

import type { EncounterInstance, CreatureInstance } from '@core/schemas';
import type { DetailViewState } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface EncounterTabCallbacks {
  onStartEncounter(encounterId: string): void;
  onDismissEncounter(encounterId: string): void;
  onRegenerateEncounter(): void;
}

export interface EncounterTab {
  update(state: DetailViewState): void;
  dispose(): void;
}

// ============================================================================
// Encounter Tab Factory
// ============================================================================

/**
 * Create encounter tab for DetailView.
 */
export function createEncounterTab(
  container: HTMLElement,
  callbacks: EncounterTabCallbacks
): EncounterTab {
  // Create tab content element
  const tabContent = document.createElement('div');
  tabContent.className = 'salt-marcher-encounter-tab';
  tabContent.style.cssText = `
    display: none;
    font-family: var(--font-monospace);
    font-size: 12px;
  `;
  container.appendChild(tabContent);

  // =========================================================================
  // Rendering
  // =========================================================================

  function renderEmptyState(): void {
    tabContent.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 12px;">⚔️</div>
        <div style="margin-bottom: 8px;">Kein aktiver Encounter</div>
        <div style="font-size: 11px;">Generiere einen Encounter im SessionRunner oder klicke unten.</div>
      </div>
      <div style="text-align: center; margin-top: 16px;">
        <button class="regenerate-btn" style="
          background: var(--interactive-accent);
          color: var(--text-on-accent);
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">🎲 Neuen Encounter generieren</button>
      </div>
    `;

    const regenBtn = tabContent.querySelector('.regenerate-btn');
    regenBtn?.addEventListener('click', () => callbacks.onRegenerateEncounter());
  }

  function renderEncounter(encounter: EncounterInstance): void {
    tabContent.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;

    const typeIcon = getEncounterTypeIcon(encounter.type);
    const statusColor = getStatusColor(encounter.state);

    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 16px; font-weight: bold;">
          ${typeIcon} ${capitalizeFirst(encounter.type)} Encounter
        </div>
        <div style="
          background: ${statusColor};
          color: var(--text-on-accent);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
        ">${capitalizeFirst(encounter.state)}</div>
      </div>
      <div style="margin-top: 8px; color: var(--text-muted); font-size: 11px;">
        ID: ${encounter.id.slice(0, 8)}... | XP: ${encounter.xpAwarded ?? 0} | Trigger: ${encounter.trigger ?? 'manual'}
      </div>
    `;
    tabContent.appendChild(header);

    // Creatures list
    const creaturesSection = document.createElement('div');
    creaturesSection.style.cssText = 'margin-bottom: 16px;';

    const creaturesTitle = document.createElement('div');
    creaturesTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
    creaturesTitle.textContent = `Creatures (${encounter.creatures.length})`;
    creaturesSection.appendChild(creaturesTitle);

    for (const creature of encounter.creatures) {
      const creatureRow = renderCreatureRow(creature);
      creaturesSection.appendChild(creatureRow);
    }

    tabContent.appendChild(creaturesSection);

    // Context (if available)
    if (encounter.position) {
      const contextSection = document.createElement('div');
      contextSection.style.cssText = `
        margin-bottom: 16px;
        padding: 10px;
        background: var(--background-secondary);
        border-radius: 4px;
        font-size: 11px;
      `;
      contextSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">Kontext:</div>
        <div style="color: var(--text-muted);">
          Position: (${encounter.position.q}, ${encounter.position.r})<br>
          Trigger: ${encounter.trigger ?? 'manual'}
        </div>
      `;
      tabContent.appendChild(contextSection);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 12px;
      border-top: 1px solid var(--background-modifier-border);
    `;

    if (encounter.state === 'pending') {
      // Start button (different label for combat vs other types)
      const startBtn = document.createElement('button');
      startBtn.textContent = encounter.type === 'combat' ? '⚔️ Start Combat' : '▶️ Start Encounter';
      startBtn.style.cssText = getButtonStyle('primary');
      startBtn.addEventListener('click', () => callbacks.onStartEncounter(encounter.id));
      actions.appendChild(startBtn);

      // Dismiss button
      const dismissBtn = document.createElement('button');
      dismissBtn.textContent = '❌ Dismiss';
      dismissBtn.style.cssText = getButtonStyle('secondary');
      dismissBtn.addEventListener('click', () => callbacks.onDismissEncounter(encounter.id));
      actions.appendChild(dismissBtn);

      // Regenerate button
      const regenBtn = document.createElement('button');
      regenBtn.textContent = '🔄 Regenerate';
      regenBtn.style.cssText = getButtonStyle('tertiary');
      regenBtn.addEventListener('click', () => callbacks.onRegenerateEncounter());
      actions.appendChild(regenBtn);
    } else if (encounter.state === 'active') {
      const info = document.createElement('div');
      info.style.cssText = 'color: var(--text-warning); font-size: 11px;';
      info.textContent = 'Encounter ist aktiv. Siehe Combat-Tab für Details.';
      actions.appendChild(info);
    } else if (encounter.state === 'resolved') {
      const info = document.createElement('div');
      info.style.cssText = 'color: var(--text-success); font-size: 11px;';
      info.textContent = `Encounter resolved. XP: ${encounter.xpAwarded ?? 0}`;
      actions.appendChild(info);

      // New encounter button
      const newBtn = document.createElement('button');
      newBtn.textContent = '🎲 Neuen Encounter';
      newBtn.style.cssText = getButtonStyle('primary');
      newBtn.addEventListener('click', () => callbacks.onRegenerateEncounter());
      actions.appendChild(newBtn);
    }

    tabContent.appendChild(actions);
  }

  function renderCreatureRow(creature: CreatureInstance): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      padding: 8px;
      margin-bottom: 4px;
      background: var(--background-secondary);
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Extract creature type from definitionId (e.g., "creature:goblin" → "Goblin")
    const creatureName = creature.definitionId.split(':')[1] ?? creature.definitionId;
    const displayName = creatureName.charAt(0).toUpperCase() + creatureName.slice(1);

    row.innerHTML = `
      <div>
        <div style="font-weight: bold;">${displayName}</div>
        <div style="font-size: 10px; color: var(--text-muted);">
          HP: ${creature.currentHp}${creature.tempHp > 0 ? ` (+${creature.tempHp})` : ''}
        </div>
      </div>
      <div style="
        background: var(--background-modifier-border);
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
      ">${creature.instanceId.slice(0, 6)}</div>
    `;

    return row;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function getEncounterTypeIcon(type: string): string {
    switch (type) {
      case 'combat': return '⚔️';
      case 'social': return '💬';
      case 'passing': return '👁️';
      case 'trace': return '🔍';
      case 'environmental': return '🌿';
      case 'location': return '📍';
      default: return '❓';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'var(--text-warning)';
      case 'active': return 'var(--interactive-accent)';
      case 'resolved': return 'var(--text-success)';
      default: return 'var(--text-muted)';
    }
  }

  function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getButtonStyle(variant: 'primary' | 'secondary' | 'tertiary'): string {
    const base = `
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      border: none;
    `;
    switch (variant) {
      case 'primary':
        return base + `
          background: var(--interactive-accent);
          color: var(--text-on-accent);
        `;
      case 'secondary':
        return base + `
          background: var(--background-modifier-border);
          color: var(--text-normal);
        `;
      case 'tertiary':
        return base + `
          background: var(--background-secondary);
          color: var(--text-muted);
          border: 1px solid var(--background-modifier-border);
        `;
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: DetailViewState): void {
      const encounter = state.encounter.currentEncounter;
      const isActive = state.activeTab === 'encounter';

      // Show/hide tab
      tabContent.style.display = isActive ? 'block' : 'none';

      if (!isActive) return;

      if (!encounter) {
        renderEmptyState();
        return;
      }

      renderEncounter(encounter);
    },

    dispose(): void {
      tabContent.remove();
    },
  };
}
