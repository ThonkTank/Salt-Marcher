// src/apps/library/create/creature/components/condition-component.ts
// Modular Condition component for status effects in the creature creator entry system

import { createTextInput, createSelectDropdown, createTextArea, createNumberInput, createCheckbox } from "../../shared/form-controls";
import type { StatblockData } from "../../../core/creature-files";
import type { ConditionType, TimeUnit } from "./types";
import { CREATURE_ABILITY_LABELS } from "../presets";
import type { AbilityScoreKey } from "../../../core/creature-files";
import { setIcon } from "obsidian";

/**
 * D&D 5e standard conditions with display labels
 */
export const CONDITION_TYPES = [
  { value: "blinded", label: "Blinded" },
  { value: "charmed", label: "Charmed" },
  { value: "deafened", label: "Deafened" },
  { value: "exhaustion", label: "Exhaustion" },
  { value: "frightened", label: "Frightened" },
  { value: "grappled", label: "Grappled" },
  { value: "incapacitated", label: "Incapacitated" },
  { value: "invisible", label: "Invisible" },
  { value: "paralyzed", label: "Paralyzed" },
  { value: "petrified", label: "Petrified" },
  { value: "poisoned", label: "Poisoned" },
  { value: "prone", label: "Prone" },
  { value: "restrained", label: "Restrained" },
  { value: "stunned", label: "Stunned" },
  { value: "unconscious", label: "Unconscious" },
] as const;

/**
 * Time units for condition duration
 */
export const TIME_UNITS = [
  { value: "instant", label: "Instant" },
  { value: "round", label: "Round(s)" },
  { value: "minute", label: "Minute(s)" },
  { value: "hour", label: "Hour(s)" },
  { value: "day", label: "Day(s)" },
  { value: "permanent", label: "Permanent" },
] as const;

/**
 * Escape mechanism types
 */
export type EscapeMechanism = "dc" | "save" | "action" | "none";

/**
 * Configuration for a single condition instance
 */
export interface ConditionInstance {
  condition: ConditionType | string;    // Condition type or custom text
  duration?: {
    amount: number;
    unit: TimeUnit;
    text?: string;                       // Optional custom duration text
  };
  escape?: {
    type: EscapeMechanism;
    dc?: number;                         // DC for grapple/restrain escape or save
    ability?: AbilityScoreKey;           // Ability for save to end
    description?: string;                // Custom escape text
  };
  exhaustionLevel?: number;              // For exhaustion (1-6)
  notes?: string;                        // Additional effect text
}

/**
 * Options for creating a condition component
 */
export interface ConditionComponentOptions {
  conditions: ConditionInstance[];      // Array of condition instances
  data: StatblockData;                  // Creature data for DC calculations
  onChange: () => void;                 // Callback when conditions change
  maxConditions?: number;               // Maximum number of conditions (default: 3)
}

/**
 * Conditions that typically have escape DCs (grapple/restrain)
 */
const CONDITIONS_WITH_DC: ConditionType[] = ["grappled", "restrained"];

/**
 * Conditions that typically allow saves to end
 */
const CONDITIONS_WITH_SAVE: ConditionType[] = [
  "blinded",
  "charmed",
  "frightened",
  "paralyzed",
  "petrified",
  "poisoned",
  "stunned",
];

/**
 * Returns smart default escape mechanism for a condition
 */
function getDefaultEscapeMechanism(condition: ConditionType | string): EscapeMechanism {
  if (CONDITIONS_WITH_DC.includes(condition as ConditionType)) {
    return "dc";
  }
  if (CONDITIONS_WITH_SAVE.includes(condition as ConditionType)) {
    return "save";
  }
  if (condition === "prone") {
    return "action";
  }
  return "none";
}

/**
 * Validates a condition instance
 */
export function validateCondition(instance: ConditionInstance): string[] {
  const errors: string[] = [];

  if (!instance.condition?.trim()) {
    errors.push("Condition type is required");
  }

  // Validate exhaustion level
  if (instance.condition === "exhaustion") {
    if (instance.exhaustionLevel == null || instance.exhaustionLevel < 1 || instance.exhaustionLevel > 6) {
      errors.push("Exhaustion level must be between 1 and 6");
    }
  }

  // Validate escape mechanism
  if (instance.escape) {
    if (instance.escape.type === "dc" && !instance.escape.dc) {
      errors.push("Escape DC is required for DC-based escape");
    }
    if (instance.escape.type === "save") {
      if (!instance.escape.ability) {
        errors.push("Save ability is required for save-based escape");
      }
      if (!instance.escape.dc) {
        errors.push("Save DC is required for save-based escape");
      }
    }
  }

  // Validate duration
  if (instance.duration && instance.duration.unit !== "instant" && instance.duration.unit !== "permanent") {
    if (!instance.duration.amount || instance.duration.amount < 1) {
      errors.push("Duration amount must be at least 1");
    }
  }

  return errors;
}

/**
 * Formats a condition instance into a human-readable string
 * Examples:
 * - "target is Grappled (escape DC 14)"
 * - "target is Poisoned for 1 minute (DC 15 Constitution save ends)"
 * - "target has the Prone condition"
 * - "target suffers one level of Exhaustion (level 3)"
 */
export function formatConditionString(instance: ConditionInstance): string {
  const parts: string[] = [];

  // Base condition text
  if (instance.condition === "exhaustion") {
    const level = instance.exhaustionLevel || 1;
    parts.push(`target suffers ${level === 1 ? "one level" : `${level} levels`} of Exhaustion`);
    if (instance.exhaustionLevel && instance.exhaustionLevel > 1) {
      parts.push(`(level ${instance.exhaustionLevel})`);
    }
  } else {
    const conditionName = CONDITION_TYPES.find(c => c.value === instance.condition)?.label || instance.condition;

    // Use proper article and verb
    if (["invisible", "unconscious", "incapacitated"].includes(instance.condition)) {
      parts.push(`target is ${conditionName}`);
    } else {
      parts.push(`target has the ${conditionName} condition`);
    }
  }

  // Duration
  if (instance.duration) {
    if (instance.duration.text) {
      parts.push(`for ${instance.duration.text}`);
    } else if (instance.duration.unit === "permanent") {
      parts.push(`permanently`);
    } else if (instance.duration.unit !== "instant") {
      const amount = instance.duration.amount;
      const unit = instance.duration.unit;
      const plural = amount !== 1 ? "s" : "";
      parts.push(`for ${amount} ${unit}${plural}`);
    }
  }

  // Escape mechanism
  if (instance.escape && instance.escape.type !== "none") {
    if (instance.escape.description) {
      parts.push(`(${instance.escape.description})`);
    } else if (instance.escape.type === "dc" && instance.escape.dc) {
      parts.push(`(escape DC ${instance.escape.dc})`);
    } else if (instance.escape.type === "save" && instance.escape.ability && instance.escape.dc) {
      const abilityFull = {
        str: "Strength",
        dex: "Dexterity",
        con: "Constitution",
        int: "Intelligence",
        wis: "Wisdom",
        cha: "Charisma",
      }[instance.escape.ability] || instance.escape.ability.toUpperCase();
      parts.push(`(DC ${instance.escape.dc} ${abilityFull} save ends)`);
    } else if (instance.escape.type === "action") {
      parts.push(`(costs half movement to stand up)`);
    }
  }

  // Additional notes
  if (instance.notes?.trim()) {
    parts.push(`- ${instance.notes.trim()}`);
  }

  return parts.join(" ");
}

/**
 * Creates a single condition instance UI
 */
function createConditionInstanceUI(
  parent: HTMLElement,
  instance: ConditionInstance,
  index: number,
  data: StatblockData,
  onChange: () => void,
  onDelete: () => void,
  isFirst: boolean
): HTMLElement {
  const container = parent.createDiv({ cls: "sm-cc-condition-instance" });

  // Header with label and delete button
  const header = container.createDiv({ cls: "sm-cc-condition-header" });

  const label = header.createSpan({
    cls: "sm-cc-condition-label",
    text: `Condition ${index + 1}`
  });

  if (!isFirst) {
    const deleteBtn = header.createEl("button", {
      cls: "sm-cc-condition-delete-btn",
      attr: { type: "button", "aria-label": "Delete Condition" }
    });
    setIcon(deleteBtn, "x");
    deleteBtn.onclick = onDelete;
  }

  // Grid for condition fields
  const grid = container.createDiv({ cls: "sm-cc-condition-grid" });

  // === Row 1: Condition Type ===
  grid.createEl("label", { text: "Condition", cls: "sm-cc-condition-field-label" });
  const conditionSelect = createSelectDropdown(grid, {
    className: "sm-cc-condition-type-select",
    options: [
      { value: "", label: "(Select condition)" },
      ...CONDITION_TYPES.map(c => ({ value: c.value, label: c.label })),
    ],
    value: instance.condition || "",
    enableSearch: true,
    searchPlaceholder: "Search conditions...",
    onChange: (value) => {
      instance.condition = value || "";

      // Auto-set escape mechanism based on condition
      if (value && !instance.escape) {
        const defaultEscape = getDefaultEscapeMechanism(value as ConditionType);
        if (defaultEscape !== "none") {
          instance.escape = {
            type: defaultEscape,
          };
        }
      }

      // Show/hide exhaustion level field
      const exhaustionRow = grid.querySelector(".sm-cc-condition-exhaustion-row") as HTMLElement;
      if (exhaustionRow) {
        exhaustionRow.style.display = value === "exhaustion" ? "" : "none";
      }

      render();
      onChange();
    }
  });

  // === Row 2: Exhaustion Level (only for exhaustion) ===
  const exhaustionRow = grid.createDiv({
    cls: "sm-cc-condition-exhaustion-row",
    attr: { style: `grid-column: 1 / -1; ${instance.condition !== "exhaustion" ? "display: none;" : ""}` }
  });
  exhaustionRow.createEl("label", { text: "Exhaustion Level", cls: "sm-cc-condition-field-label" });
  const exhaustionSelect = createSelectDropdown(exhaustionRow, {
    className: "sm-cc-condition-exhaustion-select",
    options: [
      { value: "1", label: "Level 1" },
      { value: "2", label: "Level 2" },
      { value: "3", label: "Level 3" },
      { value: "4", label: "Level 4" },
      { value: "5", label: "Level 5" },
      { value: "6", label: "Level 6" },
    ],
    value: instance.exhaustionLevel ? String(instance.exhaustionLevel) : "1",
    onChange: (value) => {
      instance.exhaustionLevel = parseInt(value, 10);
      updatePreview();
      onChange();
    }
  });

  // === Row 3: Duration ===
  grid.createEl("label", { text: "Duration", cls: "sm-cc-condition-field-label" });
  const durationWrapper = grid.createDiv({ cls: "sm-cc-condition-duration-wrapper" });

  // Duration amount
  const durationAmount = createNumberInput(durationWrapper, {
    className: "sm-cc-condition-duration-amount",
    placeholder: "1",
    ariaLabel: "Duration Amount",
    value: instance.duration?.amount,
    min: 1,
    max: 99,
    onChange: (value) => {
      if (!instance.duration) {
        instance.duration = { amount: 1, unit: "minute" };
      }
      instance.duration.amount = value || 1;
      updatePreview();
      onChange();
    }
  });
  (durationAmount.style as any).width = "5ch";

  // Duration unit
  const durationUnit = createSelectDropdown(durationWrapper, {
    className: "sm-cc-condition-duration-unit",
    options: TIME_UNITS,
    value: instance.duration?.unit || "minute",
    onChange: (value) => {
      if (!instance.duration) {
        instance.duration = { amount: 1, unit: value as TimeUnit };
      } else {
        instance.duration.unit = value as TimeUnit;
      }

      // Hide/show amount field based on unit
      if (value === "instant" || value === "permanent") {
        durationAmount.style.display = "none";
      } else {
        durationAmount.style.display = "";
      }

      updatePreview();
      onChange();
    }
  });

  // Hide amount for instant/permanent
  if (instance.duration?.unit === "instant" || instance.duration?.unit === "permanent") {
    durationAmount.style.display = "none";
  }

  // === Row 4: Escape Mechanism ===
  grid.createEl("label", { text: "Escape", cls: "sm-cc-condition-field-label" });
  const escapeWrapper = grid.createDiv({ cls: "sm-cc-condition-escape-wrapper" });

  // Escape type selector
  const escapeTypeSelect = createSelectDropdown(escapeWrapper, {
    className: "sm-cc-condition-escape-type",
    options: [
      { value: "none", label: "None" },
      { value: "dc", label: "Escape DC" },
      { value: "save", label: "Save to End" },
      { value: "action", label: "Action" },
    ],
    value: instance.escape?.type || "none",
    onChange: (value) => {
      if (value === "none") {
        instance.escape = undefined;
      } else {
        if (!instance.escape) {
          instance.escape = { type: value as EscapeMechanism };
        } else {
          instance.escape.type = value as EscapeMechanism;
        }
      }
      render();
      onChange();
    }
  });

  // Escape details (DC, ability, etc.)
  const escapeDetailsWrapper = grid.createDiv({
    cls: "sm-cc-condition-escape-details",
    attr: { style: "grid-column: 1 / -1;" }
  });

  if (instance.escape && instance.escape.type !== "none") {
    const detailsGrid = escapeDetailsWrapper.createDiv({ cls: "sm-cc-condition-escape-details-grid" });

    if (instance.escape.type === "dc") {
      // Escape DC input
      detailsGrid.createEl("label", { text: "DC", cls: "sm-cc-condition-field-label" });
      const dcInput = createNumberInput(detailsGrid, {
        className: "sm-cc-condition-escape-dc",
        placeholder: "14",
        ariaLabel: "Escape DC",
        value: instance.escape.dc,
        min: 1,
        max: 30,
        onChange: (value) => {
          if (instance.escape) {
            instance.escape.dc = value;
          }
          updatePreview();
          onChange();
        }
      });
      (dcInput.style as any).width = "5ch";
    } else if (instance.escape.type === "save") {
      // Save ability selector
      detailsGrid.createEl("label", { text: "Ability", cls: "sm-cc-condition-field-label" });
      createSelectDropdown(detailsGrid, {
        className: "sm-cc-condition-escape-ability",
        options: [
          { value: "", label: "(None)" },
          ...CREATURE_ABILITY_LABELS.map((label) => ({
            value: label.toLowerCase(),
            label
          })),
        ],
        value: instance.escape.ability || "",
        onChange: (value) => {
          if (instance.escape) {
            instance.escape.ability = (value || undefined) as AbilityScoreKey | undefined;
          }
          updatePreview();
          onChange();
        }
      });

      // Save DC input
      detailsGrid.createEl("label", { text: "DC", cls: "sm-cc-condition-field-label" });
      const saveDcInput = createNumberInput(detailsGrid, {
        className: "sm-cc-condition-escape-dc",
        placeholder: "15",
        ariaLabel: "Save DC",
        value: instance.escape.dc,
        min: 1,
        max: 30,
        onChange: (value) => {
          if (instance.escape) {
            instance.escape.dc = value;
          }
          updatePreview();
          onChange();
        }
      });
      (saveDcInput.style as any).width = "5ch";
    } else if (instance.escape.type === "action") {
      // Custom description for action-based escape
      detailsGrid.createEl("label", { text: "Description", cls: "sm-cc-condition-field-label" });
      createTextInput(detailsGrid, {
        className: "sm-cc-condition-escape-description",
        placeholder: "costs half movement to stand up",
        ariaLabel: "Escape Description",
        value: instance.escape.description || "",
        onInput: (value) => {
          if (instance.escape) {
            instance.escape.description = value.trim() || undefined;
          }
          updatePreview();
          onChange();
        }
      });
    }
  }

  // === Row 5: Additional Notes ===
  grid.createEl("label", {
    text: "Notes",
    cls: "sm-cc-condition-field-label",
    attr: { style: "grid-column: 1 / -1;" }
  });
  const notesArea = createTextArea(grid, {
    className: "sm-cc-condition-notes",
    placeholder: "Additional effect text (optional)",
    ariaLabel: "Condition Notes",
    value: instance.notes || "",
    minHeight: 50,
    onInput: (value) => {
      instance.notes = value.trim() || undefined;
      updatePreview();
      onChange();
    }
  });
  (notesArea.style as any).gridColumn = "1 / -1";

  // Preview of formatted condition string
  const preview = container.createDiv({ cls: "sm-cc-condition-preview" });
  const updatePreview = () => {
    if (instance.condition?.trim()) {
      const formatted = formatConditionString(instance);
      preview.textContent = formatted;
      preview.addClass("sm-cc-condition-preview--valid");

      // Validate and show errors
      const errors = validateCondition(instance);
      if (errors.length > 0) {
        preview.addClass("sm-cc-condition-preview--error");
        preview.title = errors.join("\n");
      } else {
        preview.removeClass("sm-cc-condition-preview--error");
        preview.title = "";
      }
    } else {
      preview.textContent = "Select a condition";
      preview.removeClass("sm-cc-condition-preview--valid");
      preview.removeClass("sm-cc-condition-preview--error");
    }
  };

  updatePreview();

  // Re-render helper for dynamic UI updates
  const render = () => {
    // Clear and rebuild escape details when type changes
    escapeDetailsWrapper.empty();

    if (instance.escape && instance.escape.type !== "none") {
      const detailsGrid = escapeDetailsWrapper.createDiv({ cls: "sm-cc-condition-escape-details-grid" });

      if (instance.escape.type === "dc") {
        detailsGrid.createEl("label", { text: "DC", cls: "sm-cc-condition-field-label" });
        const dcInput = createNumberInput(detailsGrid, {
          className: "sm-cc-condition-escape-dc",
          placeholder: "14",
          ariaLabel: "Escape DC",
          value: instance.escape.dc,
          min: 1,
          max: 30,
          onChange: (value) => {
            if (instance.escape) {
              instance.escape.dc = value;
            }
            updatePreview();
            onChange();
          }
        });
        (dcInput.style as any).width = "5ch";
      } else if (instance.escape.type === "save") {
        detailsGrid.createEl("label", { text: "Ability", cls: "sm-cc-condition-field-label" });
        createSelectDropdown(detailsGrid, {
          className: "sm-cc-condition-escape-ability",
          options: [
            { value: "", label: "(None)" },
            ...CREATURE_ABILITY_LABELS.map((label) => ({
              value: label.toLowerCase(),
              label
            })),
          ],
          value: instance.escape.ability || "",
          onChange: (value) => {
            if (instance.escape) {
              instance.escape.ability = (value || undefined) as AbilityScoreKey | undefined;
            }
            updatePreview();
            onChange();
          }
        });

        detailsGrid.createEl("label", { text: "DC", cls: "sm-cc-condition-field-label" });
        const saveDcInput = createNumberInput(detailsGrid, {
          className: "sm-cc-condition-escape-dc",
          placeholder: "15",
          ariaLabel: "Save DC",
          value: instance.escape.dc,
          min: 1,
          max: 30,
          onChange: (value) => {
            if (instance.escape) {
              instance.escape.dc = value;
            }
            updatePreview();
            onChange();
          }
        });
        (saveDcInput.style as any).width = "5ch";
      } else if (instance.escape.type === "action") {
        detailsGrid.createEl("label", { text: "Description", cls: "sm-cc-condition-field-label" });
        createTextInput(detailsGrid, {
          className: "sm-cc-condition-escape-description",
          placeholder: "costs half movement to stand up",
          ariaLabel: "Escape Description",
          value: instance.escape.description || "",
          onInput: (value) => {
            if (instance.escape) {
              instance.escape.description = value.trim() || undefined;
            }
            updatePreview();
            onChange();
          }
        });
      }
    }

    updatePreview();
  };

  return container;
}

/**
 * Creates the complete condition component with multiple instances
 */
export function createConditionComponent(
  parent: HTMLElement,
  options: ConditionComponentOptions
): HTMLElement {
  const { conditions, data, onChange, maxConditions = 3 } = options;

  const section = parent.createDiv({ cls: "sm-cc-condition-component" });
  const header = section.createDiv({ cls: "sm-cc-condition-component-header" });
  header.createEl("h4", { text: "Conditions", cls: "sm-cc-condition-title" });

  const container = section.createDiv({ cls: "sm-cc-condition-instances" });

  // Render all condition instances
  const renderConditions = () => {
    container.empty();

    // Ensure at least one condition instance
    if (conditions.length === 0) {
      conditions.push({
        condition: "",
        duration: {
          amount: 1,
          unit: "minute"
        }
      });
    }

    conditions.forEach((condition, index) => {
      createConditionInstanceUI(
        container,
        condition,
        index,
        data,
        onChange,
        () => {
          // Delete this condition instance
          conditions.splice(index, 1);
          renderConditions();
          onChange();
        },
        index === 0
      );
    });

    // Add condition button
    if (conditions.length < maxConditions) {
      const addBtn = container.createEl("button", {
        cls: "sm-cc-condition-add-btn",
        text: "+ Add Condition",
        attr: { type: "button" }
      });

      addBtn.onclick = () => {
        conditions.push({
          condition: "",
          duration: {
            amount: 1,
            unit: "minute"
          }
        });
        renderConditions();
        onChange();
      };
    }
  };

  renderConditions();

  return section;
}

/**
 * Converts condition instances to a single formatted string
 * Example: "target is Grappled (escape DC 14) and is Poisoned for 1 minute"
 */
export function conditionInstancesToString(conditions: ConditionInstance[]): string {
  const validConditions = conditions
    .filter(c => c.condition?.trim() && validateCondition(c).length === 0);

  if (validConditions.length === 0) return "";

  const formattedConditions = validConditions.map(formatConditionString);

  if (formattedConditions.length === 1) {
    return formattedConditions[0];
  }

  // Join multiple conditions with "and"
  const lastCondition = formattedConditions.pop();
  return formattedConditions.join(", ") + ", and " + lastCondition;
}

/**
 * Parses a condition string back into condition instances
 * This is a best-effort parser for backwards compatibility
 */
export function parseConditionString(conditionStr: string): ConditionInstance[] {
  const instances: ConditionInstance[] = [];

  // Return empty array for empty strings
  if (!conditionStr || !conditionStr.trim()) return instances;

  // Split on "and" or commas
  const parts = conditionStr.split(/(?:,\s*)?(?:and\s+)/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const instance: ConditionInstance = {
      condition: "",
    };

    // Try to extract condition name
    for (const condType of CONDITION_TYPES) {
      if (trimmed.toLowerCase().includes(condType.value)) {
        instance.condition = condType.value;
        break;
      }
    }

    // Try to extract duration
    const durationMatch = trimmed.match(/for (\d+)\s+(\w+)/i);
    if (durationMatch) {
      instance.duration = {
        amount: parseInt(durationMatch[1], 10),
        unit: durationMatch[2].toLowerCase() as TimeUnit,
      };
    } else if (trimmed.toLowerCase().includes("permanently")) {
      instance.duration = { amount: 0, unit: "permanent" };
    }

    // Try to extract escape DC
    const dcMatch = trimmed.match(/(?:escape\s+)?DC\s+(\d+)/i);
    if (dcMatch) {
      instance.escape = {
        type: "dc",
        dc: parseInt(dcMatch[1], 10),
      };
    }

    // Try to extract save to end
    const saveMatch = trimmed.match(/DC\s+(\d+)\s+(\w+)\s+save/i);
    if (saveMatch) {
      const abilityName = saveMatch[2].toLowerCase();
      const abilityMap: Record<string, AbilityScoreKey> = {
        strength: "str",
        dexterity: "dex",
        constitution: "con",
        intelligence: "int",
        wisdom: "wis",
        charisma: "cha",
      };

      instance.escape = {
        type: "save",
        dc: parseInt(saveMatch[1], 10),
        ability: abilityMap[abilityName] || abilityName.substring(0, 3) as AbilityScoreKey,
      };
    }

    // Only add if we found a valid condition
    if (instance.condition) {
      instances.push(instance);
    }
  }

  return instances;
}

/**
 * Validates all condition instances and returns errors
 */
export function validateConditions(conditions: ConditionInstance[]): string[] {
  const errors: string[] = [];

  conditions.forEach((condition, index) => {
    const conditionErrors = validateCondition(condition);
    conditionErrors.forEach((error) => {
      errors.push(`Condition ${index + 1}: ${error}`);
    });
  });

  return errors;
}
