// src/apps/library/create/creature/components/entry-card.ts
// Reusable components for Entry Cards in Creature Creator with dynamic component system

import {
  createNumberInput,
  createSelectDropdown,
  createTextArea,
  createTextInput,
  type EntryCardConfigFactory,
  type EntryCardContentOptions,
} from "../../../../../ui/workmode/create";
import type { CreatureEntry, SpellGroup } from "../entry-model";
import { inferEntryType, type EntryType } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_ABILITY_SELECTIONS, CREATURE_SAVE_OPTIONS, CREATURE_ABILITY_LABELS } from "../presets";
import { findEntryPresets, type EntryPreset } from "../entry-presets";
import { setIcon } from "obsidian";
import { createAttackComponent, createSaveComponent, createDamageComponent, type DamageInstance, parseDamageString, damageInstancesToString } from "./entry-helpers";

/**
 * Component type identifiers
 */
export type ComponentType =
  | 'attack'
  | 'save'
  | 'damage'
  | 'condition'
  | 'area'
  | 'recharge'
  | 'uses';

/**
 * Base interface for all entry components
 */
export interface EntryComponent {
  type: ComponentType;
  id: string;
  data: ComponentData;
}

/**
 * Union type for all component data types
 */
export type ComponentData =
  | AttackComponentData
  | SaveComponentData
  | DamageComponentData
  | ConditionComponentData
  | AreaComponentData
  | RechargeComponentData
  | UsesComponentData;

/**
 * Attack component data
 */
export interface AttackComponentData {
  type: 'attack';
  to_hit?: string;
  to_hit_from?: any;
  reach?: string;
  target?: string;
}

/**
 * Save component data
 */
export interface SaveComponentData {
  type: 'save';
  save_ability?: string;
  save_dc?: number;
  save_effect?: string;
}

/**
 * Damage component data
 */
export interface DamageComponentData {
  type: 'damage';
  damage?: string;
  damage_from?: any;
  damages?: DamageInstance[];
}

/**
 * Condition component data
 */
export interface ConditionComponentData {
  type: 'condition';
  condition: string;
  duration?: string;
  save_at_end?: boolean;
}

/**
 * Area component data
 */
export interface AreaComponentData {
  type: 'area';
  area_type: 'line' | 'cone' | 'sphere' | 'cube' | 'cylinder' | 'custom';
  size: string;
}

/**
 * Recharge component data
 */
export interface RechargeComponentData {
  type: 'recharge';
  recharge: string;
}

/**
 * Uses component data
 */
export interface UsesComponentData {
  type: 'uses';
  uses: string;
}

/**
 * Extended CreatureEntry with components support
 */
export interface CreatureEntryWithComponents extends CreatureEntry {
  components?: EntryComponent[];
}

/**
 * Component type metadata for UI rendering
 */
interface ComponentTypeMetadata {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
  category: 'combat' | 'effects' | 'meta';
}

/**
 * Available component types with metadata
 */
const COMPONENT_TYPES: ComponentTypeMetadata[] = [
  {
    type: 'attack',
    label: 'Attack Roll',
    icon: 'sword',
    description: 'To hit, reach/range, and target',
    category: 'combat'
  },
  {
    type: 'damage',
    label: 'Damage',
    icon: 'zap',
    description: 'Damage dice, type, and effects',
    category: 'combat'
  },
  {
    type: 'save',
    label: 'Saving Throw',
    icon: 'shield',
    description: 'Save DC and effects',
    category: 'combat'
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: 'alert-circle',
    description: 'Apply conditions like poisoned, stunned',
    category: 'effects'
  },
  {
    type: 'area',
    label: 'Area of Effect',
    icon: 'circle-dashed',
    description: 'Cone, sphere, line, etc.',
    category: 'combat'
  },
  {
    type: 'recharge',
    label: 'Recharge',
    icon: 'refresh-cw',
    description: 'Recharge 5-6, daily limits',
    category: 'meta'
  },
  {
    type: 'uses',
    label: 'Limited Uses',
    icon: 'hash',
    description: 'Number of uses per day/rest',
    category: 'meta'
  }
];

/**
 * Generates a unique ID for a component
 */
function generateComponentId(): string {
  return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a default component data object based on type
 */
function createDefaultComponentData(type: ComponentType): ComponentData {
  switch (type) {
    case 'attack':
      return { type: 'attack' };
    case 'save':
      return { type: 'save' };
    case 'damage':
      return { type: 'damage', damages: [] };
    case 'condition':
      return { type: 'condition', condition: '' };
    case 'area':
      return { type: 'area', area_type: 'sphere', size: '20 ft.' };
    case 'recharge':
      return { type: 'recharge', recharge: 'Recharge 5-6' };
    case 'uses':
      return { type: 'uses', uses: '1/Day' };
  }
}

/**
 * Migrates legacy entry data to component system
 */
function migrateEntryToComponents(entry: CreatureEntryWithComponents): void {
  // Skip if already has components
  if (entry.components && entry.components.length > 0) return;

  entry.components = [];

  // Migrate attack data
  if (entry.to_hit || entry.to_hit_from || entry.reach || entry.target) {
    entry.components.push({
      type: 'attack',
      id: generateComponentId(),
      data: {
        type: 'attack',
        to_hit: entry.to_hit,
        to_hit_from: entry.to_hit_from,
        reach: entry.reach,
        target: entry.target
      }
    });
  }

  // Migrate save data
  if (entry.save_ability || entry.save_dc || entry.save_effect) {
    entry.components.push({
      type: 'save',
      id: generateComponentId(),
      data: {
        type: 'save',
        save_ability: entry.save_ability,
        save_dc: entry.save_dc,
        save_effect: entry.save_effect
      }
    });
  }

  // Migrate damage data
  if (entry.damage || entry.damage_from) {
    const damages = entry.damage ? parseDamageString(entry.damage) : [];
    entry.components.push({
      type: 'damage',
      id: generateComponentId(),
      data: {
        type: 'damage',
        damage: entry.damage,
        damage_from: entry.damage_from,
        damages
      }
    });
  }

  // Migrate recharge data
  if (entry.recharge) {
    entry.components.push({
      type: 'recharge',
      id: generateComponentId(),
      data: {
        type: 'recharge',
        recharge: entry.recharge
      }
    });
  }
}

// Removed syncComponentsToEntry - components are now the single source of truth

// Removed setupCollapsibleSection - only used by legacy sections

/**
 * Creates a component card with controls
 */
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

  // Icon and label
  const labelGroup = header.createDiv({ cls: 'sm-cc-component-label-group' });
  const iconEl = labelGroup.createSpan({ cls: 'sm-cc-component-icon' });
  setIcon(iconEl, metadata.icon);
  labelGroup.createSpan({ cls: 'sm-cc-component-label', text: metadata.label });

  // Controls
  const controls = header.createDiv({ cls: 'sm-cc-component-controls' });

  // Move up button
  const moveUpBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn',
    attr: {
      type: 'button',
      'aria-label': 'Move Up',
      disabled: !canMoveUp ? 'true' : undefined
    }
  });
  setIcon(moveUpBtn, 'chevron-up');
  moveUpBtn.onclick = onMoveUp;

  // Move down button
  const moveDownBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn',
    attr: {
      type: 'button',
      'aria-label': 'Move Down',
      disabled: !canMoveDown ? 'true' : undefined
    }
  });
  setIcon(moveDownBtn, 'chevron-down');
  moveDownBtn.onclick = onMoveDown;

  // Duplicate button
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

  // Delete button
  const deleteBtn = controls.createEl('button', {
    cls: 'sm-cc-component-btn sm-cc-component-btn--delete',
    attr: { type: 'button', 'aria-label': 'Delete' }
  });
  setIcon(deleteBtn, 'trash-2');
  deleteBtn.onclick = onDelete;

  // Content area
  const content = card.createDiv({ cls: 'sm-cc-component-content' });

  // Render component-specific UI
  renderComponentContent(content, component, entry, data, onUpdate);

  return card;
}

/**
 * Renders the content for a specific component type
 */
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

/**
 * Renders attack component UI
 */
function renderAttackComponent(
  parent: HTMLElement,
  data: AttackComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  // To Hit
  grid.createEl('label', { text: 'To Hit' });
  const toHitInput = createTextInput(grid, {
    placeholder: 'Auto',
    ariaLabel: 'To Hit',
    value: data.to_hit || '',
    onInput: (value) => {
      data.to_hit = value.trim() || undefined;
      onUpdate();
    }
  });

  // Reach/Range
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

  // Target
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

/**
 * Renders save component UI
 */
function renderSaveComponent(
  parent: HTMLElement,
  data: SaveComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  // Save Ability
  grid.createEl('label', { text: 'Save' });
  createSelectDropdown(grid, {
    options: CREATURE_SAVE_OPTIONS.map(v => ({ value: v, label: v || '(none)' })),
    value: data.save_ability || '',
    onChange: (value) => {
      data.save_ability = value || undefined;
      onUpdate();
    }
  });

  // Save DC
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

  // Save Effect
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

/**
 * Renders damage component UI
 */
function renderDamageComponent(
  parent: HTMLElement,
  data: DamageComponentData,
  entry: CreatureEntry,
  statblockData: StatblockData,
  onUpdate: () => void
): void {
  // Initialize damages array if not present
  if (!data.damages) {
    data.damages = data.damage ? parseDamageString(data.damage) : [];
  }

  createDamageComponent(parent, {
    damages: data.damages,
    data: statblockData,
    onChange: () => {
      // Sync damage string
      data.damage = damageInstancesToString(data.damages!, statblockData);
      onUpdate();
    }
  });
}

/**
 * Renders condition component UI
 */
function renderConditionComponent(
  parent: HTMLElement,
  data: ConditionComponentData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  // Condition name
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

  // Duration
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

  // Save at end
  const saveCheckbox = parent.createDiv({ cls: 'sm-cc-component-checkbox' });
  const checkbox = saveCheckbox.createEl('input', {
    attr: { type: 'checkbox' }
  }) as HTMLInputElement;
  checkbox.checked = data.save_at_end || false;
  checkbox.onchange = () => {
    data.save_at_end = checkbox.checked;
    onUpdate();
  };
  saveCheckbox.createEl('label', { text: 'Can save at end of each turn' });
}

/**
 * Renders area component UI
 */
function renderAreaComponent(
  parent: HTMLElement,
  data: AreaComponentData,
  onUpdate: () => void
): void {
  const grid = parent.createDiv({ cls: 'sm-cc-component-grid' });

  // Area type
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

  // Size
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

/**
 * Renders recharge component UI
 */
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

/**
 * Renders uses component UI
 */
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

/**
 * Creates the component selector dropdown
 */
function createComponentSelector(
  parent: HTMLElement,
  entry: CreatureEntryWithComponents,
  onUpdate: () => void
): void {
  const selector = parent.createDiv({ cls: 'sm-cc-component-selector' });

  // Group by category
  const categories: { [key: string]: ComponentTypeMetadata[] } = {
    combat: [],
    effects: [],
    meta: []
  };

  COMPONENT_TYPES.forEach(type => {
    categories[type.category].push(type);
  });

  const dropdown = selector.createEl('select', { cls: 'sm-cc-component-select' });

  // Placeholder option
  const placeholder = dropdown.createEl('option', {
    text: '+ Add Component...',
    attr: { value: '', selected: 'true', disabled: 'true' }
  });

  // Add options grouped by category
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

    // Create new component
    const newComponent: EntryComponent = {
      type: selectedType,
      id: generateComponentId(),
      data: createDefaultComponentData(selectedType)
    };

    // Add to entry
    if (!entry.components) {
      entry.components = [];
    }
    entry.components.push(newComponent);

    // Reset dropdown
    dropdown.value = '';

    // Trigger update
    onUpdate();
  };
}

/**
 * Creates the dynamic components section
 */
function createComponentsSection(
  parent: HTMLElement,
  entry: CreatureEntryWithComponents,
  data: StatblockData,
  onUpdate: () => void
): void {
  // Migrate legacy data to components
  migrateEntryToComponents(entry);

  const section = parent.createDiv({ cls: 'sm-cc-components-section' });

  // Render function
  const render = () => {
    section.empty();

    // Components container
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
            // Move up
            if (index > 0) {
              [entry.components![index - 1], entry.components![index]] =
                [entry.components![index], entry.components![index - 1]];
              onUpdate();
              render();
            }
          },
          () => {
            // Move down
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

    // Component selector
    createComponentSelector(section, entry, () => {
      onUpdate();
      render();
    });
  };

  render();
}

// Removed legacy sections (createAttackSection, createSaveSection, createMetaSection)
// These are replaced by the component system

/**
 * Creates the details section (Text description)
 */
export function createDetailsSection(
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

/**
 * Creates the spellcasting section (Spell Ability, DC Override, Attack Override, Spell Groups)
 */
export function createSpellcastingSection(
  parent: HTMLElement,
  entry: CreatureEntry,
  data: StatblockData,
  onUpdate: () => void
): void {
  const section = parent.createDiv({ cls: "sm-cc-entry-section sm-cc-entry-section--spellcasting" });

  // Initialize spellGroups if not present
  if (!entry.spellGroups) {
    entry.spellGroups = [];
  }

  // Header row with spell ability and overrides
  const headerGrid = section.createDiv({ cls: "sm-cc-entry-grid" });

  // Spell Ability
  headerGrid.createEl("label", { text: "Spell Ability" });
  const spellAbilityHandle = createSelectDropdown(headerGrid, {
    options: [
      { value: "", label: "(none)" },
      ...CREATURE_ABILITY_LABELS.map((label) => ({
        value: label.toLowerCase(),
        label
      })),
    ],
    value: entry.spellAbility || "",
    onChange: (value) => {
      entry.spellAbility = (value || undefined) as any;
      onUpdate();
    },
  });

  // DC Override
  headerGrid.createEl("label", { text: "DC Override" });
  createNumberInput(headerGrid, {
    placeholder: "Auto",
    ariaLabel: "DC Override",
    value: entry.spellDcOverride,
    min: 1,
    max: 30,
    onChange: (value) => {
      entry.spellDcOverride = value;
      onUpdate();
    },
  });

  // Attack Bonus Override
  headerGrid.createEl("label", { text: "Attack Override" });
  const attackOverrideInput = headerGrid.createEl("input", {
    cls: "sm-cc-input",
    attr: {
      type: "text",
      placeholder: "Auto",
      "aria-label": "Attack Override"
    },
  }) as HTMLInputElement;
  attackOverrideInput.value = entry.spellAttackOverride !== undefined ? String(entry.spellAttackOverride) : "";
  attackOverrideInput.oninput = () => {
    const val = attackOverrideInput.value.trim();
    entry.spellAttackOverride = val ? parseInt(val, 10) : undefined;
    onUpdate();
  };
  (attackOverrideInput.style as any).width = "6ch";

  // Spell Groups container
  const groupsContainer = section.createDiv({ cls: "sm-cc-spellcasting-groups" });

  // Helper to render all spell groups
  const renderAllGroups = () => {
    groupsContainer.empty();

    // Group types in order: at-will, per-day, then levels 1-9
    const groupsByType = {
      'at-will': [] as SpellGroup[],
      'per-day': [] as SpellGroup[],
      'level': [] as SpellGroup[],
    };

    // Categorize existing groups
    entry.spellGroups?.forEach(group => {
      if (groupsByType[group.type]) {
        groupsByType[group.type].push(group);
      }
    });

    // Sort level groups by level
    groupsByType.level.sort((a, b) => (a.level || 0) - (b.level || 0));

    // Render At-Will groups
    groupsByType['at-will'].forEach((group, index) => {
      renderSpellGroup(groupsContainer, group, index, 'at-will');
    });

    // Render Per-Day groups
    groupsByType['per-day'].forEach((group, index) => {
      renderSpellGroup(groupsContainer, group, index, 'per-day');
    });

    // Render Level groups
    groupsByType.level.forEach((group, index) => {
      renderSpellGroup(groupsContainer, group, index, 'level');
    });

    // Add buttons for creating new groups
    const addButtonsRow = groupsContainer.createDiv({ cls: "sm-cc-spellcasting-add-buttons" });

    const addAtWillBtn = addButtonsRow.createEl("button", {
      cls: "sm-cc-button",
      text: "+ At-Will Group",
      attr: { type: "button" },
    });
    addAtWillBtn.onclick = () => {
      entry.spellGroups!.push({
        type: 'at-will',
        label: 'At Will',
        spells: [],
      });
      renderAllGroups();
      onUpdate();
    };

    const addPerDayBtn = addButtonsRow.createEl("button", {
      cls: "sm-cc-button",
      text: "+ Per-Day Group",
      attr: { type: "button" },
    });
    addPerDayBtn.onclick = () => {
      entry.spellGroups!.push({
        type: 'per-day',
        label: '1/Day each',
        spells: [],
      });
      renderAllGroups();
      onUpdate();
    };

    const addLevelBtn = addButtonsRow.createEl("button", {
      cls: "sm-cc-button",
      text: "+ Spell Level",
      attr: { type: "button" },
    });
    addLevelBtn.onclick = () => {
      // Find first unused level
      const usedLevels = new Set(
        entry.spellGroups!
          .filter(g => g.type === 'level')
          .map(g => g.level || 0)
      );
      let nextLevel = 1;
      while (usedLevels.has(nextLevel) && nextLevel <= 9) {
        nextLevel++;
      }
      if (nextLevel <= 9) {
        entry.spellGroups!.push({
          type: 'level',
          level: nextLevel,
          slots: 2,
          label: getLevelLabel(nextLevel),
          spells: [],
        });
        renderAllGroups();
        onUpdate();
      }
    };
  };

  // Helper to render a single spell group
  const renderSpellGroup = (
    container: HTMLElement,
    group: SpellGroup,
    groupIndex: number,
    groupType: 'at-will' | 'per-day' | 'level'
  ) => {
    const groupCard = container.createDiv({ cls: `sm-cc-spell-group sm-cc-spell-group--${groupType}` });

    // Group header with title and spell count
    const groupHeader = groupCard.createDiv({ cls: "sm-cc-spell-group-header" });

    // Header left side (title/label)
    const headerLeft = groupHeader.createDiv({ cls: "sm-cc-spell-group-header-left" });

    // Group label/title
    if (groupType === 'level') {
      // Level selector
      const levelSelect = createSelectDropdown(headerLeft, {
        className: "sm-cc-spellcasting-level-select",
        options: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => ({
          value: lvl,
          label: getLevelLabel(lvl),
        })),
        value: group.level || 1,
        onChange: (value) => {
          group.level = value as number;
          group.label = getLevelLabel(value as number);
          renderAllGroups();
          onUpdate();
        },
      });

      // Slots input
      headerLeft.createSpan({ text: " - ", cls: "sm-cc-spell-group-separator" });
      const slotsInput = createNumberInput(headerLeft, {
        className: "sm-cc-spellcasting-slots",
        placeholder: "Slots",
        ariaLabel: "Spell Slots",
        value: group.slots || 0,
        min: 0,
        max: 20,
        onChange: (value) => {
          group.slots = value || 0;
          onUpdate();
        },
      });
      (slotsInput.style as any).width = "4ch";
      headerLeft.createSpan({ text: " slots", cls: "sm-cc-spell-group-suffix" });
    } else {
      // Editable label for at-will and per-day
      const labelInput = createTextInput(headerLeft, {
        className: "sm-cc-spellcasting-group-label",
        placeholder: groupType === 'at-will' ? 'At Will' : '1/Day each',
        ariaLabel: "Group Label",
        value: group.label || "",
        onInput: (value) => {
          group.label = value.trim() || undefined;
          onUpdate();
        },
      });
    }

    // Header right side (spell count + delete)
    const headerRight = groupHeader.createDiv({ cls: "sm-cc-spell-group-header-right" });

    // Spell count indicator
    const spellCount = group.spells.filter(s => s.trim().length > 0).length;
    const spellCountSpan = headerRight.createSpan({
      cls: "sm-cc-spell-count",
      text: spellCount === 1 ? "1 spell" : `${spellCount} spells`
    });

    // Delete group button
    const deleteGroupBtn = headerRight.createEl("button", {
      cls: "sm-cc-entry-delete",
      text: "×",
      attr: { type: "button", "aria-label": "Delete Group" },
    });
    deleteGroupBtn.onclick = () => {
      const actualIndex = entry.spellGroups!.indexOf(group);
      if (actualIndex !== -1) {
        entry.spellGroups!.splice(actualIndex, 1);
        renderAllGroups();
        onUpdate();
      }
    };

    // Spells list
    const spellsList = groupCard.createDiv({ cls: "sm-cc-spellcasting-spells-list" });

    const renderSpells = () => {
      spellsList.empty();

      group.spells.forEach((spell, spellIndex) => {
        const spellItem = spellsList.createDiv({ cls: "sm-cc-spell-item" });

        const spellInput = createTextInput(spellItem, {
          className: "sm-cc-spellcasting-spell-input",
          placeholder: "Enter spell name...",
          ariaLabel: "Spell name",
          value: spell,
          onInput: (value) => {
            group.spells[spellIndex] = value.trim();
            // Update spell count
            const newCount = group.spells.filter(s => s.trim().length > 0).length;
            spellCountSpan.textContent = newCount === 1 ? "1 spell" : `${newCount} spells`;
            onUpdate();
          },
        });

        // Auto-focus newly added empty spell inputs
        if (spell === "" && spellIndex === group.spells.length - 1) {
          setTimeout(() => spellInput.focus(), 0);
        }

        // Enter key to add another spell
        spellInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            group.spells.push("");
            renderSpells();
            onUpdate();
          }
        });

        const deleteSpellBtn = spellItem.createEl("button", {
          cls: "sm-cc-button-small sm-cc-spell-delete",
          text: "×",
          attr: { type: "button", "aria-label": "Delete Spell" },
        });
        deleteSpellBtn.onclick = () => {
          group.spells.splice(spellIndex, 1);
          renderSpells();
          // Update spell count
          const newCount = group.spells.filter(s => s.trim().length > 0).length;
          spellCountSpan.textContent = newCount === 1 ? "1 spell" : `${newCount} spells`;
          onUpdate();
        };
      });

      // Inline add spell button
      const addSpellInline = spellsList.createEl("button", {
        cls: "sm-cc-spell-add-inline",
        text: "+",
        attr: { type: "button", "aria-label": "Add Spell" },
      });
      addSpellInline.onclick = () => {
        group.spells.push("");
        renderSpells();
        onUpdate();
      };
    };

    renderSpells();
  };

  // Helper to get level label
  const getLevelLabel = (level: number): string => {
    const labels = ["Cantrip", "1st Level", "2nd Level", "3rd Level", "4th Level",
                    "5th Level", "6th Level", "7th Level", "8th Level", "9th Level"];
    return labels[level] || `${level}th Level`;
  };

  // Initial render
  renderAllGroups();
}

export function createCreatureEntryCardConfig(
  data: StatblockData
): EntryCardConfigFactory<CreatureEntryWithComponents> {
  return (context) => {
    const entry = context.entry;
    const currentType = inferEntryType(entry);
    const categoryText = entry.category || "action";
    const handleUpdate = () => context.requestRender();

    const config: EntryCardContentOptions<CreatureEntryWithComponents> = {
      type: currentType,
      badge: { text: categoryText.toUpperCase(), variant: categoryText },
      nameBoxClassName: "sm-preset-box",
      shouldFocus: context.shouldFocus,
      actions: {
        remove: context.remove,
        moveUp: context.moveUp,
        moveDown: context.moveDown,
        canMoveUp: context.canMoveUp,
        canMoveDown: context.canMoveDown,
        deleteLabel: "×",
        deleteAriaLabel: "Delete Entry",
        moveUpAriaLabel: "Move Up",
        moveDownAriaLabel: "Move Down",
      },
      renderName: (nameBox) => {
        const nameInput = createTextInput(nameBox, {
          className: "sm-cc-entry-name sm-preset-input",
          placeholder: "Entry Name",
          ariaLabel: "Entry Name",
          value: entry.name || "",
          onInput: (value) => {
            entry.name = value;
            handleUpdate();
          },
        });

        let presetMenu: HTMLElement | null = null;
        let selectedPresetIndex = -1;

        const hidePresetMenu = () => {
          nameBox.removeClass("is-open");
          selectedPresetIndex = -1;
        };

        const applyPreset = (preset: EntryPreset) => {
          entry.name = preset.name;
          if (preset.text !== undefined) entry.text = preset.text;
          if (preset.to_hit !== undefined) entry.to_hit = preset.to_hit;
          if (preset.reach !== undefined) entry.reach = preset.reach;
          if (preset.target !== undefined) entry.target = preset.target;
          if (preset.damage !== undefined) entry.damage = preset.damage;
          if (preset.save_ability !== undefined) entry.save_ability = preset.save_ability;
          if (preset.save_dc !== undefined) entry.save_dc = preset.save_dc;
          if (preset.save_effect !== undefined) entry.save_effect = preset.save_effect;
          if (preset.recharge !== undefined) entry.recharge = preset.recharge;
          nameInput.value = preset.name;
          handleUpdate();
        };

        const showPresetMenu = (query: string) => {
          const presets = findEntryPresets(query);
          if (presets.length === 0) {
            hidePresetMenu();
            return;
          }

          if (!presetMenu) {
            presetMenu = nameBox.createDiv({ cls: "sm-preset-menu" });
          }
          presetMenu.empty();
          nameBox.addClass("is-open");

          presets.forEach((preset, idx) => {
            const item = presetMenu!.createDiv({
              cls: idx === selectedPresetIndex ? "sm-preset-item is-selected" : "sm-preset-item",
            });
            item.textContent = preset.name;
            item.onclick = () => {
              applyPreset(preset);
              hidePresetMenu();
            };
          });
        };

        nameInput.addEventListener("input", () => {
          const query = nameInput.value.trim();
          if (query.length > 1) {
            showPresetMenu(query);
          } else {
            hidePresetMenu();
          }
        });

        nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
          if (!presetMenu || !nameBox.hasClass("is-open")) return;
          const items = presetMenu.querySelectorAll(".sm-preset-item");
          if (items.length === 0) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedPresetIndex = Math.min(selectedPresetIndex + 1, items.length - 1);
            items.forEach((el, i) => {
              el.toggleClass("is-selected", i === selectedPresetIndex);
            });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedPresetIndex = Math.max(selectedPresetIndex - 1, 0);
            items.forEach((el, i) => {
              el.toggleClass("is-selected", i === selectedPresetIndex);
            });
          } else if (e.key === "Enter" && selectedPresetIndex >= 0) {
            e.preventDefault();
            const presets = findEntryPresets(nameInput.value.trim());
            if (presets[selectedPresetIndex]) {
              applyPreset(presets[selectedPresetIndex]);
              hidePresetMenu();
            }
          } else if (e.key === "Escape") {
            hidePresetMenu();
          }
        });

        nameInput.addEventListener("blur", () => {
          window.setTimeout(() => hidePresetMenu(), 200);
        });

        return nameInput;
      },
      renderBody: (card) => {
        migrateEntryToComponents(entry);
        createComponentsSection(card, entry, data, handleUpdate);
        if (currentType === "spellcasting") {
          createSpellcastingSection(card, entry, data, handleUpdate);
        }
        createDetailsSection(card, entry, handleUpdate);
      },
    };

    return config;
  };
}
