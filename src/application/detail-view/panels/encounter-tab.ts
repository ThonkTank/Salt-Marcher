/**
 * Encounter Tab Panel for DetailView.
 *
 * Implements the Encounter Builder UI with:
 * - Encounter search (placeholder for #2410)
 * - Name, Activity, Goal input fields
 * - Creature/NPC search (placeholder for #2411)
 * - Creature list with count controls and remove buttons
 * - Encounter rating (XP, Difficulty, Daily Budget)
 * - Save and Combat Start buttons
 *
 * @see DetailView.md#encounter-tab
 */

import type { DetailViewState, BuilderCreature, EncounterDifficulty } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface EncounterTabCallbacks {
  // Encounter actions
  onStartEncounter(encounterId: string): void;
  onDismissEncounter(encounterId: string): void;
  onRegenerateEncounter(): void;

  // Builder actions (#2408/#2409)
  onNameChange(name: string): void;
  onActivityChange(activity: string): void;
  onGoalChange(goal: string): void;
  onRemoveCreature(index: number): void;
  onCreatureCountChange(index: number, count: number): void;
  onSaveEncounter(): void;
  onClearBuilder(): void;
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
    padding: 12px;
  `;
  container.appendChild(tabContent);

  // Track current state for comparison
  let lastEncounterState: DetailViewState['encounter'] | null = null;

  // =========================================================================
  // Rendering
  // =========================================================================

  function renderBuilder(state: DetailViewState): void {
    const enc = state.encounter;
    tabContent.innerHTML = '';

    // Header
    const header = createSection('ENCOUNTER BUILDER');
    tabContent.appendChild(header);

    // Encounter Search (Placeholder for #2410)
    const searchSection = document.createElement('div');
    searchSection.style.cssText = 'margin-bottom: 16px;';
    searchSection.innerHTML = `
      <input type="text" placeholder="🔍 Gespeicherte Encounter suchen..."
        style="${getInputStyle()}" disabled title="Wird in #2410 implementiert">
    `;
    tabContent.appendChild(searchSection);

    // Separator
    tabContent.appendChild(createSeparator());

    // Name field
    const nameField = createTextField('Name', enc.builderName, (value) => {
      callbacks.onNameChange(value);
    });
    tabContent.appendChild(nameField);

    // Creatures Section
    const creaturesHeader = createSectionHeader('Kreaturen/NPCs');
    tabContent.appendChild(creaturesHeader);

    // Creature Search (Placeholder for #2411)
    const creatureSearch = document.createElement('div');
    creatureSearch.style.cssText = 'margin-bottom: 12px;';
    creatureSearch.innerHTML = `
      <input type="text" placeholder="🔍 Kreatur/NPC suchen..."
        style="${getInputStyle()}" disabled title="Wird in #2411 implementiert">
    `;
    tabContent.appendChild(creatureSearch);

    // Creature List
    if (enc.builderCreatures.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color: var(--text-muted); font-size: 11px; padding: 8px 0;';
      emptyMsg.textContent = 'Keine Kreaturen hinzugefügt. Nutze die Suche oder generiere einen Encounter.';
      tabContent.appendChild(emptyMsg);
    } else {
      for (let i = 0; i < enc.builderCreatures.length; i++) {
        const creature = enc.builderCreatures[i];
        const row = createCreatureRow(creature, i, callbacks);
        tabContent.appendChild(row);
      }
    }

    // Context Section
    tabContent.appendChild(createSeparator());
    const contextHeader = createSectionHeader('Kontext');
    tabContent.appendChild(contextHeader);

    const activityField = createTextField('Activity', enc.builderActivity, (value) => {
      callbacks.onActivityChange(value);
    }, 'Was tun die Kreaturen?');
    tabContent.appendChild(activityField);

    const goalField = createTextField('Goal', enc.builderGoal, (value) => {
      callbacks.onGoalChange(value);
    }, 'Was wollen die Kreaturen?');
    tabContent.appendChild(goalField);

    // Encounter Rating Section
    tabContent.appendChild(createSeparator());
    const ratingSection = createRatingSection(enc);
    tabContent.appendChild(ratingSection);

    // Action Buttons
    tabContent.appendChild(createSeparator());
    const actions = createActionButtons(enc, callbacks);
    tabContent.appendChild(actions);
  }

  function createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--interactive-accent);
    `;
    section.textContent = title;
    return section;
  }

  function createSectionHeader(title: string): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: bold;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 12px 0 8px 0;
    `;
    header.textContent = title;
    return header;
  }

  function createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.style.cssText = `
      border-top: 1px solid var(--background-modifier-border);
      margin: 12px 0;
    `;
    return sep;
  }

  function createTextField(
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 12px;';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder ?? '';
    input.style.cssText = getInputStyle();
    input.addEventListener('input', (e) => {
      onChange((e.target as HTMLInputElement).value);
    });
    wrapper.appendChild(input);

    return wrapper;
  }

  function createCreatureRow(
    creature: BuilderCreature,
    index: number,
    callbacks: EncounterTabCallbacks
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      margin-bottom: 4px;
      background: var(--background-secondary);
      border-radius: 4px;
    `;

    // Left side: Name and CR
    const info = document.createElement('div');
    const displayName = capitalizeFirst(creature.name);
    info.innerHTML = `
      <div style="font-weight: bold;">${displayName}</div>
      <div style="font-size: 10px; color: var(--text-muted);">
        CR ${creature.cr} | XP ${creature.xp}
      </div>
    `;
    row.appendChild(info);

    // Right side: Count controls and remove button
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Count controls
    const countWrapper = document.createElement('div');
    countWrapper.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.style.cssText = getSmallButtonStyle();
    minusBtn.addEventListener('click', () => {
      callbacks.onCreatureCountChange(index, creature.count - 1);
    });

    const countDisplay = document.createElement('span');
    countDisplay.style.cssText = 'min-width: 24px; text-align: center;';
    countDisplay.textContent = `×${creature.count}`;

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.style.cssText = getSmallButtonStyle();
    plusBtn.addEventListener('click', () => {
      callbacks.onCreatureCountChange(index, creature.count + 1);
    });

    countWrapper.appendChild(minusBtn);
    countWrapper.appendChild(countDisplay);
    countWrapper.appendChild(plusBtn);
    controls.appendChild(countWrapper);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      ${getSmallButtonStyle()}
      color: var(--text-error);
      font-weight: bold;
    `;
    removeBtn.title = 'Entfernen';
    removeBtn.addEventListener('click', () => {
      callbacks.onRemoveCreature(index);
    });
    controls.appendChild(removeBtn);

    row.appendChild(controls);
    return row;
  }

  function createRatingSection(enc: DetailViewState['encounter']): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: var(--background-secondary);
      padding: 12px;
      border-radius: 4px;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
    header.textContent = 'Encounter-Wertung';
    section.appendChild(header);

    // XP
    const xpRow = createRatingRow('Gesamt-XP', `${enc.totalXP} XP`);
    section.appendChild(xpRow);

    // Difficulty with bar
    const diffRow = document.createElement('div');
    diffRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';

    const diffLabel = document.createElement('span');
    diffLabel.textContent = 'Difficulty';
    diffRow.appendChild(diffLabel);

    const diffValue = document.createElement('div');
    diffValue.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    diffValue.innerHTML = `
      ${getDifficultyBar(enc.difficulty)}
      <span style="color: ${getDifficultyColor(enc.difficulty)}; font-weight: bold;">
        ${capitalizeFirst(enc.difficulty)}
      </span>
    `;
    diffRow.appendChild(diffValue);
    section.appendChild(diffRow);

    // Daily Budget
    const budgetPercent = enc.dailyBudgetTotal > 0
      ? Math.round((enc.dailyBudgetUsed / enc.dailyBudgetTotal) * 100)
      : 0;
    const budgetRow = createRatingRow(
      'Tages-Budget',
      `${budgetPercent}% verbraucht (${enc.dailyBudgetUsed}/${enc.dailyBudgetTotal} XP)`
    );
    section.appendChild(budgetRow);

    return section;
  }

  function createRatingRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 4px;';
    row.innerHTML = `
      <span>${label}</span>
      <span style="font-weight: bold;">${value}</span>
    `;
    return row;
  }

  function getDifficultyBar(difficulty: EncounterDifficulty): string {
    const levels: Record<EncounterDifficulty, number> = {
      easy: 1,
      medium: 2,
      hard: 3,
      deadly: 4,
    };
    const level = levels[difficulty];
    const filled = '\u2588'.repeat(level);
    const empty = '\u2591'.repeat(4 - level);
    return `<span style="font-family: monospace;">${filled}${empty}</span>`;
  }

  function getDifficultyColor(difficulty: EncounterDifficulty): string {
    switch (difficulty) {
      case 'easy': return 'var(--text-success)';
      case 'medium': return 'var(--text-warning)';
      case 'hard': return 'var(--text-error)';
      case 'deadly': return 'var(--text-error)';
    }
  }

  function createActionButtons(
    enc: DetailViewState['encounter'],
    callbacks: EncounterTabCallbacks
  ): HTMLElement {
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

    // Save button (placeholder for #2417)
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Speichern';
    saveBtn.style.cssText = getButtonStyle('secondary');
    saveBtn.disabled = true;
    saveBtn.title = 'Wird in #2417 implementiert';
    actions.appendChild(saveBtn);

    // Combat Start button
    const combatBtn = document.createElement('button');
    combatBtn.textContent = '⚔️ Combat starten';
    combatBtn.style.cssText = getButtonStyle('primary');
    combatBtn.disabled = enc.builderCreatures.length === 0;
    combatBtn.addEventListener('click', () => {
      const encounterId = enc.currentEncounter?.id ?? '';
      if (encounterId) {
        callbacks.onStartEncounter(encounterId);
      }
    });
    actions.appendChild(combatBtn);

    // Regenerate button
    const regenBtn = document.createElement('button');
    regenBtn.textContent = '🎲 Neu generieren';
    regenBtn.style.cssText = getButtonStyle('tertiary');
    regenBtn.addEventListener('click', () => callbacks.onRegenerateEncounter());
    actions.appendChild(regenBtn);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ Leeren';
    clearBtn.style.cssText = getButtonStyle('tertiary');
    clearBtn.addEventListener('click', () => callbacks.onClearBuilder());
    actions.appendChild(clearBtn);

    return actions;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function getInputStyle(): string {
    return `
      width: 100%;
      padding: 8px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--background-primary);
      color: var(--text-normal);
      font-family: var(--font-monospace);
      font-size: 12px;
    `;
  }

  function getSmallButtonStyle(): string {
    return `
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--background-primary);
      color: var(--text-normal);
      cursor: pointer;
      font-size: 14px;
    `;
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

  function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: DetailViewState): void {
      const isActive = state.activeTab === 'encounter';

      // Show/hide tab
      tabContent.style.display = isActive ? 'block' : 'none';

      if (!isActive) return;

      // Only re-render if encounter state changed
      if (lastEncounterState !== state.encounter) {
        renderBuilder(state);
        lastEncounterState = state.encounter;
      }
    },

    dispose(): void {
      tabContent.remove();
    },
  };
}
