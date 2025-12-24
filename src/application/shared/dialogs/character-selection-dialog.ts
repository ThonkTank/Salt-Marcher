/**
 * Character Selection Dialog
 *
 * Modal dialog for selecting a character to add to the party.
 * Shows all available characters from the Library, excluding
 * characters that are already in the party.
 */

import { App, Modal } from 'obsidian';

// ============================================================================
// Types
// ============================================================================

export interface CharacterInfo {
  id: string;
  name: string;
  level: number;
  class: string;
}

export interface CharacterSelectionDialogOptions {
  availableCharacters: CharacterInfo[];
}

export interface CharacterSelectionDialogResult {
  selected: boolean;
  characterId?: string;
}

// ============================================================================
// Dialog
// ============================================================================

/**
 * Modal dialog for selecting a character to add to the party.
 * Returns a promise that resolves when the user makes a choice.
 */
export class CharacterSelectionDialog extends Modal {
  private options: CharacterSelectionDialogOptions;
  private selectedCharacterId: string | null = null;
  private resolvePromise: ((result: CharacterSelectionDialogResult) => void) | null = null;
  private searchQuery = '';
  private listContainer: HTMLElement | null = null;

  constructor(app: App, options: CharacterSelectionDialogOptions) {
    super(app);
    this.options = options;
  }

  /**
   * Open the dialog and wait for user choice.
   */
  openAndWait(): Promise<CharacterSelectionDialogResult> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('salt-marcher-character-selection-dialog');

    // Title
    contentEl.createEl('h2', { text: 'Charakter zur Party hinzufügen' });

    // Empty state
    if (this.options.availableCharacters.length === 0) {
      this.renderEmptyState(contentEl);
      return;
    }

    // Search input
    const searchContainer = contentEl.createDiv({ cls: 'character-search-container' });
    searchContainer.style.cssText = 'margin-bottom: 12px;';

    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Charakter suchen...',
    });
    searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--background-primary);
      color: var(--text-normal);
      font-size: 14px;
    `;
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase();
      this.renderCharacterList();
    });

    // Character list container
    this.listContainer = contentEl.createDiv({ cls: 'character-list-container' });
    this.listContainer.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      margin-bottom: 16px;
    `;

    this.renderCharacterList();

    // Buttons
    this.renderButtons(contentEl);
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'character-empty-state' });
    emptyState.style.cssText = `
      text-align: center;
      padding: 32px 16px;
      color: var(--text-muted);
    `;
    emptyState.createEl('p', {
      text: 'Keine Charaktere verfügbar.',
    });
    emptyState.createEl('p', {
      text: 'Erstelle Charaktere in der Library, um sie zur Party hinzuzufügen.',
    }).style.cssText = 'font-size: 12px; margin-top: 8px;';

    // Close button only
    const buttonContainer = container.createDiv({ cls: 'character-selection-buttons' });
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    `;

    const closeBtn = buttonContainer.createEl('button', { text: 'Schließen' });
    closeBtn.addEventListener('click', () => {
      this.resolvePromise?.({ selected: false });
      this.close();
    });
  }

  private renderCharacterList(): void {
    if (!this.listContainer) return;
    this.listContainer.empty();

    const filteredCharacters = this.options.availableCharacters.filter(c =>
      c.name.toLowerCase().includes(this.searchQuery) ||
      c.class.toLowerCase().includes(this.searchQuery)
    );

    if (filteredCharacters.length === 0) {
      const noResults = this.listContainer.createDiv();
      noResults.style.cssText = `
        padding: 24px;
        text-align: center;
        color: var(--text-muted);
      `;
      noResults.textContent = 'Keine Charaktere gefunden.';
      return;
    }

    for (const character of filteredCharacters) {
      const card = this.createCharacterCard(character);
      this.listContainer.appendChild(card);
    }
  }

  private createCharacterCard(character: CharacterInfo): HTMLElement {
    const card = document.createElement('div');
    card.className = 'character-card';
    const isSelected = this.selectedCharacterId === character.id;

    card.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--background-modifier-border);
      background: ${isSelected ? 'var(--background-modifier-active-hover)' : 'transparent'};
      transition: background 0.1s ease;
    `;

    // Left side: Name and Class
    const leftSide = card.createDiv();
    leftSide.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const nameEl = leftSide.createEl('span', { text: character.name });
    nameEl.style.cssText = 'font-weight: bold; color: var(--text-normal);';

    const classEl = leftSide.createEl('span', { text: character.class });
    classEl.style.cssText = 'font-size: 12px; color: var(--text-muted);';

    // Right side: Level
    const levelBadge = card.createDiv();
    levelBadge.style.cssText = `
      background: var(--background-secondary);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-muted);
    `;
    levelBadge.textContent = `Lvl ${character.level}`;

    // Click to select
    card.addEventListener('click', () => {
      this.selectedCharacterId = character.id;
      this.renderCharacterList();
    });

    // Double-click to select and confirm
    card.addEventListener('dblclick', () => {
      this.selectedCharacterId = character.id;
      this.resolvePromise?.({
        selected: true,
        characterId: this.selectedCharacterId,
      });
      this.close();
    });

    // Hover effect
    card.addEventListener('mouseenter', () => {
      if (!isSelected) {
        card.style.background = 'var(--background-modifier-hover)';
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = isSelected
        ? 'var(--background-modifier-active-hover)'
        : 'transparent';
    });

    return card;
  }

  private renderButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv({ cls: 'character-selection-buttons' });
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    `;

    // Cancel button
    const cancelBtn = buttonContainer.createEl('button', { text: 'Abbrechen' });
    cancelBtn.addEventListener('click', () => {
      this.resolvePromise?.({ selected: false });
      this.close();
    });

    // Add button
    const addBtn = buttonContainer.createEl('button', {
      text: 'Hinzufügen',
      cls: 'mod-cta',
    });
    addBtn.addEventListener('click', () => {
      if (this.selectedCharacterId) {
        this.resolvePromise?.({
          selected: true,
          characterId: this.selectedCharacterId,
        });
      } else {
        this.resolvePromise?.({ selected: false });
      }
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Ensure promise resolves if dialog closed without action
    if (this.resolvePromise) {
      this.resolvePromise({ selected: false });
      this.resolvePromise = null;
    }
  }
}

/**
 * Helper function to show the character selection dialog.
 */
export function showCharacterSelectionDialog(
  app: App,
  options: CharacterSelectionDialogOptions
): Promise<CharacterSelectionDialogResult> {
  const dialog = new CharacterSelectionDialog(app, options);
  return dialog.openAndWait();
}
