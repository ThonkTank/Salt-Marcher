/**
 * Party Tab Panel for DetailView.
 *
 * Displays active party members with HP tracking and basic stats.
 * This is the container component - individual features (HP input,
 * inventory dialog, etc.) are implemented in follow-up tasks.
 *
 * @see DetailView.md#party-tab
 */

import type { DetailViewState, CharacterDisplay } from '../types';
import type { EntityId } from '@core/types';

// ============================================================================
// Types
// ============================================================================

export interface PartyTabCallbacks {
  /** Called when HP is changed via +/- buttons */
  onHpChange(characterId: EntityId<'character'>, delta: number): void;
  /** Called when a member is removed from party */
  onRemoveMember(characterId: EntityId<'character'>): void;
  /** Called when Add button is clicked */
  onAddMember(): void;
  /** Called when Inventory button is clicked */
  onOpenInventory(characterId: EntityId<'character'>): void;
  /** Called when a member row is expanded/collapsed */
  onToggleExpanded(characterId: EntityId<'character'>): void;
}

export interface PartyTab {
  update(state: DetailViewState): void;
  dispose(): void;
}

// ============================================================================
// Party Tab Factory
// ============================================================================

/**
 * Create party tab for DetailView.
 */
export function createPartyTab(
  container: HTMLElement,
  callbacks: PartyTabCallbacks
): PartyTab {
  // Create tab content element
  const tabContent = document.createElement('div');
  tabContent.className = 'salt-marcher-party-tab';
  tabContent.style.cssText = `
    display: none;
    font-family: var(--font-monospace);
    font-size: 12px;
    padding: 12px;
  `;
  container.appendChild(tabContent);

  // Track current state for comparison
  let lastPartyState: DetailViewState['party'] | null = null;

  // =========================================================================
  // Rendering
  // =========================================================================

  function render(state: DetailViewState): void {
    const party = state.party;
    tabContent.innerHTML = '';

    // Header
    const header = createSection('PARTY');
    tabContent.appendChild(header);

    // Party Stats Section
    const statsSection = createPartyStats(party);
    tabContent.appendChild(statsSection);

    // Separator
    tabContent.appendChild(createSeparator());

    // Members Section Header
    const membersHeader = createSectionHeader('Mitglieder');
    tabContent.appendChild(membersHeader);

    // Members List
    if (party.members.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color: var(--text-muted); font-size: 11px; padding: 8px 0;';
      emptyMsg.textContent = 'Keine Party-Mitglieder. Klicke auf [+ Hinzufügen] um Charaktere zur Party hinzuzufügen.';
      tabContent.appendChild(emptyMsg);
    } else {
      for (const member of party.members) {
        const row = createMemberRow(member, callbacks);
        tabContent.appendChild(row);
      }
    }

    // Separator
    tabContent.appendChild(createSeparator());

    // Add Button
    const addSection = document.createElement('div');
    addSection.style.cssText = 'display: flex; justify-content: center;';

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Hinzufügen';
    addBtn.style.cssText = getButtonStyle('primary');
    addBtn.title = 'Charakter zur Party hinzufügen';
    addBtn.addEventListener('click', () => callbacks.onAddMember());
    addSection.appendChild(addBtn);

    tabContent.appendChild(addSection);
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

  function createPartyStats(party: DetailViewState['party']): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: var(--background-secondary);
      padding: 12px;
      border-radius: 4px;
    `;

    const stats = party.partyStats;

    // Member count
    const countRow = createStatRow('Mitglieder', `${stats.memberCount}`);
    section.appendChild(countRow);

    // Average level
    const levelRow = createStatRow('Ø Level', `${stats.averageLevel.toFixed(1)}`);
    section.appendChild(levelRow);

    // Travel speed with encumbrance
    const speedText = `${stats.travelSpeed} ft`;
    const encumbranceText = stats.encumbranceStatus !== 'light'
      ? ` (${getEncumbranceLabel(stats.encumbranceStatus)})`
      : '';
    const speedRow = createStatRow('Reisegeschwindigkeit', speedText + encumbranceText);
    section.appendChild(speedRow);

    return section;
  }

  function createStatRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 4px;';
    row.innerHTML = `
      <span>${label}</span>
      <span style="font-weight: bold;">${value}</span>
    `;
    return row;
  }

  function createMemberRow(
    member: CharacterDisplay,
    callbacks: PartyTabCallbacks
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      background: var(--background-secondary);
      border-radius: 4px;
      margin-bottom: 8px;
      overflow: hidden;
    `;

    // Collapsed view (always visible)
    const collapsed = document.createElement('div');
    collapsed.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
    `;

    // Left side: Toggle + Name
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = member.expanded ? '▼' : '▶';
    toggleBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 10px;
      color: var(--text-muted);
      padding: 2px;
    `;
    toggleBtn.addEventListener('click', () => callbacks.onToggleExpanded(member.id));
    leftSide.appendChild(toggleBtn);

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight: bold;';
    nameEl.textContent = member.name;
    leftSide.appendChild(nameEl);

    collapsed.appendChild(leftSide);

    // Right side: HP, AC, PP, buttons
    const rightSide = document.createElement('div');
    rightSide.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    // HP display with +/- (placeholder for #3219)
    const hpSection = document.createElement('div');
    hpSection.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    const hpValue = document.createElement('span');
    hpValue.style.cssText = getHpStyle(member.currentHp, member.maxHp);
    hpValue.textContent = `${member.currentHp}/${member.maxHp}`;
    hpSection.appendChild(hpValue);

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.style.cssText = getSmallButtonStyle();
    plusBtn.title = 'Heilen';
    plusBtn.addEventListener('click', () => callbacks.onHpChange(member.id, 1));
    hpSection.appendChild(plusBtn);

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.style.cssText = getSmallButtonStyle();
    minusBtn.title = 'Schaden';
    minusBtn.addEventListener('click', () => callbacks.onHpChange(member.id, -1));
    hpSection.appendChild(minusBtn);

    rightSide.appendChild(hpSection);

    // AC
    const acEl = document.createElement('span');
    acEl.style.cssText = 'font-size: 11px; color: var(--text-muted);';
    acEl.textContent = `AC ${member.ac}`;
    rightSide.appendChild(acEl);

    // PP
    const ppEl = document.createElement('span');
    ppEl.style.cssText = 'font-size: 11px; color: var(--text-muted);';
    ppEl.textContent = `PP ${member.passivePerception}`;
    rightSide.appendChild(ppEl);

    // Inventory button (placeholder for #3220)
    const invBtn = document.createElement('button');
    invBtn.textContent = '🎒';
    invBtn.style.cssText = getSmallButtonStyle();
    invBtn.title = 'Inventar öffnen';
    invBtn.addEventListener('click', () => callbacks.onOpenInventory(member.id));
    rightSide.appendChild(invBtn);

    // Remove button (placeholder for #3221)
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `${getSmallButtonStyle()} color: var(--text-error);`;
    removeBtn.title = 'Aus Party entfernen';
    removeBtn.addEventListener('click', () => callbacks.onRemoveMember(member.id));
    rightSide.appendChild(removeBtn);

    collapsed.appendChild(rightSide);
    row.appendChild(collapsed);

    // Expanded view (conditionally visible)
    if (member.expanded) {
      const expanded = document.createElement('div');
      expanded.style.cssText = `
        padding: 8px 8px 8px 28px;
        border-top: 1px solid var(--background-modifier-border);
        font-size: 11px;
        color: var(--text-muted);
      `;

      const details = [
        `Level ${member.level} ${member.class}`,
        `Speed: ${member.speed} ft`,
        `Belastung: ${getEncumbranceLabel(member.encumbrance)}`,
      ];

      expanded.innerHTML = details.map(d => `<div style="margin-bottom: 4px;">${d}</div>`).join('');
      row.appendChild(expanded);
    }

    return row;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function getEncumbranceLabel(level: CharacterDisplay['encumbrance']): string {
    switch (level) {
      case 'light': return 'Leicht';
      case 'encumbered': return 'Belastet';
      case 'heavily': return 'Schwer belastet';
      case 'over_capacity': return 'Überladen';
    }
  }

  function getHpStyle(current: number, max: number): string {
    const ratio = current / max;
    let color = 'var(--text-success)';
    if (ratio <= 0.25) {
      color = 'var(--text-error)';
    } else if (ratio <= 0.5) {
      color = 'var(--text-warning)';
    }
    return `font-weight: bold; color: ${color};`;
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

  function getButtonStyle(variant: 'primary' | 'secondary'): string {
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
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: DetailViewState): void {
      const isActive = state.activeTab === 'party';

      // Show/hide tab
      tabContent.style.display = isActive ? 'block' : 'none';

      if (!isActive) return;

      // Only re-render if party state changed
      if (lastPartyState !== state.party) {
        render(state);
        lastPartyState = state.party;
      }
    },

    dispose(): void {
      tabContent.remove();
    },
  };
}
