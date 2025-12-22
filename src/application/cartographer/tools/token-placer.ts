/**
 * Token Placer Tool Component.
 *
 * Task #2558: Token-Placer Tool Component (Dungeon)
 * Spec: Cartographer.md#token-placer-dungeon
 *
 * Places tokens on Dungeon Grid:
 * - Token type selection (Creature, Object, Light)
 * - Creature search with recent list
 * - Object type selection
 * - Light source configuration (radius, color, flicker)
 */

import type { EntityId } from '@core/types';
import type { CartographerState, CreatureSize } from '../types';
import type { EntityRegistryPort } from '@core/types/entity-registry.port';

// ============================================================================
// Types
// ============================================================================

/**
 * Token Placer panel interface.
 * Follows panel pattern from terrain-brush.ts.
 */
export interface TokenPlacerPanel {
  /**
   * Update the panel with new state.
   * Called when CartographerState changes with 'tool' hint.
   */
  update(state: Readonly<CartographerState>): void;

  /**
   * Dispose the panel and clean up event listeners.
   */
  dispose(): void;
}

/**
 * Token type categories.
 */
export type TokenType = 'creature' | 'object' | 'light';

/**
 * Callbacks for user interactions with the Token Placer panel.
 */
export interface TokenPlacerCallbacks {
  /** Switch token type category */
  onTokenTypeChange: (type: TokenType) => void;
  /** Select a creature from search/recent */
  onCreatureSelect: (creatureId: EntityId<'creature'>) => void;
  /** Search creatures by name */
  onCreatureSearch: (query: string) => void;
  /** Change creature size override */
  onSizeChange: (size: CreatureSize) => void;
  /** Select an object type */
  onObjectSelect: (objectType: string) => void;
  /** Change light source type */
  onLightSourceChange: (source: string) => void;
  /** Change light radius */
  onLightRadiusChange: (radius: number) => void;
  /** Select light color */
  onLightColorSelect: (color: string) => void;
  /** Toggle flicker effect */
  onFlickerToggle: (enabled: boolean) => void;
  /** Open creature library browser */
  onBrowseLibrary: () => void;
}

/**
 * Dependencies for the Token Placer panel.
 */
export interface TokenPlacerDeps {
  /** Entity registry for creature lookup */
  entityRegistry: EntityRegistryPort;
}

// ============================================================================
// Constants
// ============================================================================

/** Creature sizes with labels */
const CREATURE_SIZES: Array<{ size: CreatureSize; label: string }> = [
  { size: 'T', label: 'Tiny' },
  { size: 'S', label: 'Small' },
  { size: 'M', label: 'Medium' },
  { size: 'L', label: 'Large' },
  { size: 'H', label: 'Huge' },
  { size: 'G', label: 'Gargantuan' },
];

/** Object types with icons */
const OBJECT_TYPES: Array<{ type: string; icon: string; label: string }> = [
  { type: 'chest', icon: '📦', label: 'Chest' },
  { type: 'chair', icon: '🪑', label: 'Chair' },
  { type: 'bed', icon: '🛏️', label: 'Bed' },
  { type: 'books', icon: '📚', label: 'Books' },
  { type: 'potions', icon: '⚗️', label: 'Potions' },
  { type: 'shelf', icon: '🗄️', label: 'Shelf' },
];

/** Light source presets */
const LIGHT_SOURCES: Array<{ id: string; label: string; defaultRadius: number }> = [
  { id: 'torch', label: 'Torch', defaultRadius: 40 },
  { id: 'lantern', label: 'Lantern', defaultRadius: 60 },
  { id: 'candle', label: 'Candle', defaultRadius: 10 },
  { id: 'fire', label: 'Campfire', defaultRadius: 40 },
  { id: 'magical', label: 'Magical', defaultRadius: 30 },
];

/** Light color options */
const LIGHT_COLORS: Array<{ color: string; label: string; emoji: string }> = [
  { color: '#FFD700', label: 'Yellow', emoji: '🟡' },
  { color: '#FFA500', label: 'Orange', emoji: '🟠' },
  { color: '#FFFFFF', label: 'White', emoji: '⚪' },
  { color: '#4169E1', label: 'Blue', emoji: '🔵' },
];

/** Maximum recent creatures to track */
const MAX_RECENT_CREATURES = 10;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Token Placer Tool panel.
 *
 * @param container - Parent element to mount the panel in
 * @param callbacks - Callbacks for user interactions
 * @param deps - Dependencies (entityRegistry for creature lookup)
 * @returns TokenPlacerPanel instance
 */
export function createTokenPlacerPanel(
  container: HTMLElement,
  callbacks: TokenPlacerCallbacks,
  deps: TokenPlacerDeps
): TokenPlacerPanel {
  const { entityRegistry } = deps;

  // Create main panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'token-placer-panel';
  panelEl.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
  `;
  container.appendChild(panelEl);

  // Track current state for updates
  let currentTokenType: TokenType = 'creature';
  let currentCreatureId: EntityId<'creature'> | undefined;
  let currentSize: CreatureSize = 'M';
  let currentObjectType: string | undefined;
  let currentLightSource = 'torch';
  let currentLightRadius = 40;
  let currentLightColor = '#FFD700';
  let currentFlickerEnabled = true;
  let searchQuery = '';
  let recentCreatureIds: EntityId<'creature'>[] = [];

  // UI element references for updates
  let tokenTypeContainer: HTMLElement;
  let creatureSectionEl: HTMLElement;
  let objectSectionEl: HTMLElement;
  let lightSectionEl: HTMLElement;
  let searchInput: HTMLInputElement;
  let searchResultsContainer: HTMLElement;
  let recentListContainer: HTMLElement;
  let sizeButtonsContainer: HTMLElement;
  let objectButtonsContainer: HTMLElement;
  let lightSourceSelect: HTMLSelectElement;
  let lightRadiusSlider: HTMLInputElement;
  let lightRadiusValue: HTMLElement;
  let lightColorContainer: HTMLElement;
  let flickerCheckbox: HTMLInputElement;

  // =========================================================================
  // Helpers
  // =========================================================================

  function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'token-placer-header';
    header.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    header.innerHTML = '<span style="font-size: 14px;">🎯</span> TOKEN PLACER';
    return header;
  }

  function createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'token-placer-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'section-title';
    sectionTitle.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-top: 8px;
      border-top: 1px solid var(--background-modifier-border);
    `;
    sectionTitle.textContent = title;

    const sectionContent = document.createElement('div');
    sectionContent.className = 'section-content';

    section.appendChild(sectionTitle);
    section.appendChild(sectionContent);
    return section;
  }

  function createTokenTypeSelector(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    const types: Array<{ type: TokenType; label: string }> = [
      { type: 'creature', label: 'Creature' },
      { type: 'object', label: 'Object' },
      { type: 'light', label: 'Light' },
    ];

    for (const { type, label } of types) {
      const btn = document.createElement('button');
      btn.className = 'token-type-button';
      btn.dataset.type = type;
      const isSelected = type === currentTokenType;
      btn.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 1px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 4px;
        color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.1s ease;
      `;
      btn.textContent = label;

      btn.addEventListener('click', () => {
        callbacks.onTokenTypeChange(type);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createSearchInput(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search creatures...';
    input.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--interactive-normal);
      color: var(--text-normal);
      font-size: 12px;
    `;

    input.addEventListener('input', () => {
      searchQuery = input.value;
      callbacks.onCreatureSearch(searchQuery);
      updateSearchResults();
    });

    const searchIcon = document.createElement('span');
    searchIcon.style.cssText = `
      font-size: 14px;
      color: var(--text-muted);
    `;
    searchIcon.textContent = '🔍';

    container.appendChild(input);
    container.appendChild(searchIcon);

    searchInput = input;
    return container;
  }

  function createSearchResults(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'search-results';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 120px;
      overflow-y: auto;
    `;
    return container;
  }

  function createRecentList(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'recent-list';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    return container;
  }

  function createCreatureButton(
    creatureId: EntityId<'creature'>,
    name: string,
    isSelected: boolean
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'creature-button';
    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: ${isSelected ? 'var(--interactive-accent)' : 'transparent'};
      border: none;
      border-radius: 4px;
      color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
      font-size: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.1s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      if (!isSelected) {
        btn.style.background = 'var(--interactive-hover)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (!isSelected) {
        btn.style.background = 'transparent';
      }
    });

    const bullet = document.createElement('span');
    bullet.textContent = '•';
    bullet.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-muted)';

    const label = document.createElement('span');
    label.textContent = name;

    btn.appendChild(bullet);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      callbacks.onCreatureSelect(creatureId);
      addToRecent(creatureId);
    });

    return btn;
  }

  function createBrowseButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'browse-library-button';
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 12px;
      background: transparent;
      border: 1px dashed var(--background-modifier-border);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-top: 4px;
    `;
    btn.textContent = 'Browse Library...';

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--text-muted)';
      btn.style.color = 'var(--text-normal)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--background-modifier-border)';
      btn.style.color = 'var(--text-muted)';
    });

    btn.addEventListener('click', () => {
      callbacks.onBrowseLibrary();
    });

    return btn;
  }

  function createSizeButtons(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    `;

    for (const { size, label } of CREATURE_SIZES) {
      const btn = document.createElement('button');
      btn.className = 'size-button';
      btn.dataset.size = size;
      const isSelected = size === currentSize;
      btn.style.cssText = `
        min-width: 28px;
        height: 28px;
        padding: 0 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 1px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 4px;
        color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.1s ease;
      `;
      btn.textContent = size;
      btn.title = label;

      btn.addEventListener('click', () => {
        callbacks.onSizeChange(size);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createObjectButtons(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    `;

    for (const { type, icon, label } of OBJECT_TYPES) {
      const btn = document.createElement('button');
      btn.className = 'object-button';
      btn.dataset.type = type;
      const isSelected = type === currentObjectType;
      btn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 8px 4px;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 2px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      const iconEl = document.createElement('span');
      iconEl.style.fontSize = '18px';
      iconEl.textContent = icon;

      const labelEl = document.createElement('span');
      labelEl.style.cssText = `
        font-size: 10px;
        color: ${isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)'};
      `;
      labelEl.textContent = label;

      btn.appendChild(iconEl);
      btn.appendChild(labelEl);

      btn.addEventListener('mouseenter', () => {
        if (!isSelected) {
          btn.style.background = 'var(--interactive-hover)';
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (!isSelected) {
          btn.style.background = 'var(--interactive-normal)';
        }
      });

      btn.addEventListener('click', () => {
        callbacks.onObjectSelect(type);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createLightSourceSelect(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const label = document.createElement('label');
    label.style.cssText = `
      font-size: 11px;
      color: var(--text-muted);
    `;
    label.textContent = 'Source';

    const select = document.createElement('select');
    select.style.cssText = `
      padding: 6px 8px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--interactive-normal);
      color: var(--text-normal);
      font-size: 12px;
      cursor: pointer;
    `;

    for (const source of LIGHT_SOURCES) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.label;
      option.selected = source.id === currentLightSource;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const source = LIGHT_SOURCES.find((s) => s.id === select.value);
      callbacks.onLightSourceChange(select.value);
      if (source) {
        callbacks.onLightRadiusChange(source.defaultRadius);
      }
    });

    container.appendChild(label);
    container.appendChild(select);

    lightSourceSelect = select;
    return container;
  }

  function createLightRadiusSlider(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const label = document.createElement('span');
    label.style.cssText = `
      font-size: 11px;
      color: var(--text-muted);
    `;
    label.textContent = 'Radius';

    const valueDisplay = document.createElement('span');
    valueDisplay.style.cssText = `
      font-size: 11px;
      color: var(--text-normal);
      font-weight: 500;
    `;
    valueDisplay.textContent = `${currentLightRadius}ft`;

    labelRow.appendChild(label);
    labelRow.appendChild(valueDisplay);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '5';
    slider.max = '120';
    slider.step = '5';
    slider.value = String(currentLightRadius);
    slider.style.cssText = `
      width: 100%;
      cursor: pointer;
    `;

    slider.addEventListener('input', () => {
      const radius = Number(slider.value);
      valueDisplay.textContent = `${radius}ft`;
      callbacks.onLightRadiusChange(radius);
    });

    container.appendChild(labelRow);
    container.appendChild(slider);

    lightRadiusSlider = slider;
    lightRadiusValue = valueDisplay;
    return container;
  }

  function createLightColorButtons(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    for (const { color, label, emoji } of LIGHT_COLORS) {
      const btn = document.createElement('button');
      btn.className = 'light-color-button';
      btn.dataset.color = color;
      const isSelected = color === currentLightColor;
      btn.style.cssText = `
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)'};
        border: 2px solid ${isSelected ? 'var(--interactive-accent-hover)' : 'var(--background-modifier-border)'};
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      btn.textContent = emoji;
      btn.title = label;

      btn.addEventListener('click', () => {
        callbacks.onLightColorSelect(color);
      });

      container.appendChild(btn);
    }

    return container;
  }

  function createFlickerCheckbox(): HTMLElement {
    const container = document.createElement('label');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-normal);
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = currentFlickerEnabled;
    checkbox.style.cssText = `
      margin: 0;
      cursor: pointer;
    `;

    checkbox.addEventListener('change', () => {
      callbacks.onFlickerToggle(checkbox.checked);
    });

    const labelText = document.createElement('span');
    labelText.textContent = 'Flicker Effect';

    container.appendChild(checkbox);
    container.appendChild(labelText);

    flickerCheckbox = checkbox;
    return container;
  }

  function addToRecent(creatureId: EntityId<'creature'>): void {
    // Remove if already in list
    recentCreatureIds = recentCreatureIds.filter((id) => id !== creatureId);
    // Add to front
    recentCreatureIds.unshift(creatureId);
    // Trim to max
    if (recentCreatureIds.length > MAX_RECENT_CREATURES) {
      recentCreatureIds = recentCreatureIds.slice(0, MAX_RECENT_CREATURES);
    }
    updateRecentList();
  }

  function updateSearchResults(): void {
    searchResultsContainer.innerHTML = '';

    if (!searchQuery.trim()) {
      return;
    }

    const creatures = entityRegistry.query('creature', (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    for (const creature of creatures.slice(0, 10)) {
      const isSelected = currentCreatureId === creature.id;
      const btn = createCreatureButton(creature.id, creature.name, isSelected);
      searchResultsContainer.appendChild(btn);
    }
  }

  function updateRecentList(): void {
    recentListContainer.innerHTML = '';

    if (recentCreatureIds.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
        padding: 4px 0;
      `;
      emptyMsg.textContent = 'No recent creatures';
      recentListContainer.appendChild(emptyMsg);
      return;
    }

    for (const creatureId of recentCreatureIds) {
      const creature = entityRegistry.get('creature', creatureId);
      if (creature) {
        const isSelected = currentCreatureId === creatureId;
        const btn = createCreatureButton(creatureId, creature.name, isSelected);
        recentListContainer.appendChild(btn);
      }
    }
  }

  function updateSectionVisibility(): void {
    creatureSectionEl.style.display = currentTokenType === 'creature' ? 'flex' : 'none';
    objectSectionEl.style.display = currentTokenType === 'object' ? 'flex' : 'none';
    lightSectionEl.style.display = currentTokenType === 'light' ? 'flex' : 'none';
  }

  function updateTokenTypeButtons(): void {
    const buttons = tokenTypeContainer.querySelectorAll('.token-type-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const type = btn.dataset.type as TokenType;
      const isSelected = type === currentTokenType;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected
        ? 'var(--interactive-accent-hover)'
        : 'var(--background-modifier-border)';
      btn.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)';
    });
  }

  function updateSizeButtons(): void {
    const buttons = sizeButtonsContainer.querySelectorAll('.size-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const size = btn.dataset.size as CreatureSize;
      const isSelected = size === currentSize;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected
        ? 'var(--interactive-accent-hover)'
        : 'var(--background-modifier-border)';
      btn.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)';
    });
  }

  function updateObjectButtons(): void {
    const buttons = objectButtonsContainer.querySelectorAll('.object-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const type = btn.dataset.type;
      const isSelected = type === currentObjectType;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected
        ? 'var(--interactive-accent-hover)'
        : 'var(--background-modifier-border)';
      const labelEl = btn.querySelector('span:last-child') as HTMLSpanElement;
      if (labelEl) {
        labelEl.style.color = isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)';
      }
    });
  }

  function updateLightColorButtons(): void {
    const buttons = lightColorContainer.querySelectorAll('.light-color-button');
    buttons.forEach((el) => {
      const btn = el as HTMLButtonElement;
      const color = btn.dataset.color;
      const isSelected = color === currentLightColor;
      btn.style.background = isSelected ? 'var(--interactive-accent)' : 'var(--interactive-normal)';
      btn.style.borderColor = isSelected
        ? 'var(--interactive-accent-hover)'
        : 'var(--background-modifier-border)';
    });
  }

  // =========================================================================
  // Build UI
  // =========================================================================

  function buildUI(): void {
    // Clear panel
    panelEl.innerHTML = '';

    // Header
    panelEl.appendChild(createHeader());

    // Token Type Section
    const tokenTypeSection = createSection('Token Type');
    const tokenTypeContent = tokenTypeSection.querySelector('.section-content') as HTMLElement;
    tokenTypeContainer = createTokenTypeSelector();
    tokenTypeContent.appendChild(tokenTypeContainer);
    panelEl.appendChild(tokenTypeSection);

    // Creature Section
    creatureSectionEl = document.createElement('div');
    creatureSectionEl.className = 'creature-section';
    creatureSectionEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Search
    const searchSection = createSection('Creature');
    const searchContent = searchSection.querySelector('.section-content') as HTMLElement;
    searchContent.style.cssText += `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    searchContent.appendChild(createSearchInput());

    searchResultsContainer = createSearchResults();
    searchContent.appendChild(searchResultsContainer);

    // Recent
    const recentLabel = document.createElement('div');
    recentLabel.style.cssText = `
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 4px;
    `;
    recentLabel.textContent = 'Recent:';
    searchContent.appendChild(recentLabel);

    recentListContainer = createRecentList();
    searchContent.appendChild(recentListContainer);

    searchContent.appendChild(createBrowseButton());

    creatureSectionEl.appendChild(searchSection);

    // Size
    const sizeSection = createSection('Size');
    const sizeContent = sizeSection.querySelector('.section-content') as HTMLElement;
    sizeButtonsContainer = createSizeButtons();
    sizeContent.appendChild(sizeButtonsContainer);
    creatureSectionEl.appendChild(sizeSection);

    panelEl.appendChild(creatureSectionEl);

    // Object Section
    objectSectionEl = document.createElement('div');
    objectSectionEl.className = 'object-section';
    objectSectionEl.style.display = 'none';

    const objectSection = createSection('Object');
    const objectContent = objectSection.querySelector('.section-content') as HTMLElement;
    objectButtonsContainer = createObjectButtons();
    objectContent.appendChild(objectButtonsContainer);
    objectSectionEl.appendChild(objectSection);

    panelEl.appendChild(objectSectionEl);

    // Light Section
    lightSectionEl = document.createElement('div');
    lightSectionEl.className = 'light-section';
    lightSectionEl.style.display = 'none';
    lightSectionEl.style.cssText += `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const lightSection = createSection('Light');
    const lightContent = lightSection.querySelector('.section-content') as HTMLElement;
    lightContent.style.cssText += `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    lightContent.appendChild(createLightSourceSelect());
    lightContent.appendChild(createLightRadiusSlider());

    const colorLabel = document.createElement('div');
    colorLabel.style.cssText = `
      font-size: 11px;
      color: var(--text-muted);
    `;
    colorLabel.textContent = 'Color';
    lightContent.appendChild(colorLabel);

    lightColorContainer = createLightColorButtons();
    lightContent.appendChild(lightColorContainer);
    lightContent.appendChild(createFlickerCheckbox());

    lightSectionEl.appendChild(lightSection);
    panelEl.appendChild(lightSectionEl);

    // Initial state
    updateSectionVisibility();
    updateRecentList();
  }

  // Build initial UI
  buildUI();

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    update(state: Readonly<CartographerState>): void {
      const { toolOptions } = state;

      // Update token type
      const newTokenType = toolOptions.tokenType ?? 'creature';
      if (newTokenType !== currentTokenType) {
        currentTokenType = newTokenType;
        updateTokenTypeButtons();
        updateSectionVisibility();
      }

      // Update creature selection
      if (toolOptions.selectedCreatureId !== currentCreatureId) {
        currentCreatureId = toolOptions.selectedCreatureId;
        updateSearchResults();
        updateRecentList();
      }

      // Update size
      const newSize = toolOptions.selectedCreatureSize ?? 'M';
      if (newSize !== currentSize) {
        currentSize = newSize;
        updateSizeButtons();
      }

      // Update object selection
      if (toolOptions.selectedObjectType !== currentObjectType) {
        currentObjectType = toolOptions.selectedObjectType;
        updateObjectButtons();
      }

      // Update light source
      const newLightSource = toolOptions.lightSource ?? 'torch';
      if (newLightSource !== currentLightSource) {
        currentLightSource = newLightSource;
        lightSourceSelect.value = currentLightSource;
      }

      // Update light radius
      const newLightRadius = toolOptions.lightRadius ?? 40;
      if (newLightRadius !== currentLightRadius) {
        currentLightRadius = newLightRadius;
        lightRadiusSlider.value = String(currentLightRadius);
        lightRadiusValue.textContent = `${currentLightRadius}ft`;
      }

      // Update light color
      const newLightColor = toolOptions.lightColor ?? '#FFD700';
      if (newLightColor !== currentLightColor) {
        currentLightColor = newLightColor;
        updateLightColorButtons();
      }

      // Update flicker
      const newFlicker = toolOptions.lightFlicker ?? true;
      if (newFlicker !== currentFlickerEnabled) {
        currentFlickerEnabled = newFlicker;
        flickerCheckbox.checked = currentFlickerEnabled;
      }
    },

    dispose(): void {
      panelEl.remove();
    },
  };
}
