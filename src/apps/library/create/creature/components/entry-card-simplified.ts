// Simplified entry-card.ts - Component system only, no legacy dual-system
// This version removes ~700 lines of duplicate code by eliminating the legacy system

import { createTextInput, createSelectDropdown, createTextArea, createNumberInput } from "../../shared/form-controls";
import { EntryAutoCalculator } from "../../shared/auto-calc";
import type { CreatureEntry, SpellGroup } from "../entry-model";
import { inferEntryType, type EntryType } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_ABILITY_SELECTIONS, CREATURE_SAVE_OPTIONS, CREATURE_ABILITY_LABELS } from "../presets";
import { findEntryPresets, type EntryPreset } from "../entry-presets";
import { setIcon } from "obsidian";
import { createAttackComponent } from "./attack-component";
import { createSaveComponent } from "./save-component";
import { createDamageComponent, type DamageInstance, parseDamageString, damageInstancesToString } from "./damage-component";

// Component types and interfaces (unchanged)
export type ComponentType = 'attack' | 'save' | 'damage' | 'condition' | 'area' | 'recharge' | 'uses';

export interface EntryComponent {
  type: ComponentType;
  id: string;
  data: ComponentData;
}

export type ComponentData =
  | AttackComponentData | SaveComponentData | DamageComponentData
  | ConditionComponentData | AreaComponentData | RechargeComponentData | UsesComponentData;

export interface AttackComponentData {
  type: 'attack';
  to_hit?: string;
  to_hit_from?: any;
  reach?: string;
  target?: string;
}

export interface SaveComponentData {
  type: 'save';
  save_ability?: string;
  save_dc?: number;
  save_effect?: string;
}

export interface DamageComponentData {
  type: 'damage';
  damage?: string;
  damage_from?: any;
  damages?: DamageInstance[];
}

export interface ConditionComponentData {
  type: 'condition';
  condition: string;
  duration?: string;
  save_at_end?: boolean;
}

export interface AreaComponentData {
  type: 'area';
  area_type: 'line' | 'cone' | 'sphere' | 'cube' | 'cylinder' | 'custom';
  size: string;
}

export interface RechargeComponentData {
  type: 'recharge';
  recharge: string;
}

export interface UsesComponentData {
  type: 'uses';
  uses: string;
}

export interface CreatureEntryWithComponents extends CreatureEntry {
  components?: EntryComponent[];
}

export interface EntryCardOptions {
  entry: CreatureEntryWithComponents;
  index: number;
  data: StatblockData;
  onDelete: () => void;
  onUpdate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  shouldFocus?: boolean;
}

interface ComponentTypeMetadata {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
  category: 'combat' | 'effects' | 'meta';
}

const COMPONENT_TYPES: ComponentTypeMetadata[] = [
  { type: 'attack', label: 'Attack Roll', icon: 'sword', description: 'To hit, reach/range, and target', category: 'combat' },
  { type: 'damage', label: 'Damage', icon: 'zap', description: 'Damage dice, type, and effects', category: 'combat' },
  { type: 'save', label: 'Saving Throw', icon: 'shield', description: 'Save DC and effects', category: 'combat' },
  { type: 'condition', label: 'Condition', icon: 'alert-circle', description: 'Apply conditions like poisoned, stunned', category: 'effects' },
  { type: 'area', label: 'Area of Effect', icon: 'circle-dashed', description: 'Cone, sphere, line, etc.', category: 'combat' },
  { type: 'recharge', label: 'Recharge', icon: 'refresh-cw', description: 'Recharge 5-6, daily limits', category: 'meta' },
  { type: 'uses', label: 'Limited Uses', icon: 'hash', description: 'Number of uses per day/rest', category: 'meta' }
];

// Utility functions
function generateComponentId(): string {
  return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createDefaultComponentData(type: ComponentType): ComponentData {
  switch (type) {
    case 'attack': return { type: 'attack' };
    case 'save': return { type: 'save' };
    case 'damage': return { type: 'damage', damages: [] };
    case 'condition': return { type: 'condition', condition: '' };
    case 'area': return { type: 'area', area_type: 'sphere', size: '20 ft.' };
    case 'recharge': return { type: 'recharge', recharge: 'Recharge 5-6' };
    case 'uses': return { type: 'uses', uses: '1/Day' };
  }
}

// One-time migration from legacy fields to components
function ensureComponentsExist(entry: CreatureEntryWithComponents): void {
  if (entry.components && entry.components.length > 0) return;

  entry.components = [];

  // Migrate legacy fields if they exist
  if (entry.to_hit || entry.to_hit_from || entry.reach || entry.target) {
    entry.components.push({
      type: 'attack',
      id: generateComponentId(),
      data: { type: 'attack', to_hit: entry.to_hit, to_hit_from: entry.to_hit_from, reach: entry.reach, target: entry.target }
    });
  }

  if (entry.save_ability || entry.save_dc || entry.save_effect) {
    entry.components.push({
      type: 'save',
      id: generateComponentId(),
      data: { type: 'save', save_ability: entry.save_ability, save_dc: entry.save_dc, save_effect: entry.save_effect }
    });
  }

  if (entry.damage || entry.damage_from) {
    const damages = entry.damage ? parseDamageString(entry.damage) : [];
    entry.components.push({
      type: 'damage',
      id: generateComponentId(),
      data: { type: 'damage', damage: entry.damage, damage_from: entry.damage_from, damages }
    });
  }

  if (entry.recharge) {
    entry.components.push({
      type: 'recharge',
      id: generateComponentId(),
      data: { type: 'recharge', recharge: entry.recharge }
    });
  }
}

// Component rendering
function renderComponentContent(
  parent: HTMLElement,
  component: EntryComponent,
  entry: CreatureEntryWithComponents,
  data: StatblockData,
  onUpdate: () => void
): void {
  switch (component.type) {
    case 'attack':
      renderAttackComponent(parent, component.data as AttackComponentData, entry, data, onUpdate);
      break;
    case 'save':
      renderSaveComponent(parent, component.data as SaveComponentData, entry, data, onUpdate);
      break;
    case 'damage':
      renderDamageComponent(parent, component.data as DamageComponentData, entry, data, onUpdate);
      break;
    case 'condition':
      renderConditionComponent(parent, component.data as ConditionComponentData, onUpdate);
      break;
    case 'area':
      renderAreaComponent(parent, component.data as AreaComponentData, onUpdate);
      break;
    case 'recharge':
      renderRechargeComponent(parent, component.data as RechargeComponentData, onUpdate);
      break;
    case 'uses':
      renderUsesComponent(parent, component.data as UsesComponentData, onUpdate);
      break;
  }
}

function renderAttackComponent(
  parent: HTMLElement,
  data: AttackComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  grid.createEl('label', { text: 'To Hit' });
  createTextInput(grid, {
    placeholder: 'Auto',
    ariaLabel: 'To Hit',
    value: data.to_hit || '',
    onInput: (value) => {
      data.to_hit = value.trim() || undefined;
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'Reach/Range' });
  createTextInput(grid, {
    placeholder: '5 ft. / 30/120 ft.',
    ariaLabel: 'Reach/Range',
    value: data.reach || '',
    onInput: (value) => {
      data.reach = value.trim() || undefined;
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'Target' });
  createTextInput(grid, {
    placeholder: 'one target',
    ariaLabel: 'Target',
    value: data.target || '',
    onInput: (value) => {
      data.target = value.trim() || undefined;
      onUpdate();
    }
  });
}

function renderSaveComponent(
  parent: HTMLElement,
  data: SaveComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  grid.createEl('label', { text: 'Save' });
  createSelectDropdown(grid, {
    options: CREATURE_SAVE_OPTIONS.map(v => ({ value: v, label: v || '(none)' })),
    value: data.save_ability || '',
    onChange: (value) => {
      data.save_ability = value || undefined;
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'DC' });
  createNumberInput(grid, {
    placeholder: 'DC',
    ariaLabel: 'DC',
    value: data.save_dc,
    min: 1,
    max: 30,
    onChange: (value) => {
      data.save_dc = value;
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'On Success' });
  createTextInput(grid, {
    placeholder: 'half damage',
    ariaLabel: 'Save Effect',
    value: data.save_effect || '',
    onInput: (value) => {
      data.save_effect = value.trim() || undefined;
      onUpdate();
    }
  });
}

function renderDamageComponent(
  parent: HTMLElement,
  data: DamageComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  if (!data.damages) {
    data.damages = data.damage ? parseDamageString(data.damage) : [];
  }

  createDamageComponent(parent, {
    damages: data.damages,
    data: statblockData,
    onChange: () => {
      data.damage = damageInstancesToString(data.damages!, statblockData);
      onUpdate();
    }
  });
}

function renderConditionComponent(
  parent: HTMLElement,
  data: ConditionComponentData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  grid.createEl('label', { text: 'Condition' });
  createTextInput(grid, {
    placeholder: 'poisoned, stunned, etc.',
    ariaLabel: 'Condition',
    value: data.condition || '',
    onInput: (value) => {
      data.condition = value.trim();
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'Duration' });
  createTextInput(grid, {
    placeholder: '1 minute, until end of next turn',
    ariaLabel: 'Duration',
    value: data.duration || '',
    onInput: (value) => {
      data.duration = value.trim() || undefined;
      onUpdate();
    }
  });

  const saveCheckbox = parent.createDiv({ cls: 'sm-cc-component-checkbox' });
  const checkbox = saveCheckbox.createEl('input', { attr: { type: 'checkbox' }}) as HTMLInputElement;
  checkbox.checked = data.save_at_end || false;
  checkbox.onchange = () => {
    data.save_at_end = checkbox.checked;
    onUpdate();
  };
  saveCheckbox.createEl('label', { text: 'Can save at end of each turn' });
}

function renderAreaComponent(
  parent: HTMLElement,
  data: AreaComponentData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  grid.createEl('label', { text: 'Type' });
  createSelectDropdown(grid, {
    options: [
      { value: 'sphere', label: 'Sphere' },
      { value: 'cone', label: 'Cone' },
      { value: 'line', label: 'Line' },
      { value: 'cube', label: 'Cube' },
      { value: 'cylinder', label: 'Cylinder' },
      { value: 'custom', label: 'Custom' }
    ],
    value: data.area_type,
    onChange: (value) => {
      data.area_type = value as any;
      onUpdate();
    }
  });

  grid.createEl('label', { text: 'Size' });
  createTextInput(grid, {
    placeholder: '20 ft.',
    ariaLabel: 'Size',
    value: data.size || '',
    onInput: (value) => {
      data.size = value.trim();
      onUpdate();
    }
  });
}

function renderRechargeComponent(
  parent: HTMLElement,
  data: RechargeComponentData,
  onUpdate: () => void
): void {
  const container = parent.createDiv({ cls: 'sm-cc-component-field' });
  container.createEl('label', { text: 'Recharge' });
  createTextInput(container, {
    placeholder: 'Recharge 5-6',
    ariaLabel: 'Recharge',
    value: data.recharge || '',
    onInput: (value) => {
      data.recharge = value.trim();
      onUpdate();
    }
  });
}

function renderUsesComponent(
  parent: HTMLElement,
  data: UsesComponentData,
  onUpdate: () => void
): void {
  const container = parent.createDiv({ cls: 'sm-cc-component-field' });
  container.createEl('label', { text: 'Uses' });
  createTextInput(container, {
    placeholder: '1/Day, 3/Day each',
    ariaLabel: 'Uses',
    value: data.uses || '',
    onInput: (value) => {
      data.uses = value.trim();
      onUpdate();
    }
  });
}

// Component card creation
function createComponentCard(
  parent: HTMLElement,
  component: EntryComponent,
  entry: CreatureEntryWithComponents,
  data: StatblockData,
  onUpdate: () => void,
  onDelete: () => void,
  onMoveUp: () => void,
  onMoveDown: () => void,
  canMoveUp: boolean,
  canMoveDown: boolean
): HTMLElement {
  const metadata = COMPONENT_TYPES.find(t => t.type === component.type);
  if (!metadata) {
    console.error(`Unknown component type: ${component.type}`);
    return parent.createDiv({ cls: 'sm-cc-component-card sm-cc-component-card--error' });
  }

  const card = parent.createDiv({
    cls: `sm-cc-component-card sm-cc-component-card--${component.type}`,
    attr: { 'data-component-id': component.id }
  });

  // Header with type label and controls
  const header = card.createDiv({ cls: 'sm-cc-component-header' });

  const labelGroup = header.createDiv({ cls: 'sm-cc-component-label-group' });
  const iconEl = labelGroup.createSpan({ cls: 'sm-cc-component-icon' });
  setIcon(iconEl, metadata.icon);
  labelGroup.createSpan({ cls: 'sm-cc-component-label', text: metadata.label });

  const controls = header.createDiv({ cls: 'sm-cc-component-controls' });

  const moveUpBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn',
    attr: {
      type: 'button',
      'aria-label': 'Move Up',
      disabled: !canMoveUp ? 'true' : undefined
    }
  });
  setIcon(moveUpBtn, 'chevron-up');
  moveUpBtn.onclick = () => onMoveUp();

  const moveDownBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn',
    attr: {
      type: 'button',
      'aria-label': 'Move Down',
      disabled: !canMoveDown ? 'true' : undefined
    }
  });
  setIcon(moveDownBtn, 'chevron-down');
  moveDownBtn.onclick = () => onMoveDown();

  const duplicateBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn',
    attr: { type: 'button', 'aria-label': 'Duplicate' }
  });
  setIcon(duplicateBtn, 'copy');
  duplicateBtn.onclick = () => {
    const newComponent: EntryComponent = {
      type: component.type,
      id: generateComponentId(),
      data: structuredClone ? structuredClone(component.data) : JSON.parse(JSON.stringify(component.data))
    };
    const index = entry.components!.indexOf(component);
    entry.components!.splice(index + 1, 0, newComponent);
    onUpdate();
  };

  const deleteBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn sm-cc-component-btn--delete',
    attr: { type: 'button', 'aria-label': 'Delete' }
  });
  setIcon(deleteBtn, 'trash-2');
  deleteBtn.onclick = () => onDelete();

  // Content area
  const content = card.createDiv({ cls: 'sm-cc-component-content' });
  renderComponentContent(content, component, entry, data, onUpdate);

  return card;
}

// Component selector
function createComponentSelector(
  parent: HTMLElement,
  entry: CreatureEntryWithComponents,
  onUpdate: () => void
): void {
  const selector = parent.createDiv({ cls: 'sm-cc-component-selector' });

  const categories: { [key: string]: ComponentTypeMetadata[] } = {
    combat: [],
    effects: [],
    meta: []
  };

  COMPONENT_TYPES.forEach(type => {
    categories[type.category].push(type);
  });

  const dropdown = selector.createEl('select', { cls: 'sm-cc-component-select' });

  dropdown.createEl('option', {
    text: '+ Add Component...',
    attr: { value: '', selected: 'true', disabled: 'true' }
  });

  Object.entries(categories).forEach(([category, types]) => {
    const group = dropdown.createEl('optgroup', {
      attr: { label: category.charAt(0).toUpperCase() + category.slice(1) }
    });

    types.forEach(type => {
      group.createEl('option', {
        text: type.label,
        attr: { value: type.type }
      });
    });
  });

  dropdown.onchange = () => {
    const selectedType = dropdown.value as ComponentType;
    if (!selectedType) return;

    const newComponent: EntryComponent = {
      type: selectedType,
      id: generateComponentId(),
      data: createDefaultComponentData(selectedType)
    };

    if (!entry.components) {
      entry.components = [];
    }
    entry.components.push(newComponent);

    dropdown.value = '';
    onUpdate();
  };
}

// Main components section
function createComponentsSection(
  parent: HTMLElement,
  entry: CreatureEntryWithComponents,
  data: StatblockData,
  onUpdate: () => void
): void {
  const section = parent.createDiv({ cls: 'sm-cc-components-section' });

  const render = () => {
    section.empty();

    const container = section.createDiv({ cls: 'sm-cc-components-list' });

    if (entry.components && entry.components.length > 0) {
      entry.components.forEach((component, index) => {
        createComponentCard(
          container,
          component,
          entry,
          data,
          () => {
            onUpdate();
            render();
          },
          () => {
            entry.components!.splice(index, 1);
            onUpdate();
            render();
          },
          () => {
            if (index > 0) {
              [entry.components![index - 1], entry.components![index]] =
                [entry.components![index], entry.components![index - 1]];
              onUpdate();
              render();
            }
          },
          () => {
            if (index < entry.components!.length - 1) {
              [entry.components![index], entry.components![index + 1]] =
                [entry.components![index + 1], entry.components![index]];
              onUpdate();
              render();
            }
          },
          index > 0,
          index < entry.components!.length - 1
        );
      });
    }

    createComponentSelector(section, entry, () => {
      onUpdate();
      render();
    });
  };

  render();
}

// Details section
function createDetailsSection(
  parent: HTMLElement,
  entry: CreatureEntry,
  onUpdate: () => void
): void {
  const section = parent.createDiv({ cls: "sm-cc-entry-section sm-cc-entry-section--details" });
  section.createEl("label", { cls: "sm-cc-entry-label", text: "Details" });

  createTextArea(section, {
    className: "sm-cc-entry-text",
    placeholder: "Details (Markdown)",
    ariaLabel: "Details",
    value: entry.text || "",
    onInput: (value) => {
      entry.text = value;
      onUpdate();
    },
  });
}

// Card header creation
function createCardHeader(
  parent: HTMLElement,
  entry: CreatureEntry,
  options: EntryCardOptions
): void {
  const head = parent.createDiv({ cls: "sm-cc-entry-head" });

  // Category badge
  const categoryText = entry.category || "action";
  const badge = head.createEl("span", {
    cls: `sm-cc-entry-badge sm-cc-entry-badge--${categoryText}`,
    text: categoryText.toUpperCase(),
  });

  // Name input
  const nameBox = head.createDiv({ cls: "sm-cc-entry-name-box" });
  const nameInput = createTextInput(nameBox, {
    className: "sm-cc-entry-name",
    placeholder: "Entry Name",
    ariaLabel: "Entry Name",
    value: entry.name || "",
    onInput: (value) => {
      entry.name = value;
      options.onUpdate();
    },
  });

  if (options.shouldFocus) {
    setTimeout(() => nameInput.focus(), 0);
  }

  // Action buttons
  const actions = head.createDiv({ cls: "sm-cc-entry-actions" });

  if (options.onMoveUp) {
    const moveUpBtn = actions.createEl("button", {
      cls: "sm-cc-entry-move-btn",
      attr: {
        type: "button",
        "aria-label": "Move Up",
        disabled: !options.canMoveUp ? "true" : undefined
      },
    });
    setIcon(moveUpBtn, "chevron-up");
    moveUpBtn.onclick = () => options.onMoveUp!();
  }

  if (options.onMoveDown) {
    const moveDownBtn = actions.createEl("button", {
      cls: "sm-cc-entry-move-btn",
      attr: {
        type: "button",
        "aria-label": "Move Down",
        disabled: !options.canMoveDown ? "true" : undefined
      },
    });
    setIcon(moveDownBtn, "chevron-down");
    moveDownBtn.onclick = () => options.onMoveDown!();
  }

  const deleteBtn = actions.createEl("button", {
    cls: "sm-cc-entry-delete",
    text: "×",
    attr: { type: "button", "aria-label": "Delete Entry" },
  });
  deleteBtn.onclick = () => options.onDelete();
}

// Main entry card creation - SIMPLIFIED
export function createEntryCard(
  parent: HTMLElement,
  options: EntryCardOptions
): HTMLDivElement {
  const { entry, data, onUpdate } = options;

  // Force migration to components
  ensureComponentsExist(entry);

  // Create card
  const card = parent.createDiv({
    cls: `sm-cc-entry-card sm-cc-entry-card--type-${inferEntryType(entry)}`,
  });

  // Header
  createCardHeader(card, entry, options);

  // Components (only system now)
  createComponentsSection(card, entry, data, onUpdate);

  // Details
  createDetailsSection(card, entry, onUpdate);

  return card;
}