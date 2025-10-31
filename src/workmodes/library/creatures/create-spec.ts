// src/workmodes/library/entities/creatures/create-spec.ts
// Declarative field specification for creature creation using the global modal system

import { setIcon } from "obsidian";
import type { CreateSpec, AnyFieldSpec, DataSchema } from "../../../features/data-manager/types";
import type { StatblockData } from "./types";
import { statblockToMarkdown } from "./serializer";
import { debugLogger } from "../../../app/debug-logger";
import { renderFieldControl } from "../../../features/data-manager/fields/field-utils";
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_MOVEMENT_TYPES,
  CREATURE_ABILITIES,
  CREATURE_SKILLS,
  CREATURE_DAMAGE_PRESETS,
  CREATURE_CONDITION_PRESETS,
  CREATURE_LANGUAGE_PRESETS,
  CREATURE_SENSE_PRESETS,
  CREATURE_SENSE_TYPES,
  CREATURE_PASSIVE_PRESETS,
  CREATURE_ENTRY_CATEGORIES,
} from "./constants";
// Note: Entry card config removed - entries now use template-based rendering

// ============================================================================
// SCHEMA
// ============================================================================

// Simple passthrough schema (validation can be added later if needed)
const creatureSchema: DataSchema<StatblockData> = {
  parse: (data: unknown) => data as StatblockData,
  safeParse: (data: unknown) => {
    try {
      return { success: true, data: data as StatblockData };
    } catch (error) {
      return { success: false, error };
    }
  },
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

// Section 1: Grunddaten (Basic Info)
const basicInfoFields: AnyFieldSpec[] = [
  {
    id: "name",
    label: "Name",
    type: "text",
    required: true,
    placeholder: "Kreaturname eingeben...",
  },
  {
    id: "size",
    label: "Größe",
    type: "select",
    options: CREATURE_SIZES.map(s => ({ value: s, label: s })),
    default: "Medium",
  },
  {
    id: "type",
    label: "Typ",
    type: "select",
    options: CREATURE_TYPES.map(t => ({ value: t, label: t })),
  },
  {
    id: "typeTags",
    label: "Typ-Tags",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Tag hinzufügen...",
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "alignmentLawChaos",
    label: "Gesetz/Chaos",
    type: "select",
    options: CREATURE_ALIGNMENT_LAW_CHAOS.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentGoodEvil",
    label: "Gut/Böse",
    type: "select",
    options: CREATURE_ALIGNMENT_GOOD_EVIL.map(a => ({ value: a, label: a })),
  },
  {
    id: "alignmentOverride",
    label: "Gesinnung (Freiform)",
    type: "text",
    placeholder: "z.B. unaligned",
  },
];

// Section 2: Kampfwerte (Combat Stats)
const combatStatsFields: AnyFieldSpec[] = [
  {
    id: "ac",
    label: "AC",
    type: "text",
    placeholder: "z.B. 15 (Lederrüstung)",
  },
  {
    id: "initiative",
    label: "INI",
    type: "text",
    placeholder: "z.B. +2",
  },
  {
    id: "hp",
    label: "TP",
    type: "text",
    placeholder: "z.B. 45",
  },
  {
    id: "hitDice",
    label: "TW",
    type: "text",
    placeholder: "z.B. 6d8+18",
  },
  {
    id: "cr",
    label: "CR",
    type: "text",
    placeholder: "z.B. 3",
  },
  {
    id: "xp",
    label: "EP",
    type: "text",
    placeholder: "z.B. 700",
  },
  {
    id: "pb",
    label: "ÜB",
    type: "text",
    placeholder: "z.B. +2",
  },
];

// Section 3: Bewegung (Movement) - Using modular tokens with inline editing
const movementFields: AnyFieldSpec[] = [
  {
    id: "speeds",
    label: "Bewegungsraten",
    type: "tokens",
    config: {
      fields: [
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_MOVEMENT_TYPES.map(([key, label]) => ({ key, label })),
          placeholder: "Bewegungsart wählen...",
        },
        {
          id: "value",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "30",
        },
        {
          id: "hover",
          type: "checkbox",
          displayInChip: true,
          editable: true,
          icon: "⟨hover⟩",
          visibleIf: (token) => token.type === "fly",
          default: false,
        },
      ],
      primaryField: "type",
    },
    default: [],
  },
];

// Section 4: Attribute (Abilities) - Using repeating with template-based rendering
const abilitiesFields: AnyFieldSpec[] = [
  {
    id: "abilities",
    label: "",
    type: "repeating",
    config: {
      static: true,  // No add/remove/reorder controls
      synchronizeWidths: true,  // Synchronize widths across all ability rows
      fields: [
        // Heading (ability abbreviation - STR, DEX, etc.)
        {
          id: "name",
          label: "",
          type: "heading" as const,
          getValue: (data: Record<string, unknown>) => (data.key as string)?.toUpperCase() || "",
        },
        // Score
        {
          id: "score",
          label: "",
          type: "number-stepper" as const,
          min: 1,
          max: 30,
          step: 1,
          autoSizeOnInput: false,  // Suppress auto-sizing on input for width sync
        },
        // Modifier (display)
        {
          id: "mod",
          label: "",
          type: "display" as const,
          config: {
            compute: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              return mod;
            },
            prefix: (data: Record<string, unknown>) => {
              const score = data.score as number || 10;
              const mod = Math.floor((score - 10) / 2);
              return mod >= 0 ? "+" : "";
            },
            maxTokens: 3,  // Format: +/-XX (e.g., "+5", "-1")
          },
        },
        // Save Proficiency (star icon - click to toggle)
        {
          id: "saveProf",
          label: "Save",
          type: "clickable-icon" as const,
          icon: "★",
          inactiveIcon: "☆",
        },
        // Save Modifier (conditional - only visible when save checkbox is true)
        // Initial value = ability modifier + proficiency bonus
        {
          id: "saveMod",
          label: "Save",
          type: "number-stepper" as const,
          min: -10,
          max: 20,
          step: 1,
          autoSizeOnInput: false,  // Suppress auto-sizing on input for width sync
          visibleIf: (data: Record<string, unknown>) => Boolean(data.saveProf),
          config: {
            // Auto-initialize with ability modifier + PB when field becomes visible
            init: (data: Record<string, unknown>, allFormData: Record<string, unknown>) => {
              debugLogger.logField("saveMod", "init-function", "saveMod init called", data);
              const score = data.score as number || 10;
              debugLogger.logField("saveMod", "init-function", "Calculated score", { score });
              const abilityMod = Math.floor((score - 10) / 2);
              debugLogger.logField("saveMod", "init-function", "Calculated abilityMod", { abilityMod });

              // Extract PB from form data (same as skills do it)
              const pbStr = allFormData.pb as string || "+2";
              const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;
              debugLogger.logField("saveMod", "init-function", "Using PB from form", { pbStr, pb });

              const result = abilityMod + pb;
              debugLogger.logField("saveMod", "init-function", "Returning result", { result });
              return result;
            },
          },
        },
      ],
    },
    // Default: Array of ability entries (data) - template defined once above
    default: CREATURE_ABILITIES.map(ability => ({
      key: ability.key,
      label: ability.label,
      score: 10,
      saveProf: false,
      // saveMod will be auto-initialized when saveProf checkbox is checked
    })),
  },
];

// Section 4.5: Fertigkeiten (Skills) - Using modular tokens with auto-calculation
const skillsFields: AnyFieldSpec[] = [
  {
    id: "skills",
    label: "Fertigkeiten",
    type: "tokens",
    config: {
      fields: [
        {
          id: "skill",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_SKILLS.map(([name, ability]) => ({ key: name, label: name })),
          placeholder: "Fertigkeit wählen...",
        },
        {
          id: "value",
          type: "text",
          label: " ",
          displayInChip: true,
          editable: true,
          placeholder: "+0",
        },
        {
          id: "expertise",
          type: "checkbox",
          displayInChip: true,
          editable: true,
          icon: "★",
          default: false,
        },
      ],
      primaryField: "skill",
      getInitialValue: (formData, skillName) => {
        // Find the skill's associated ability
        const skillEntry = CREATURE_SKILLS.find(([name]) => name === skillName);
        if (!skillEntry) {
          return { skill: skillName, value: "+0", expertise: false };
        }

        const [, abilityKey] = skillEntry;

        // Extract PB from form data
        const pbStr = formData.pb as string || "+2";
        const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;

        // Find the ability score from abilities array
        // Support both "key" (new format) and "ability" (legacy format) fields
        const abilities = formData.abilities as Array<{key?: string; ability?: string; score: number}> || [];
        const abilityEntry = abilities.find(a => (a.key === abilityKey || a.ability === abilityKey));
        const abilityScore = abilityEntry?.score || 10;

        // Calculate modifier
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        // Calculate skill bonus (mod + PB)
        const skillBonus = abilityMod + pb;

        // Format with sign
        const sign = skillBonus >= 0 ? "+" : "";
        const valueStr = `${sign}${skillBonus}`;

        return {
          skill: skillName,
          value: valueStr,
          expertise: false,
        };
      },
      onTokenFieldChange: (token, fieldId, newValue, formData) => {
        // Only recalculate when expertise is toggled
        if (fieldId !== "expertise") return;

        const skillName = token.skill as string;
        if (!skillName) return;

        // Find the skill's associated ability
        const skillEntry = CREATURE_SKILLS.find(([name]) => name === skillName);
        if (!skillEntry) return;

        const [, abilityKey] = skillEntry;

        // Extract PB from form data
        const pbStr = formData.pb as string || "+2";
        const pb = parseInt(pbStr.replace(/[^\d-]/g, '')) || 2;

        // Find the ability score from abilities array
        const abilities = formData.abilities as Array<{key?: string; ability?: string; score: number}> || [];
        const abilityEntry = abilities.find(a => (a.key === abilityKey || a.ability === abilityKey));
        const abilityScore = abilityEntry?.score || 10;

        // Calculate modifier
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        // Calculate skill bonus: mod + PB (or 2*PB if expertise)
        const expertise = newValue as boolean;
        const pbBonus = expertise ? (2 * pb) : pb;
        const skillBonus = abilityMod + pbBonus;

        // Format with sign
        const sign = skillBonus >= 0 ? "+" : "";
        const valueStr = `${sign}${skillBonus}`;

        // Update the value field in the token
        token.value = valueStr;
      },
    },
    default: [],
  },
];

// Section 5: Sinne & Sprachen (Senses & Languages) - Using modular tokens
const sensesLanguagesFields: AnyFieldSpec[] = [
  {
    id: "sensesList",
    label: "Sinne",
    type: "tokens",
    config: {
      fields: [
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: CREATURE_SENSE_TYPES,
          placeholder: "Sinn wählen...",
        },
        {
          id: "range",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "60",
          visibleIf: (token) => Boolean(token.type),
        },
      ],
      primaryField: "type",
    },
    default: [],
  },
  {
    id: "passivesList",
    label: "Passive Werte",
    type: "tokens",
    config: {
      fields: [
        {
          id: "skill",
          type: "select",
          label: "Passive ",
          displayInChip: true,
          editable: true,
          suggestions: [
            { key: "Perception", label: "Perception" },
            { key: "Insight", label: "Insight" },
            { key: "Investigation", label: "Investigation" },
          ],
          placeholder: "Fertigkeit wählen...",
        },
        {
          id: "value",
          type: "text",
          label: " ",
          displayInChip: true,
          editable: true,
          placeholder: "Wert",
        },
      ],
      primaryField: "skill",
      // chipTemplate removed - use automatic segment rendering for editability
    },
    default: [],
  },
  {
    id: "languagesList",
    label: "Sprachen",
    type: "tokens",
    config: {
      fields: [
        {
          id: "value",
          type: "text",
          displayInChip: true,
          editable: true,
          placeholder: "Sprache hinzufügen...",
          suggestions: CREATURE_LANGUAGE_PRESETS,
          visibleIf: (token) => !token.type,
        },
        {
          id: "type",
          type: "select",
          displayInChip: true,
          editable: true,
          suggestions: [{ key: "telepathy", label: "Telepathy" }],
          placeholder: "Telepathie",
          optional: true,
          visibleIf: (token) => Boolean(token.type),
        },
        {
          id: "range",
          type: "text",
          label: ": ",
          displayInChip: true,
          editable: true,
          unit: "ft.",
          placeholder: "120",
          visibleIf: (token) => token.type === "telepathy",
        },
      ],
      primaryField: "value",
    },
    default: [],
  },
];

// Section 6: Widerstände (Resistances) - Using modular tokens
const resistancesFields: AnyFieldSpec[] = [
  {
    id: "damageVulnerabilitiesList",
    label: "Schadensanfälligkeiten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Anfälligkeit hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "damageResistancesList",
    label: "Schadenswiderstände",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Widerstand hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "damageImmunitiesList",
    label: "Schadensimmunitäten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Immunität hinzufügen...",
        suggestions: CREATURE_DAMAGE_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
  {
    id: "conditionImmunitiesList",
    label: "Zustandsimmunitäten",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Zustand hinzufügen...",
        suggestions: CREATURE_CONDITION_PRESETS,
      }],
      primaryField: "value",
    },
    default: [],
  },
];

// Section 7: Ausrüstung (Equipment)
const equipmentFields: AnyFieldSpec[] = [
  {
    id: "gearList",
    label: "Ausrüstung",
    type: "tokens",
    config: {
      fields: [{
        id: "value",
        type: "text",
        displayInChip: true,
        editable: true,
        placeholder: "Gegenstand hinzufügen...",
      }],
      primaryField: "value",
    },
    default: [],
  },
];

// Section 8: Zauber & Zauberwirken (Spells & Spellcasting) - Separated from main entries
const spellcastingFields: AnyFieldSpec[] = [
  {
    id: "spellcastingEntries",
    label: "Zauber & Zauberwirken",
    type: "repeating",
    config: {
      static: false,
      card: (context) => {
        const entry = context.entry as Record<string, unknown>;
        return {
          className: "sm-cc-spellcasting-entry",
          type: "spellcasting",
          badge: () => ({
            text: "Zauberwirken",
            variant: "spellcasting",
          }),
          renderName: (nameBox, ctx) => {
            // Simple single input for spellcasting
            const nameInput = nameBox.createEl("input", {
              value: (entry.name as string) || "",
              placeholder: "Zaubername oder Beschreibung",
              cls: "sm-cc-entry-name-input",
              attr: { type: "text" }
            });
            nameInput.addEventListener("input", () => {
              entry.name = nameInput.value;
            });
            return nameInput;
          },
          renderBody: (card, ctx) => {
            const body = card.createDiv({ cls: "sm-cc-spell-body" });
            renderSpellcastingEntry(body, entry, ctx);
          },
        };
      },
    },
    default: [],
  },
];

// Section 9: Einträge (Entries) - Using entry card system (ohne Zauber)

// ============================================================================
// COMPACT ENTRY RENDERERS
// ============================================================================

/**
 * Render attack entry in compact 2-line format
 */
function renderAttackEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Line 1: Attack type, bonus, reach/range
  const attackRow = container.createDiv({ cls: "sm-cc-entry-row" });

  // Attack type selector
  const typeSelect = attackRow.createEl("select", {
    cls: "sm-cc-compact-select",
    value: (entry['attack.type'] as string) || 'melee'
  });
  ['melee', 'ranged'].forEach(type => {
    const opt = typeSelect.createEl("option", { value: type, text: type });
    if (type === entry['attack.type']) opt.selected = true;
  });
  typeSelect.addEventListener("change", () => {
    entry['attack.type'] = typeSelect.value;
    ctx.requestRender();
  });

  // Attack bonus
  attackRow.createEl("span", { text: "+" });
  const bonusInput = attackRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['attack.bonus'] || 0),
    placeholder: "bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['attack.bonus'] = parseInt(bonusInput.value) || 0;
  });
  attackRow.createEl("span", { text: "hit," });

  // Reach or Range (conditional)
  if (entry['attack.type'] === 'melee') {
    const reachInput = attackRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.reach'] as string) || '',
      placeholder: "reach"
    });
    reachInput.addEventListener("input", () => {
      entry['attack.reach'] = reachInput.value;
    });
  } else {
    const rangeInput = attackRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.range'] as string) || '',
      placeholder: "range"
    });
    rangeInput.addEventListener("input", () => {
      entry['attack.range'] = rangeInput.value;
    });
  }

  attackRow.createEl("span", { cls: "sm-cc-separator", text: "|" });

  // Line 2: Damage (simplified)
  const damageList = (entry['attack.damage'] as any[]) || [];
  if (damageList.length > 0) {
    const firstDamage = damageList[0];
    const damageText = `${firstDamage.dice || ''}${firstDamage.bonus ? '+' + firstDamage.bonus : ''} ${firstDamage.type || ''}`;
    attackRow.createEl("span", { text: damageText, cls: "sm-cc-damage-text" });
  }

  // Add damage button
  const addDamageBtn = attackRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Damage"
  });
  addDamageBtn.addEventListener("click", () => {
    // TODO: Open modal to add damage entry
  });
}

/**
 * Render save entry in compact 2-line format
 */
function renderSaveEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const saveRow = container.createDiv({ cls: "sm-cc-entry-row" });

  // Save ability
  const abilitySelect = saveRow.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' },
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === entry['save.ability']) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['save.ability'] = abilitySelect.value;
  });

  // Save DC
  saveRow.createEl("span", { text: "DC" });
  const dcInput = saveRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['save.dc'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['save.dc'] = parseInt(dcInput.value) || 10;
  });

  // Area/targets (optional)
  if (entry['save.area']) {
    const areaInput = saveRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: entry['save.area'] as string,
      placeholder: "area"
    });
    areaInput.addEventListener("input", () => {
      entry['save.area'] = areaInput.value;
    });
  }

  saveRow.createEl("span", { cls: "sm-cc-separator", text: "|" });

  // Effects summary
  const failDamage = entry['save.onFail.damage'] as any[];
  if (failDamage && failDamage[0]) {
    saveRow.createEl("span", { text: `Fail: ${failDamage[0].dice} ${failDamage[0].type}` });
  }

  const successEffect = entry['save.onSuccess.damage'] || entry['save.onSuccess.legacyText'];
  if (successEffect) {
    saveRow.createEl("span", { text: `Success: ${successEffect}` });
  }
}

/**
 * Render multiattack entry in compact format
 */
function renderMultiattackEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const multiRow = container.createDiv({ cls: "sm-cc-entry-row" });

  const attacks = (entry['multiattack.attacks'] as any[]) || [];
  const attackText = attacks.map(a => `${a.count}x ${a.name}`).join(", ");

  if (attackText) {
    multiRow.createEl("span", { text: attackText });
  } else {
    multiRow.createEl("span", { text: "No attacks defined", cls: "sm-cc-muted" });
  }

  // Edit button for complex multiattack
  const editBtn = multiRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "Edit"
  });
  editBtn.addEventListener("click", () => {
    // TODO: Open modal to edit multiattack entry
  });
}

/**
 * Render spellcasting entry with full details
 */
function renderSpellcastingEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Configuration section
  const configSection = container.createDiv({ cls: "sm-cc-spell-config" });

  // Spellcasting ability
  configSection.createEl("span", { text: "Fähigkeit:", cls: "sm-cc-spell-label" });
  const abilitySelect = configSection.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' },
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === (entry['spellcasting.ability'] || 'int')) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['spellcasting.ability'] = abilitySelect.value;
  });

  // Save DC
  configSection.createEl("span", { text: "Zauber DC:", cls: "sm-cc-spell-label" });
  const dcInput = configSection.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['spellcasting.saveDC'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['spellcasting.saveDC'] = parseInt(dcInput.value) || 10;
  });

  // Attack bonus
  configSection.createEl("span", { text: "Angriffsbonus:", cls: "sm-cc-spell-label" });
  const bonusWrapper = configSection.createDiv({ cls: "sm-cc-entry-row" });
  bonusWrapper.createEl("span", { text: "+" });
  const bonusInput = bonusWrapper.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['spellcasting.attackBonus'] || 0),
    placeholder: "Bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['spellcasting.attackBonus'] = parseInt(bonusInput.value) || 0;
  });

  // Excluded components
  configSection.createEl("span", { text: "Ohne:", cls: "sm-cc-spell-label" });
  const componentsDiv = configSection.createDiv({ cls: "sm-cc-entry-row" });
  const excludedComponents = (entry['spellcasting.excludeComponents'] as string[]) || [];
  ['V', 'S', 'M'].forEach(comp => {
    const checkbox = componentsDiv.createEl("input", {
      type: "checkbox",
      attr: { id: `exclude-${comp}` }
    });
    checkbox.checked = excludedComponents.includes(comp);
    checkbox.addEventListener("change", () => {
      const current = (entry['spellcasting.excludeComponents'] as string[]) || [];
      if (checkbox.checked && !current.includes(comp)) {
        current.push(comp);
      } else if (!checkbox.checked) {
        const index = current.indexOf(comp);
        if (index > -1) current.splice(index, 1);
      }
      entry['spellcasting.excludeComponents'] = current;
    });
    const label = componentsDiv.createEl("label", {
      text: comp,
      attr: { for: `exclude-${comp}` },
      cls: "sm-cc-checkbox-label"
    });
    label.style.marginRight = "12px";
  });

  // Spell lists section
  const listsSection = container.createDiv({ cls: "sm-cc-spell-lists" });
  listsSection.createEl("h4", { text: "Zauberlisten", cls: "sm-cc-spell-label" });

  const spellLists = (entry['spellcasting.spellLists'] as any[]) || [];

  // Display existing spell lists
  spellLists.forEach((list, index) => {
    const listItem = listsSection.createDiv({ cls: "sm-cc-spell-list-item" });

    // Frequency
    const freqInput = listItem.createEl("input", {
      cls: "sm-cc-spell-frequency",
      value: list.frequency || "At Will",
      placeholder: "Frequency"
    });
    freqInput.addEventListener("input", () => {
      list.frequency = freqInput.value;
      ctx.requestRender();
    });

    // Spell names
    const spellsDiv = listItem.createDiv({ cls: "sm-cc-spell-names" });
    const spells = list.spells || [];
    spells.forEach((spell: string) => {
      spellsDiv.createEl("span", {
        text: spell,
        cls: "sm-cc-spell-chip"
      });
    });

    // Add spell button
    const addSpellBtn = listItem.createEl("button", {
      cls: "sm-cc-compact-btn",
      text: "+ Zauber"
    });
    addSpellBtn.addEventListener("click", () => {
      // TODO: Open modal to add spells to list
    });
  });

  // Add new spell list button
  const addListBtn = listsSection.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Neue Zauberliste"
  });
  addListBtn.addEventListener("click", () => {
    if (!entry['spellcasting.spellLists']) {
      entry['spellcasting.spellLists'] = [];
    }
    (entry['spellcasting.spellLists'] as any[]).push({
      frequency: "1/Tag",
      spells: []
    });
    ctx.requestRender();
  });
}

/**
 * Render special/trait entry - just description
 */
function renderSpecialEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Just show a text area for description
  const descRow = container.createDiv({ cls: "sm-cc-entry-row" });

  const textarea = descRow.createEl("textarea", {
    cls: "sm-cc-compact-textarea",
    placeholder: "Description...",
    value: (entry.text as string) || ''
  });
  textarea.addEventListener("input", () => {
    entry.text = textarea.value;
  });
}

// ============================================================================
// EFFECT RENDERERS FOR MODULAR SYSTEM
// ============================================================================

/**
 * Render attack effect component
 */
function renderAttackEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Angriff", cls: "sm-cc-effect-title" });

  const attackContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Attack configuration row
  const configRow = attackContent.createDiv({ cls: "sm-cc-field-row" });

  // Attack type
  const typeSelect = configRow.createEl("select", {
    cls: "sm-cc-compact-select",
    value: (entry['attack.type'] as string) || 'melee'
  });
  ['melee', 'ranged'].forEach(type => {
    const opt = typeSelect.createEl("option", { value: type, text: type });
    if (type === entry['attack.type']) opt.selected = true;
  });
  typeSelect.addEventListener("change", () => {
    entry['attack.type'] = typeSelect.value;
    ctx.requestRender();
  });

  // Attack bonus
  configRow.createEl("span", { text: "+" });
  const bonusInput = configRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['attack.bonus'] || 0),
    placeholder: "bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['attack.bonus'] = parseInt(bonusInput.value) || 0;
  });

  // Reach/Range
  if (entry['attack.type'] === 'melee') {
    configRow.createEl("span", { text: "Reichweite:" });
    const reachInput = configRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.reach'] as string) || '',
      placeholder: "5 ft."
    });
    reachInput.addEventListener("input", () => {
      entry['attack.reach'] = reachInput.value;
    });
  } else {
    configRow.createEl("span", { text: "Distanz:" });
    const rangeInput = configRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.range'] as string) || '',
      placeholder: "30/120 ft."
    });
    rangeInput.addEventListener("input", () => {
      entry['attack.range'] = rangeInput.value;
    });
  }

  // Damage section
  const damageRow = attackContent.createDiv({ cls: "sm-cc-field-row" });
  damageRow.createEl("span", { text: "Schaden:", cls: "sm-cc-field-label" });
  const damageList = (entry['attack.damage'] as any[]) || [];
  if (damageList.length > 0) {
    const firstDamage = damageList[0];
    const damageText = `${firstDamage.dice || ''}${firstDamage.bonus ? '+' + firstDamage.bonus : ''} ${firstDamage.type || ''}`;
    damageRow.createEl("span", { text: damageText, cls: "sm-cc-damage-text" });
  }
  const addDamageBtn = damageRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Schaden"
  });
}

/**
 * Render save effect component
 */
function renderSaveEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Rettungswurf", cls: "sm-cc-effect-title" });

  const saveContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Save configuration
  const configRow = saveContent.createDiv({ cls: "sm-cc-field-row" });

  // Ability
  const abilitySelect = configRow.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' },
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === entry['save.ability']) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['save.ability'] = abilitySelect.value;
  });

  // DC
  configRow.createEl("span", { text: "DC" });
  const dcInput = configRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['save.dc'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['save.dc'] = parseInt(dcInput.value) || 10;
  });

  // Targeting
  const targetRow = saveContent.createDiv({ cls: "sm-cc-field-row" });
  targetRow.createEl("span", { text: "Ziele:", cls: "sm-cc-field-label" });
  const targetInput = targetRow.createEl("input", {
    cls: "sm-cc-compact-text",
    value: (entry['save.area'] as string) || '',
    placeholder: "z.B. 30 ft. cone"
  });
  targetInput.addEventListener("input", () => {
    entry['save.area'] = targetInput.value;
  });

  // Effects
  const effectsRow = saveContent.createDiv({ cls: "sm-cc-field-row" });
  effectsRow.createEl("span", { text: "Fehlschlag:", cls: "sm-cc-field-label" });
  const failDamage = entry['save.onFail.damage'] as any[];
  if (failDamage && failDamage.length > 0) {
    const damage = failDamage[0];
    effectsRow.createEl("span", {
      text: `${damage.dice} ${damage.type}`,
      cls: "sm-cc-damage-text"
    });
  }
}

/**
 * Render multiattack effect component
 */
function renderMultiattackEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Mehrfachangriff", cls: "sm-cc-effect-title" });

  const multiContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Attacks configuration
  const attacksRow = multiContent.createDiv({ cls: "sm-cc-field-row" });
  attacksRow.createEl("span", { text: "Angriffe:", cls: "sm-cc-field-label" });

  const attacks = (entry['multiattack.attacks'] as any[]) || [];
  attacks.forEach(attack => {
    const chip = attacksRow.createEl("span", {
      text: `${attack.count}x ${attack.name}`,
      cls: "sm-cc-attack-chip"
    });
  });

  const addAttackBtn = attacksRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Angriff"
  });
}

// Helper function to get fields for each entry type
function getFieldsForEntryType(entryType: string, entry: Record<string, unknown>): AnyFieldSpec[] {
  // Base fields available for all types (but conditionally visible)
  const baseFields: AnyFieldSpec[] = [
    {
      id: "text",
      label: "Beschreibung",
      type: "textarea" as const,
      placeholder: "Entry description (Markdown)...",
    },
    {
      id: "recharge",
      label: "Aufladung",
      type: "text" as const,
      placeholder: "z.B. 5-6, 4-6",
      help: "Wird im Namen angezeigt (Recharge 5-6)",
      // Only show if has value or user explicitly added it
      visibleIf: (values) => Boolean(values['recharge']) || entry.showRecharge,
    },
    {
      id: "limitedUse.count",
      label: "Begrenzte Nutzung (Anzahl)",
      type: "number-stepper" as const,
      min: 1,
      max: 10,
      placeholder: "3",
      // Only show if has value
      visibleIf: (values) => Boolean(values['limitedUse.count']) || Boolean(values['limitedUse.reset']),
    },
    {
      id: "limitedUse.reset",
      label: "Zurücksetzen",
      type: "select" as const,
      options: [
        { value: "short-rest", label: "Kurze Rast" },
        { value: "long-rest", label: "Lange Rast" },
        { value: "day", label: "Tag" },
        { value: "dawn", label: "Morgendämmerung" },
        { value: "dusk", label: "Abenddämmerung" },
      ],
      visibleIf: (values) => Boolean(values['limitedUse.count']),
    },
  ];

  // Type-specific fields
  const typeFields: Record<string, AnyFieldSpec[]> = {
    attack: [
      {
        id: "attack.type",
        label: "Angriffsart",
        type: "select" as const,
        section: "Angriff",
        options: [
          { value: "melee", label: "Nahkampf" },
          { value: "ranged", label: "Fernkampf" },
        ],
      },
      {
        id: "attack.bonus",
        label: "Angriffsbonus",
        type: "number-stepper" as const,
        section: "Angriff",
        min: -10,
        max: 30,
        placeholder: "+12",
      },
      {
        id: "attack.reach",
        label: "Reichweite",
        type: "text" as const,
        section: "Angriff",
        placeholder: "10 ft.",
        // Only visible for melee attacks
        visibleIf: (values) => values['attack.type'] === "melee",
      },
      {
        id: "attack.range",
        label: "Distanz",
        type: "text" as const,
        section: "Angriff",
        placeholder: "120 ft. oder 30/120 ft.",
        // Only visible for ranged attacks
        visibleIf: (values) => values['attack.type'] === "ranged",
      },
      {
        id: "attack.damage",
        label: "Schaden",
        type: "tokens" as const,
        section: "Schaden",
        config: {
          fields: [
            {
              id: "dice",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "2d8",
            },
            {
              id: "bonus",
              type: "number-stepper",
              label: " +",
              displayInChip: true,
              editable: true,
              min: 0,
              max: 50,
              default: 0,
            },
            {
              id: "type",
              type: "select",
              label: " ",
              displayInChip: true,
              editable: true,
              suggestions: CREATURE_DAMAGE_PRESETS,
              placeholder: "Schadensart",
            },
          ],
          primaryField: "dice",
        },
        default: [],
      },
      {
        id: "attack.additionalEffects",
        label: "Zusätzliche Effekte",
        type: "textarea" as const,
        placeholder: "z.B. Ziel ist festgehalten...",
        section: "Effekte",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['attack.additionalEffects']),
      },
    ],

    save: [
      {
        id: "save.ability",
        label: "Attribut",
        type: "select" as const,
        section: "Rettungswurf",
        options: [
          { value: "str", label: "Stärke" },
          { value: "dex", label: "Geschick" },
          { value: "con", label: "Konstitution" },
          { value: "int", label: "Intelligenz" },
          { value: "wis", label: "Weisheit" },
          { value: "cha", label: "Charisma" },
        ],
      },
      {
        id: "save.dc",
        label: "SG",
        type: "number-stepper" as const,
        section: "Rettungswurf",
        min: 1,
        max: 30,
        placeholder: "19",
      },
      {
        id: "save.area",
        label: "Bereich/Ziele",
        type: "text" as const,
        section: "Zielerfassung",
        placeholder: "z.B. 90-foot-long, 5-foot-wide Line",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['save.area']),
      },
      {
        id: "save.onFail.damage",
        label: "Schaden bei Misserfolg",
        type: "tokens" as const,
        section: "Effekte",
        config: {
          fields: [
            {
              id: "dice",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "11d10",
            },
            {
              id: "bonus",
              type: "number-stepper",
              label: " +",
              displayInChip: true,
              editable: true,
              min: 0,
              max: 50,
              default: 0,
            },
            {
              id: "type",
              type: "select",
              label: " ",
              displayInChip: true,
              editable: true,
              suggestions: CREATURE_DAMAGE_PRESETS,
              placeholder: "Schadensart",
            },
          ],
          primaryField: "dice",
        },
        default: [],
      },
      {
        id: "save.onFail.legacyEffects",
        label: "Weitere Effekte bei Misserfolg",
        type: "textarea" as const,
        section: "Effekte",
        placeholder: "z.B. Ziel ist festgehalten...",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['save.onFail.legacyEffects']),
      },
      {
        id: "save.onSuccess.damage",
        label: "Schaden bei Erfolg",
        type: "select" as const,
        section: "Effekte",
        options: [
          { value: "half", label: "Halber Schaden" },
          { value: "none", label: "Kein Schaden" },
        ],
      },
      {
        id: "save.onSuccess.legacyText",
        label: "Bei Erfolg (Text)",
        type: "text" as const,
        placeholder: "z.B. Halber Schaden oder andere Effekte",
        help: "Für komplexe Erfolgs-Effekte",
      },
    ],

    multiattack: [
      {
        id: "multiattack.attacks",
        label: "Angriffe",
        type: "tokens" as const,
        section: "Angriffe",
        config: {
          fields: [
            {
              id: "count",
              type: "number-stepper",
              displayInChip: true,
              editable: true,
              min: 1,
              max: 10,
              default: 1,
            },
            {
              id: "name",
              type: "text",
              label: "x ",
              displayInChip: true,
              editable: true,
              placeholder: "Angriffsname",
            },
          ],
          primaryField: "name",
        },
        default: [],
      },
      {
        id: "multiattack.substitutions",
        label: "Ersetzungen",
        type: "tokens" as const,
        section: "Ersetzungen",
        help: "Optional: Angriffe durch andere Aktionen ersetzen",
        config: {
          fields: [
            {
              id: "replace",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "Angriffsname",
              label: "Ersetze ",
            },
            {
              id: "with.type",
              type: "select",
              displayInChip: true,
              editable: true,
              label: " durch ",
              options: [
                { value: "attack", label: "Angriff" },
                { value: "spellcasting", label: "Zauber" },
                { value: "other", label: "Anderes" },
              ],
              default: "attack",
            },
            {
              id: "with.name",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "Name",
              label: ": ",
            },
          ],
          primaryField: "replace",
        },
        default: [],
      },
    ],

    spellcasting: [
      {
        id: "spellcasting.ability",
        label: "Zauberattribut",
        type: "select" as const,
        options: [
          { value: "int", label: "Intelligenz" },
          { value: "wis", label: "Weisheit" },
          { value: "cha", label: "Charisma" },
        ],
      },
      {
        id: "spellcasting.saveDC",
        label: "Zauber-SG",
        type: "number-stepper" as const,
        min: 1,
        max: 30,
        placeholder: "18",
      },
      {
        id: "spellcasting.attackBonus",
        label: "Zauberangriffsbonus",
        type: "number-stepper" as const,
        min: -10,
        max: 30,
        placeholder: "+10",
      },
    ],
  };

  // Return ONLY fields relevant for this specific type
  switch(entryType) {
    case "attack":
      return [
        baseFields[0], // text (description)
        ...typeFields.attack,
        baseFields[1], // recharge (optional)
        baseFields[2], // limitedUse.count (optional)
        baseFields[3], // limitedUse.reset (optional)
      ];

    case "save":
      return [
        baseFields[0], // text
        ...typeFields.save,
        baseFields[1], // recharge (often used for breath weapons)
        baseFields[2], // limitedUse.count (optional)
        baseFields[3], // limitedUse.reset (optional)
      ];

    case "multiattack":
      return [
        baseFields[0], // text
        ...typeFields.multiattack,
      ];

    // Spellcasting moved to separate section

    case "special":
    default:
      // For special/passive traits, only show basic fields
      return baseFields;
  }
}

const entriesFields: AnyFieldSpec[] = [
  {
    id: "entries",
    label: "Eigenschaften & Aktionen (ohne Zauber)",
    type: "repeating",
    // Transform when saving: flatten keys to nested objects
    transform: (entries: any[]) => {
      if (!entries) return [];

      return entries.map(entry => {
        const result: any = {};

        for (const [key, value] of Object.entries(entry)) {
          if (key.includes('.')) {
            // Skip undefined/null values
            if (value === undefined || value === null || value === '') continue;

            // Split key and create nested object
            const parts = key.split('.');
            let current = result;

            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) {
                current[parts[i]] = {};
              }
              current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = value;
          } else {
            result[key] = value;
          }
        }

        // Post-process: save.onSuccess should be string if only legacyText is set
        if (result.save?.onSuccess) {
          const onSuccess = result.save.onSuccess;
          if (onSuccess.legacyText && !onSuccess.damage) {
            result.save.onSuccess = onSuccess.legacyText;
          }
        }

        // Post-process: Clean up empty nested objects
        const cleanEmpty = (obj: any) => {
          for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
              cleanEmpty(obj[key]);
              if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
              }
            }
          }
        };
        cleanEmpty(result);

        return result;
      });
    },
    config: {
      static: false,

      // Use card-based rendering instead of template fields
      card: (context) => {
        const entry = context.entry as Record<string, unknown>;
        const entryType = entry.entryType as string || "special";
        const category = entry.category as string || "trait";

        return {
          className: "sm-cc-creature-entry",
          type: entryType,

          // Badge showing category
          badge: () => {
            const categoryLabel = CREATURE_ENTRY_CATEGORIES.find(
              ([id]) => id === category
            )?.[1] ?? "Unknown";
            return {
              text: categoryLabel,
              variant: category,
            };
          },

          // Simple single-line header with just name
          renderName: (nameBox, ctx) => {
            // Just the name input, full width
            const nameInput = nameBox.createEl("input", {
              value: (entry.name as string) || "",
              placeholder: "Eigenschaft benennen...",
              cls: "sm-cc-entry-name-full",
              attr: { type: "text" }
            });
            nameInput.addEventListener("input", () => {
              entry.name = nameInput.value;
            });

            // Category and type are now determined by trigger settings in the body
            // No need for separate dropdowns

            return nameInput;
          },

          // Modular trigger/effect based rendering
          renderBody: (card, ctx) => {
            const body = card.createDiv({ cls: "sm-cc-entry-body-modular" });

            // TRIGGER Section
            const triggerSection = body.createDiv({ cls: "sm-cc-trigger-section" });
            triggerSection.createEl("h4", { text: "TRIGGER", cls: "sm-cc-section-label" });

            const triggerContent = triggerSection.createDiv({ cls: "sm-cc-trigger-content" });

            // Row 1: Aktivierung (Activation)
            const activationRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            activationRow.createEl("span", { text: "Aktivierung:", cls: "sm-cc-field-label" });
            const activationSelect = activationRow.createEl("select", {
              cls: "sm-cc-compact-select",
              value: (entry['trigger.activation'] as string) || 'action'
            });
            const activationOptions = [
              { value: 'action', label: 'Aktion' },
              { value: 'bonus', label: 'Bonusaktion' },
              { value: 'reaction', label: 'Reaktion' },
              { value: 'passive', label: 'Passiv' },
              { value: 'automatic', label: 'Automatisch' }
            ];
            activationOptions.forEach(opt => {
              const option = activationSelect.createEl("option", { value: opt.value, text: opt.label });
              if (opt.value === (entry['trigger.activation'] || 'action')) option.selected = true;
            });
            activationSelect.addEventListener("change", () => {
              entry['trigger.activation'] = activationSelect.value;
              // Update category based on activation
              if (activationSelect.value === 'bonus') entry.category = 'bonus';
              else if (activationSelect.value === 'reaction') entry.category = 'reaction';
              else if (activationSelect.value === 'passive') entry.category = 'trait';
              else entry.category = 'action';
              ctx.requestRender();
            });

            // Row 2: Modifikatoren (always visible)
            const modifiersRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            modifiersRow.createEl("span", { text: "Modifikatoren:", cls: "sm-cc-field-label" });

            // Recharge checkbox and inputs
            const rechargeCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "recharge-check" }
            });
            rechargeCheck.checked = Boolean(entry.recharge);
            rechargeCheck.addEventListener("change", () => {
              if (rechargeCheck.checked) {
                entry.recharge = "5-6";
              } else {
                delete entry.recharge;
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Aufladung:",
              attr: { for: "recharge-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry.recharge) {
              const rechargeMin = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry.recharge).split("-")[0] || "5"
              });
              modifiersRow.createEl("span", { text: "-" });
              const rechargeMax = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry.recharge).split("-")[1] || "6"
              });
              [rechargeMin, rechargeMax].forEach(input => {
                input.addEventListener("input", () => {
                  entry.recharge = `${rechargeMin.value}-${rechargeMax.value}`;
                });
              });
            }

            // Limited use checkbox and inputs
            const limitedCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "limited-check" }
            });
            limitedCheck.checked = Boolean(entry.limitedUse);
            limitedCheck.addEventListener("change", () => {
              if (limitedCheck.checked) {
                entry.limitedUse = { count: 3, reset: "day" };
              } else {
                delete entry.limitedUse;
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Begrenzt:",
              attr: { for: "limited-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry.limitedUse) {
              const limitInput = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String((entry.limitedUse as any)?.count || 3)
              });
              modifiersRow.createEl("span", { text: "pro" });
              const resetSelect = modifiersRow.createEl("select", {
                cls: "sm-cc-tiny-select"
              });
              const resetOptions = [
                { value: 'day', label: 'Tag' },
                { value: 'short-rest', label: 'Kurze Rast' },
                { value: 'long-rest', label: 'Lange Rast' }
              ];
              resetOptions.forEach(opt => {
                const option = resetSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === (entry.limitedUse as any)?.reset) option.selected = true;
              });
              limitInput.addEventListener("input", () => {
                if (!entry.limitedUse) entry.limitedUse = {};
                (entry.limitedUse as any).count = parseInt(limitInput.value) || 1;
              });
              resetSelect.addEventListener("change", () => {
                if (!entry.limitedUse) entry.limitedUse = {};
                (entry.limitedUse as any).reset = resetSelect.value;
              });
            }

            // Legendary checkbox and input
            const legendaryCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "legendary-check" }
            });
            legendaryCheck.checked = Boolean(entry['trigger.legendaryCost']);
            legendaryCheck.addEventListener("change", () => {
              if (legendaryCheck.checked) {
                entry['trigger.legendaryCost'] = 1;
                entry.category = 'legendary';
              } else {
                delete entry['trigger.legendaryCost'];
                if (entry['trigger.activation'] !== 'passive') {
                  entry.category = 'action';
                }
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Legendär:",
              attr: { for: "legendary-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry['trigger.legendaryCost']) {
              const costInput = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry['trigger.legendaryCost'] || 1)
              });
              modifiersRow.createEl("span", { text: "Kosten" });
              costInput.addEventListener("input", () => {
                entry['trigger.legendaryCost'] = parseInt(costInput.value) || 1;
              });
            }

            // Row 3: Bedingungen (Conditions) - based on activation type
            if (entry['trigger.activation'] === 'reaction') {
              const reactionRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
              reactionRow.createEl("span", { text: "Auslöser:", cls: "sm-cc-field-label" });
              const reactionInput = reactionRow.createEl("input", {
                cls: "sm-cc-long-text",
                value: (entry['trigger.reactionTrigger'] as string) || '',
                placeholder: "z.B. wird getroffen, sieht einen Zauber gewirkt..."
              });
              reactionInput.addEventListener("input", () => {
                entry['trigger.reactionTrigger'] = reactionInput.value;
              });
            } else if (entry['trigger.activation'] === 'automatic') {
              const timingRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
              timingRow.createEl("span", { text: "Zeitpunkt:", cls: "sm-cc-field-label" });
              const timingSelect = timingRow.createEl("select", {
                cls: "sm-cc-compact-select",
                value: (entry['trigger.automaticTiming'] as string) || 'start-of-turn'
              });
              const timingOptions = [
                { value: 'start-of-turn', label: 'Am Beginn der Runde der Kreatur' },
                { value: 'end-of-turn', label: 'Am Ende der Runde der Kreatur' },
                { value: 'start-of-any-turn', label: 'Am Beginn jeder Kreatur-Runde' },
                { value: 'end-of-any-turn', label: 'Am Ende jeder Kreatur-Runde' }
              ];
              timingOptions.forEach(opt => {
                const option = timingSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === entry['trigger.automaticTiming']) option.selected = true;
              });
              timingSelect.addEventListener("change", () => {
                entry['trigger.automaticTiming'] = timingSelect.value;
              });
            }

            // Row 4: Zielbereich (Targeting)
            const targetingRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            targetingRow.createEl("span", { text: "Zielbereich:", cls: "sm-cc-field-label" });
            const targetTypeSelect = targetingRow.createEl("select", {
              cls: "sm-cc-compact-select",
              value: (entry['trigger.targeting.type'] as string) || 'single'
            });
            const targetTypes = [
              { value: 'self', label: 'Selbst' },
              { value: 'single', label: 'Einzelziel' },
              { value: 'multiple', label: 'Mehrere Ziele' },
              { value: 'area', label: 'Bereich' }
            ];
            targetTypes.forEach(opt => {
              const option = targetTypeSelect.createEl("option", { value: opt.value, text: opt.label });
              if (opt.value === (entry['trigger.targeting.type'] || 'single')) option.selected = true;
            });
            targetTypeSelect.addEventListener("change", () => {
              if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
              (entry['trigger.targeting'] as any).type = targetTypeSelect.value;
              ctx.requestRender();
            });

            // Additional targeting fields based on type
            const targetType = entry['trigger.targeting.type'] || 'single';
            if (targetType === 'single' || targetType === 'multiple') {
              if (targetType === 'multiple') {
                targetingRow.createEl("span", { text: "Anzahl:" });
                const countInput = targetingRow.createEl("input", {
                  type: "number",
                  cls: "sm-cc-tiny-number",
                  value: String(entry['trigger.targeting.count'] || 2)
                });
                countInput.addEventListener("input", () => {
                  if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                  (entry['trigger.targeting'] as any).count = parseInt(countInput.value) || 1;
                });
              }
              targetingRow.createEl("span", { text: "Reichweite:" });
              const rangeInput = targetingRow.createEl("input", {
                cls: "sm-cc-compact-text",
                value: (entry['trigger.targeting.range'] as string) || '',
                placeholder: "z.B. 30 ft."
              });
              rangeInput.addEventListener("input", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).range = rangeInput.value;
              });

              const sightCheck = targetingRow.createEl("input", {
                type: "checkbox",
                attr: { id: "sight-required" }
              });
              sightCheck.checked = entry['trigger.targeting.sightRequired'] === true;
              sightCheck.addEventListener("change", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).sightRequired = sightCheck.checked;
              });
              targetingRow.createEl("label", {
                text: "Sichtlinie erforderlich",
                attr: { for: "sight-required" },
                cls: "sm-cc-checkbox-label"
              });
            } else if (targetType === 'area') {
              targetingRow.createEl("span", { text: "Form:" });
              const shapeSelect = targetingRow.createEl("select", {
                cls: "sm-cc-compact-select",
                value: (entry['trigger.targeting.shape'] as string) || 'cone'
              });
              const shapes = [
                { value: 'cone', label: 'Kegel' },
                { value: 'emanation', label: 'Aura' },
                { value: 'line', label: 'Linie' },
                { value: 'cube', label: 'Würfel' },
                { value: 'sphere', label: 'Kugel' }
              ];
              shapes.forEach(opt => {
                const option = shapeSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === entry['trigger.targeting.shape']) option.selected = true;
              });
              shapeSelect.addEventListener("change", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).shape = shapeSelect.value;
              });

              targetingRow.createEl("span", { text: "Größe:" });
              const sizeInput = targetingRow.createEl("input", {
                cls: "sm-cc-compact-text",
                value: (entry['trigger.targeting.size'] as string) || '',
                placeholder: "z.B. 15 ft."
              });
              sizeInput.addEventListener("input", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).size = sizeInput.value;
              });
            }

            // Row 5: Einschränkungen (Restrictions) - always visible
            const restrictionsRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            restrictionsRow.createEl("span", { text: "Einschränkungen:", cls: "sm-cc-field-label" });

            // Size restriction checkbox and dropdown
            const sizeCheck = restrictionsRow.createEl("input", {
              type: "checkbox",
              attr: { id: "size-restriction" }
            });
            const restrictions = entry['trigger.restrictions'] as any || {};
            sizeCheck.checked = Boolean(restrictions.maxSize);
            sizeCheck.addEventListener("change", () => {
              if (sizeCheck.checked) {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).maxSize = 'Mittel';
              } else {
                if (entry['trigger.restrictions']) {
                  delete (entry['trigger.restrictions'] as any).maxSize;
                  // Clean up if empty
                  if (Object.keys(entry['trigger.restrictions'] as any).length === 0) {
                    delete entry['trigger.restrictions'];
                  }
                }
              }
              ctx.requestRender();
            });
            restrictionsRow.createEl("label", {
              text: "Max. Größe:",
              attr: { for: "size-restriction" },
              cls: "sm-cc-checkbox-label-small"
            });

            if (restrictions.maxSize) {
              const sizeSelect = restrictionsRow.createEl("select", {
                cls: "sm-cc-tiny-select"
              });
              ['Klein', 'Mittel', 'Groß', 'Riesig'].forEach(size => {
                const opt = sizeSelect.createEl("option", { value: size, text: size });
                if (size === restrictions.maxSize) opt.selected = true;
              });
              sizeSelect.addEventListener("change", () => {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).maxSize = sizeSelect.value;
              });
            }

            // Custom restriction text input
            const otherInput = restrictionsRow.createEl("input", {
              cls: "sm-cc-long-text",
              value: restrictions.other || '',
              placeholder: "Weitere Einschränkungen (z.B. muss ergriffen sein)"
            });
            otherInput.addEventListener("input", () => {
              if (otherInput.value) {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).other = otherInput.value;
              } else {
                if (entry['trigger.restrictions']) {
                  delete (entry['trigger.restrictions'] as any).other;
                  // Clean up if empty
                  if (Object.keys(entry['trigger.restrictions'] as any).length === 0) {
                    delete entry['trigger.restrictions'];
                  }
                }
              }
            });

            // EFFEKTE Section
            const effectsSection = body.createDiv({ cls: "sm-cc-effects-section" });
            effectsSection.createEl("h4", { text: "EFFEKTE", cls: "sm-cc-section-label" });

            const effectsContent = effectsSection.createDiv({ cls: "sm-cc-effects-content" });

            // Render existing effects based on entry type (for backward compatibility)
            if (entryType === "attack") {
              renderAttackEffect(effectsContent, entry, ctx);
            } else if (entryType === "save") {
              renderSaveEffect(effectsContent, entry, ctx);
            } else if (entryType === "multiattack") {
              renderMultiattackEffect(effectsContent, entry, ctx);
            }

            // Add effect buttons
            const addEffectsRow = effectsContent.createDiv({ cls: "sm-cc-add-effects-row" });
            ['+ Angriff', '+ Rettungswurf', '+ Schaden', '+ Zustand'].forEach(label => {
              const btn = addEffectsRow.createEl("button", {
                cls: "sm-cc-compact-btn",
                text: label
              });
              btn.addEventListener("click", () => {
                // TODO: Add effect to action
              });
            });

            // Description
            const descSection = body.createDiv({ cls: "sm-cc-description-section" });
            const textarea = descSection.createEl("textarea", {
              cls: "sm-cc-entry-description",
              placeholder: "Beschreibungstext...",
              value: (entry.text as string) || ''
            });
            textarea.addEventListener("input", () => {
              entry.text = textarea.value;
            });
          },

          // Add data-entry-id for navigation
          dataset: {
            entryId: String(entry.name || `entry-${context.index}`)
          },

          // Add collapse toggle in head
          renderHeadExtras: (head, ctx, slots) => {
            const toggle = head.createDiv({
              cls: "sm-cc-entry-toggle",
              attr: { "aria-expanded": "true", "aria-label": "Toggle entry" }
            });
            setIcon(toggle, "chevron-down");

            // Move toggle to start of head
            head.prepend(toggle);

            toggle.addEventListener("click", (e) => {
              e.stopPropagation();
              const isExpanded = toggle.getAttribute("aria-expanded") === "true";
              toggle.setAttribute("aria-expanded", String(!isExpanded));
              slots.card.toggleClass("is-collapsed", isExpanded);
              setIcon(toggle, isExpanded ? "chevron-right" : "chevron-down");
            });
          },
        };
      },

      // Categories for filtering
      categories: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({
        id,
        label,
        defaultActive: true,
      })),

      // Filters for entry types
      filters: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({
        id,
        label,
        predicate: (entry: Record<string, unknown>) => entry.category === id,
      })),
    },
    default: [],
  },
];

// ============================================================================
// SECTIONS
// ============================================================================

export const creatureSpec: CreateSpec<StatblockData> = {
  kind: "creature",
  title: "Kreatur erstellen",
  subtitle: "Neue Kreatur für deine Kampagne",
  schema: creatureSchema,
  fields: [
    ...basicInfoFields,
    ...combatStatsFields,
    ...movementFields,
    ...abilitiesFields,
    ...skillsFields,
    ...sensesLanguagesFields,
    ...resistancesFields,
    ...equipmentFields,
    ...spellcastingFields,
    ...entriesFields,
  ],
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Creatures/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Creatures",
    preserveCase: true,
    frontmatter: [
      "name", "size", "type", "typeTags",
      "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride",
      "ac", "initiative", "hp", "hitDice",
      "speeds", "abilities", "pb", "saves", "skills",
      "sensesList", "languagesList", "passivesList",
      "damageVulnerabilitiesList", "damageResistancesList",
      "damageImmunitiesList", "conditionImmunitiesList",
      "gearList", "cr", "xp",
      "entries", "spellcasting"
    ],
    bodyTemplate: (data) => statblockToMarkdown(data as StatblockData),
  },
  ui: {
    submitLabel: "Kreatur erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: true,
    sections: [
      {
        id: "basic",
        label: "Grunddaten",
        description: "Name, Größe, Typ und Gesinnung",
        fieldIds: ["name", "size", "alignmentLawChaos", "alignmentGoodEvil", "alignmentOverride", "type", "typeTags"],
      },
      {
        id: "combat",
        label: "Kampfwerte",
        description: "AC, HP, Initiative und CR",
        fieldIds: ["ac", "initiative", "hp", "hitDice", "cr", "xp", "pb"],
      },
      {
        id: "abilities",
        label: "Attribute",
        description: "Grundattribute und Modifikatoren",
        fieldIds: ["abilities"],
      },
      {
        id: "senses",
        label: "Fähigkeiten",
        description: "Bewegungsraten, Fertigkeiten, Sinneswahrnehmungen und Kommunikation",
        fieldIds: ["speeds", "skills", "sensesList", "passivesList", "languagesList"],
      },
      {
        id: "resistances",
        label: "Widerstände",
        description: "Schadenswiderstände und Immunitäten",
        fieldIds: ["damageVulnerabilitiesList", "damageResistancesList", "damageImmunitiesList", "conditionImmunitiesList"],
      },
      {
        id: "equipment",
        label: "Ausrüstung",
        description: "Gegenstände und Ausrüstung",
        fieldIds: ["gearList"],
      },
      {
        id: "spellcasting",
        label: "Zauber & Zauberwirken",
        description: "Zaubersprüche und Zauberfähigkeiten",
        fieldIds: ["spellcastingEntries"],
      },
      {
        id: "entries",
        label: "Eigenschaften & Aktionen",
        description: "Spezialfähigkeiten, Angriffe und Reaktionen (ohne Zauber)",
        fieldIds: ["entries"],
      },
    ],
  },
  // Browse configuration - replaces view-config.ts and list-schema.ts
  browse: {
    metadata: [
      {
        id: "type",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.type,
      },
      {
        id: "cr",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.cr ? `CR ${entry.cr}` : undefined,
      },
    ],
    filters: [
      { id: "type", field: "type", label: "Type", type: "string" },
      {
        id: "cr",
        field: "cr",
        label: "CR",
        type: "custom",
        sortComparator: (a: string, b: string) => {
          const parseCr = (value?: string): number => {
            if (!value) return Number.POSITIVE_INFINITY;
            if (value.includes("/")) {
              const [num, denom] = value.split("/").map(part => Number(part.trim()));
              if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
                return num / denom;
              }
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
          };
          return parseCr(a) - parseCr(b);
        },
      },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "type", label: "Type", field: "type" },
      {
        id: "cr",
        label: "CR",
        compareFn: (a, b) => {
          const parseCr = (value?: string): number => {
            if (!value) return Number.POSITIVE_INFINITY;
            if (value.includes("/")) {
              const [num, denom] = value.split("/").map(part => Number(part.trim()));
              if (Number.isFinite(num) && Number.isFinite(denom) && denom !== 0) {
                return num / denom;
              }
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
          };
          return parseCr(a.cr) - parseCr(b.cr) || a.name.localeCompare(b.name);
        },
      },
    ],
    search: ["type", "cr"],
  },
  // Loader configuration - replaces loader.ts (uses auto-loader by default)
  loader: {
    fromFrontmatter: (fm, file) => {
      // Helper: Strip " ft." from values since UI adds it via valueConfig.unit
      const stripUnit = (value: string): string => {
        if (!value) return '';
        return value.replace(/\s*ft\.?$/i, '').trim();
      };

      // Auto-migrate legacy speeds format to array format
      if (fm.speeds && !Array.isArray(fm.speeds)) {
        const oldSpeeds = fm.speeds as any;
        const newSpeeds: Array<{type: string; value: string; hover?: boolean}> = [];

        // Convert known speed types
        const speedTypes = ['walk', 'burrow', 'climb', 'fly', 'swim'];
        for (const type of speedTypes) {
          if (oldSpeeds[type]?.distance) {
            const entry: any = {
              type,
              value: stripUnit(oldSpeeds[type].distance),  // Strip unit
            };
            if (type === 'fly' && oldSpeeds[type].hover === true) {
              entry.hover = true;
            }
            newSpeeds.push(entry);
          }
        }

        // Convert extras if present
        if (oldSpeeds.extras && Array.isArray(oldSpeeds.extras)) {
          for (const extra of oldSpeeds.extras) {
            if (extra.label && extra.distance) {
              newSpeeds.push({
                type: extra.label,
                value: stripUnit(extra.distance),  // Strip unit
              });
            }
          }
        }

        fm.speeds = newSpeeds.length > 0 ? newSpeeds : undefined;
      }

      // Normalize passivesList: Parse legacy format "Passive Perception 20" → {skill: "Perception", value: "20"}
      if (fm.passivesList && Array.isArray(fm.passivesList)) {
        fm.passivesList = fm.passivesList.map(item => {
          let text: string;

          // Handle both string and {value: "..."} formats
          if (typeof item === 'string') {
            text = item;
          } else if (item && typeof item === 'object' && 'value' in item) {
            text = String(item.value);
          } else if (item && typeof item === 'object' && 'skill' in item && 'value' in item) {
            // Already in new format
            return item;
          } else {
            return item;
          }

          // Parse "Passive Perception 20" format
          const match = text.match(/^Passive\s+(\w+)\s+(\d+)$/i);
          if (match) {
            return {
              skill: match[1], // e.g., "Perception"
              value: match[2], // e.g., "20"
            };
          }

          // Fallback: if no match, try to salvage what we can
          return {
            skill: "Perception",
            value: text.replace(/\D/g, '') || "10",
          };
        });
      }

      // Normalize languagesList: Clean up Obsidian's YAML parsing quirks
      // Obsidian merges keys from adjacent list items, so we need to separate them
      if (fm.languagesList && Array.isArray(fm.languagesList)) {
        fm.languagesList = fm.languagesList.map(item => {
          if (typeof item === 'string') {
            return { value: item };
          }

          // Remove empty/whitespace-only fields
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' && value.trim() === '') {
              continue;
            }
            cleaned[key] = value;
          }

          // If token has BOTH value AND type, but value looks like a language name
          // (not empty), then this is a case where Obsidian merged two tokens
          // Keep only the value field for simple language tokens
          if (cleaned.value && cleaned.type && !cleaned.range) {
            // This is likely a simple language that got 'type' added from the next token
            return { value: cleaned.value };
          }

          return cleaned;
        });
      }

      // Normalize sensesList: Same treatment as languagesList
      if (fm.sensesList && Array.isArray(fm.sensesList)) {
        fm.sensesList = fm.sensesList.map(item => {
          if (typeof item === 'string') {
            return { value: item };
          }

          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (typeof value === 'string' && value.trim() === '') {
              continue;
            }
            cleaned[key] = value;
          }

          return cleaned;
        });
      }

      // Flatten nested entry structures for UI compatibility
      if (fm.entries && Array.isArray(fm.entries)) {
        fm.entries = fm.entries.map(entry => {
          const flattened: any = {};

          // Helper to flatten nested objects
          const flatten = (obj: any, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
              const newKey = prefix ? `${prefix}.${key}` : key;

              // Special case: save.onSuccess can be string or object
              if (newKey === 'save.onSuccess' && typeof value === 'string') {
                flattened['save.onSuccess.legacyText'] = value;
                continue;
              }

              if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recurse for nested objects (but not arrays)
                flatten(value, newKey);
              } else {
                // Assign primitive or array values
                flattened[newKey] = value;
              }
            }
          };

          flatten(entry);
          return flattened;
        });
      }

      return fm as StatblockData;
    },
  },
};
