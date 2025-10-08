// src/apps/library/create/creature/components/ui-components.ts
// Consolidated UI components for entry editor (Area, Condition, Recharge, Uses)

// src/apps/library/create/creature/components/area-component.ts
// Modular Area component for area-of-effect abilities (cones, spheres, lines, etc.)

import { createTextInput, createSelectDropdown, createNumberInput } from "../../shared/form-controls";
import type { AreaComponent as AreaComponentType, AreaShape } from "./types";
import { setIcon } from "obsidian";

/**
 * Unit types for area measurements
 */
export type DistanceUnit = "feet" | "meters";

/**
 * Origin point types for area effects
 */
export type OriginType = "self" | "point" | "target" | "custom";

/**
 * Configuration for an area instance with enhanced dimension handling
 */
export interface AreaInstance {
  shape: AreaShape;
  /** Primary dimension (e.g., radius for sphere, length for line) */
  size: number | string;
  /** Secondary dimension (e.g., width for line, height for cylinder) */
  secondarySize?: number | string;
  /** Distance unit (feet or meters) */
  unit: DistanceUnit;
  /** Origin point of the area */
  origin: OriginType | string;
  /** Additional notes about the area */
  notes?: string;
}

/**
 * Options for creating an area component
 */
export interface AreaComponentOptions {
  area?: AreaInstance;
  onChange: () => void;
  /** Whether to show unit selector (default: true) */
  showUnitSelector?: boolean;
  /** Whether to show ASCII preview diagram (default: true) */
  showPreview?: boolean;
}

/**
 * Handle for interacting with an area component
 */
export interface AreaComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Refresh the component to reflect area changes */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
  /** Get the current area configuration */
  getArea: () => AreaInstance;
}

/**
 * Shape-specific dimension labels
 */
const SHAPE_DIMENSION_LABELS: Record<AreaShape, { primary: string; secondary?: string }> = {
  cone: { primary: "Length" },
  sphere: { primary: "Radius" },
  cube: { primary: "Side Length" },
  line: { primary: "Length", secondary: "Width" },
  cylinder: { primary: "Radius", secondary: "Height" },
  emanation: { primary: "Radius" },
};

/**
 * Common origin presets
 */
const ORIGIN_PRESETS: Array<{ value: OriginType; label: string }> = [
  { value: "self", label: "Self" },
  { value: "point", label: "Point within range" },
  { value: "target", label: "Target creature" },
  { value: "custom", label: "Custom..." },
];

/**
 * Validates area size value
 * Accepts numbers or number strings (e.g., "20", "5.5")
 */
export function validateAreaSize(size: number | string): boolean {
  if (typeof size === "number") {
    return Number.isFinite(size) && size > 0;
  }

  const trimmed = String(size).trim();
  if (!trimmed) return false;

  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return false;
  }

  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0;
}

/**
 * Normalizes area size to a number
 */
export function normalizeAreaSize(size: number | string): number {
  if (typeof size === "number") return size;
  return parseFloat(String(size).trim());
}

/**
 * Formats an area instance into a human-readable string
 * Examples:
 * - "60-foot cone"
 * - "20-foot radius sphere"
 * - "30-foot line that is 5 feet wide"
 * - "5-foot emanation"
 * - "10-foot radius, 40-foot high cylinder"
 */
export function formatAreaString(area: AreaInstance): string {
  const size = normalizeAreaSize(area.size);
  const unit = area.unit === "feet" ? "foot" : "meter";
  const unitPlural = area.unit === "feet" ? "feet" : "meters";

  // Choose unit form based on size
  const unitStr = size === 1 ? unit : unitPlural;

  switch (area.shape) {
    case "cone":
      return `${size}-${unit} cone`;

    case "sphere":
      return `${size}-${unit} radius sphere`;

    case "cube":
      return `${size}-${unit} cube`;

    case "emanation":
      return `${size}-${unit} emanation`;

    case "line": {
      if (area.secondarySize && validateAreaSize(area.secondarySize)) {
        const width = normalizeAreaSize(area.secondarySize);
        const widthUnit = width === 1 ? unit : unitPlural;
        return `${size}-${unit} line that is ${width} ${widthUnit} wide`;
      }
      return `${size}-${unit} line`;
    }

    case "cylinder": {
      if (area.secondarySize && validateAreaSize(area.secondarySize)) {
        const height = normalizeAreaSize(area.secondarySize);
        const heightUnit = height === 1 ? unit : unitPlural;
        return `${size}-${unit} radius, ${height}-${unit} high cylinder`;
      }
      return `${size}-${unit} radius cylinder`;
    }

    default:
      return `${size}-${unitStr} ${area.shape}`;
  }
}

/**
 * Formats origin description
 */
export function formatOriginString(area: AreaInstance): string {
  switch (area.origin) {
    case "self":
      return "Originates from self";
    case "point":
      return "Originates from a point within range";
    case "target":
      return "Originates from target creature";
    case "custom":
      return area.notes || "Custom origin";
    default:
      return area.origin || "Unspecified origin";
  }
}

/**
 * Generates ASCII art preview for area shape
 */
export function generateAreaPreview(area: AreaInstance): string {
  const size = normalizeAreaSize(area.size);

  switch (area.shape) {
    case "cone":
      return `
      You
       |
      /|\\
     / | \\
    /  |  \\
   /___|___\\
      `.trim();

    case "sphere":
      return `
     ___
   /     \\
  |   @   |
   \\_____/
      `.trim();

    case "cube":
      return `
    +-----+
   /     /|
  +-----+ |
  |     | +
  |  @  |/
  +-----+
      `.trim();

    case "line":
      return `
  @ ========>
      `.trim();

    case "cylinder":
      return `
    _____
   / @ @ \\
  |  @ @  |
  |  @ @  |
   \\_____/
      `.trim();

    case "emanation":
      return `
     ___
   /     \\
  |  You  |
   \\_____/
      `.trim();

    default:
      return `Area of effect: ${area.shape}`;
  }
}

/**
 * Creates an area component for AoE abilities
 *
 * Features:
 * - Area shape selector (cone, sphere, cube, line, cylinder, emanation)
 * - Dynamic dimension inputs based on shape
 * - Unit selector (feet/meters)
 * - Origin point selector
 * - ASCII art preview
 * - Real-time validation
 *
 * @example
 * ```ts
 * const handle = createAreaComponent(container, {
 *   area: { shape: "cone", size: 60, unit: "feet", origin: "self" },
 *   onChange: () => console.log("Area updated")
 * });
 * ```
 */
export function createAreaComponent(
  parent: HTMLElement,
  options: AreaComponentOptions
): AreaComponentHandle {
  const {
    onChange,
    showUnitSelector = true,
    showPreview = true
  } = options;

  // Initialize area with defaults if not provided
  let area: AreaInstance = options.area || {
    shape: "cone",
    size: 15,
    unit: "feet",
    origin: "self",
  };

  const container = parent.createDiv({ cls: "sm-cc-area-component" });

  // Store UI element references
  let shapeSelect: HTMLSelectElement;
  let sizeInput: HTMLInputElement;
  let secondarySizeInput: HTMLInputElement | null = null;
  let unitSelect: HTMLSelectElement;
  let originSelect: HTMLSelectElement;
  let originCustomInput: HTMLInputElement | null = null;
  let notesInput: HTMLInputElement;
  let previewContainer: HTMLElement;

  /**
   * Renders the complete area component UI
   */
  const render = () => {
    container.empty();

    // Header
    const header = container.createDiv({ cls: "sm-cc-area-header" });
    const titleRow = header.createDiv({ cls: "sm-cc-area-title-row" });
    titleRow.createEl("h4", { text: "Area of Effect", cls: "sm-cc-area-title" });

    // Grid for area fields
    const grid = container.createDiv({ cls: "sm-cc-area-grid" });

    // === Row 1: Shape ===
    grid.createEl("label", { text: "Shape", cls: "sm-cc-area-label" });
    const shapeWrapper = grid.createDiv({ cls: "sm-cc-area-shape-wrapper" });

    const shapeHandle = createSelectDropdown(shapeWrapper, {
      className: "sm-cc-area-shape-select",
      options: [
        { value: "cone", label: "Cone" },
        { value: "sphere", label: "Sphere" },
        { value: "cube", label: "Cube" },
        { value: "line", label: "Line" },
        { value: "cylinder", label: "Cylinder" },
        { value: "emanation", label: "Emanation" },
      ],
      value: area.shape,
      ariaLabel: "Area Shape",
      onChange: (value) => {
        area.shape = value as AreaShape;

        // Reset secondary size when shape changes
        if (!SHAPE_DIMENSION_LABELS[area.shape].secondary) {
          area.secondarySize = undefined;
        }

        render(); // Re-render to show/hide secondary dimension
        onChange();
      },
    });
    shapeSelect = shapeHandle.element;

    // === Row 2: Primary Dimension ===
    const dimensionLabel = SHAPE_DIMENSION_LABELS[area.shape].primary;
    grid.createEl("label", { text: dimensionLabel, cls: "sm-cc-area-label" });

    const sizeWrapper = grid.createDiv({ cls: "sm-cc-area-size-wrapper" });
    sizeInput = createNumberInput(sizeWrapper, {
      className: "sm-cc-area-size-input",
      placeholder: "15",
      ariaLabel: dimensionLabel,
      value: typeof area.size === "number" ? area.size : parseFloat(String(area.size)),
      min: 0,
      step: 5,
      onChange: (value) => {
        area.size = value || 0;
        updatePreview();
        onChange();
      },
    });
    (sizeInput.style as any).width = "8ch";

    // Unit indicator next to size
    const unitIndicator = sizeWrapper.createSpan({
      cls: "sm-cc-area-unit-indicator",
      text: area.unit,
    });

    // === Row 3: Secondary Dimension (if applicable) ===
    const secondaryLabel = SHAPE_DIMENSION_LABELS[area.shape].secondary;
    if (secondaryLabel) {
      grid.createEl("label", { text: secondaryLabel, cls: "sm-cc-area-label" });

      const secondarySizeWrapper = grid.createDiv({ cls: "sm-cc-area-size-wrapper" });
      secondarySizeInput = createNumberInput(secondarySizeWrapper, {
        className: "sm-cc-area-size-input",
        placeholder: area.shape === "line" ? "5" : "20",
        ariaLabel: secondaryLabel,
        value: area.secondarySize
          ? (typeof area.secondarySize === "number" ? area.secondarySize : parseFloat(String(area.secondarySize)))
          : undefined,
        min: 0,
        step: 5,
        onChange: (value) => {
          area.secondarySize = value || undefined;
          updatePreview();
          onChange();
        },
      });
      (secondarySizeInput.style as any).width = "8ch";

      // Unit indicator
      secondarySizeWrapper.createSpan({
        cls: "sm-cc-area-unit-indicator",
        text: area.unit,
      });
    }

    // === Row 4: Unit Selector (if enabled) ===
    if (showUnitSelector) {
      grid.createEl("label", { text: "Unit", cls: "sm-cc-area-label" });

      const unitHandle = createSelectDropdown(grid, {
        className: "sm-cc-area-unit-select",
        options: [
          { value: "feet", label: "Feet" },
          { value: "meters", label: "Meters" },
        ],
        value: area.unit,
        ariaLabel: "Distance Unit",
        onChange: (value) => {
          area.unit = value as DistanceUnit;

          // Update unit indicators
          unitIndicator.textContent = area.unit;
          if (secondaryLabel) {
            const secondaryIndicator = container.querySelector(".sm-cc-area-size-wrapper:nth-of-type(2) .sm-cc-area-unit-indicator");
            if (secondaryIndicator) {
              secondaryIndicator.textContent = area.unit;
            }
          }

          updatePreview();
          onChange();
        },
      });
      unitSelect = unitHandle.element;
    }

    // === Row 5: Origin ===
    grid.createEl("label", { text: "Origin", cls: "sm-cc-area-label" });

    const originWrapper = grid.createDiv({ cls: "sm-cc-area-origin-wrapper" });
    const originHandle = createSelectDropdown(originWrapper, {
      className: "sm-cc-area-origin-select",
      options: ORIGIN_PRESETS,
      value: (ORIGIN_PRESETS.find(p => p.value === area.origin) ? area.origin : "custom") as OriginType,
      ariaLabel: "Area Origin",
      onChange: (value) => {
        area.origin = value;

        // Show/hide custom input
        if (value === "custom") {
          if (!originCustomInput) {
            originCustomInput = createTextInput(originWrapper, {
              className: "sm-cc-area-origin-custom",
              placeholder: "e.g., a point you can see",
              ariaLabel: "Custom Origin",
              value: area.notes || "",
              onInput: (val) => {
                area.notes = val.trim() || undefined;
                updatePreview();
                onChange();
              },
            });
          }
          originCustomInput.style.display = "";
        } else {
          if (originCustomInput) {
            originCustomInput.style.display = "none";
          }
          area.notes = undefined;
        }

        updatePreview();
        onChange();
      },
    });
    originSelect = originHandle.element;

    // Custom origin input (only if already set to custom)
    if (area.origin === "custom" || !ORIGIN_PRESETS.find(p => p.value === area.origin)) {
      originCustomInput = createTextInput(originWrapper, {
        className: "sm-cc-area-origin-custom",
        placeholder: "e.g., a point you can see",
        ariaLabel: "Custom Origin",
        value: area.notes || (typeof area.origin === "string" && area.origin !== "custom" ? area.origin : ""),
        onInput: (val) => {
          area.notes = val.trim() || undefined;
          updatePreview();
          onChange();
        },
      });
    }

    // === Preview Section ===
    if (showPreview) {
      const previewSection = container.createDiv({ cls: "sm-cc-area-preview-section" });

      // Formatted output
      const outputBox = previewSection.createDiv({ cls: "sm-cc-area-output" });
      const outputText = outputBox.createDiv({ cls: "sm-cc-area-output-text" });

      // ASCII diagram
      const diagramBox = previewSection.createDiv({ cls: "sm-cc-area-diagram" });
      const diagram = diagramBox.createEl("pre", { cls: "sm-cc-area-diagram-ascii" });

      previewContainer = previewSection;

      // Helper to update preview content
      const updatePreviewContent = () => {
        // Update formatted text
        if (validateAreaSize(area.size)) {
          const areaStr = formatAreaString(area);
          const originStr = formatOriginString(area);
          outputText.innerHTML = `
            <div class="sm-cc-area-output-main">${areaStr}</div>
            <div class="sm-cc-area-output-origin">${originStr}</div>
          `;
          outputBox.removeClass("sm-cc-area-output--invalid");
        } else {
          outputText.innerHTML = `
            <div class="sm-cc-area-output-main sm-cc-area-output--error">Invalid area size</div>
          `;
          outputBox.addClass("sm-cc-area-output--invalid");
        }

        // Update ASCII diagram
        diagram.textContent = generateAreaPreview(area);
      };

      updatePreviewContent();
    }

    // Helper function accessible to input handlers
    const updatePreview = () => {
      if (!showPreview || !previewContainer) return;

      const outputText = previewContainer.querySelector(".sm-cc-area-output-text");
      const outputBox = previewContainer.querySelector(".sm-cc-area-output");
      const diagram = previewContainer.querySelector(".sm-cc-area-diagram-ascii");

      if (outputText && outputBox) {
        if (validateAreaSize(area.size)) {
          const areaStr = formatAreaString(area);
          const originStr = formatOriginString(area);
          outputText.innerHTML = `
            <div class="sm-cc-area-output-main">${areaStr}</div>
            <div class="sm-cc-area-output-origin">${originStr}</div>
          `;
          outputBox.removeClass("sm-cc-area-output--invalid");
        } else {
          outputText.innerHTML = `
            <div class="sm-cc-area-output-main sm-cc-area-output--error">Invalid area size</div>
          `;
          outputBox.addClass("sm-cc-area-output--invalid");
        }
      }

      if (diagram) {
        diagram.textContent = generateAreaPreview(area);
      }
    };
  };

  /**
   * Validates the area configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];

    if (!area.shape) {
      errors.push("Area shape is required");
    }

    if (!validateAreaSize(area.size)) {
      errors.push("Area size must be a positive number");
    }

    // Validate secondary dimension if applicable
    const secondaryLabel = SHAPE_DIMENSION_LABELS[area.shape]?.secondary;
    if (secondaryLabel && area.secondarySize !== undefined && !validateAreaSize(area.secondarySize)) {
      errors.push(`${secondaryLabel} must be a positive number`);
    }

    if (!area.origin) {
      errors.push("Area origin is required");
    }

    return errors;
  };

  /**
   * Gets the current area configuration
   */
  const getArea = (): AreaInstance => {
    return { ...area };
  };

  // Initial render
  render();

  return {
    container,
    refresh: render,
    validate,
    getArea,
  };
}

/**
 * Converts an AreaInstance to the AreaComponent type from types.ts
 */
export function toAreaComponentType(instance: AreaInstance): AreaComponentType {
  let size = String(normalizeAreaSize(instance.size));

  // Include secondary size for shapes that need it
  if (instance.secondarySize && validateAreaSize(instance.secondarySize)) {
    const secondary = normalizeAreaSize(instance.secondarySize);
    size = `${size} × ${secondary}`;
  }

  return {
    type: "area",
    shape: instance.shape,
    size,
    origin: formatOriginString(instance),
    notes: instance.notes,
  };
}

/**
 * Converts an AreaComponent from types.ts to an AreaInstance
 */
export function fromAreaComponentType(component: AreaComponentType): AreaInstance {
  // Parse size (might be "20" or "30 × 5")
  const sizeMatch = component.size.match(/^(\d+(?:\.\d+)?)\s*(?:×|x)\s*(\d+(?:\.\d+)?)?$/i);

  let size: number;
  let secondarySize: number | undefined;

  if (sizeMatch) {
    // Has secondary dimension
    size = parseFloat(sizeMatch[1]);
    secondarySize = sizeMatch[2] ? parseFloat(sizeMatch[2]) : undefined;
  } else {
    // Single dimension
    size = parseFloat(component.size);
  }

  // Infer origin type from origin string
  let origin: OriginType | string = "custom";
  if (component.origin?.toLowerCase().includes("self")) {
    origin = "self";
  } else if (component.origin?.toLowerCase().includes("point")) {
    origin = "point";
  } else if (component.origin?.toLowerCase().includes("target")) {
    origin = "target";
  } else if (component.origin) {
    origin = component.origin;
  }

  return {
    shape: component.shape,
    size,
    secondarySize,
    unit: "feet", // Default to feet
    origin,
    notes: component.notes,
  };
}

/**
 * Validates an area component from types.ts
 */
export function validateAreaComponent(component: AreaComponentType): string[] {
  const errors: string[] = [];

  if (!component.shape) {
    errors.push("Area shape is required");
  }

  const rawSize = component.size?.trim() ?? "";

  if (!rawSize) {
    errors.push("Area size is required");
  } else {
    const separatorPattern = /[×x]/i;

    if (separatorPattern.test(rawSize)) {
      const parts = rawSize.split(separatorPattern).map(part => part.trim()).filter(Boolean);
      if (parts.length !== 2) {
        errors.push("Area size must contain two positive numbers when using a secondary dimension");
      } else {
        const [primaryRaw, secondaryRaw] = parts;
        if (!validateAreaSize(primaryRaw)) {
          errors.push("Primary area dimension must be a positive number");
        }
        if (!validateAreaSize(secondaryRaw)) {
          errors.push("Secondary area dimension must be a positive number");
        }
      }
    } else if (!validateAreaSize(rawSize)) {
      errors.push("Area size must be a positive number");
    }
  }

  return errors;
}
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
// src/apps/library/create/creature/components/recharge-component.ts
// Modular Recharge component for abilities with dice-based recharge mechanics

import { createSelectDropdown, createTextInput } from "../../shared/form-controls";
import type { RechargeComponent } from "./types";

/**
 * Options for creating a recharge component
 */
export interface RechargeComponentOptions {
  /** Initial recharge configuration */
  recharge?: RechargeComponent;
  /** Callback when recharge data changes */
  onUpdate: (recharge: RechargeComponent | undefined) => void;
  /** Optional compact mode for inline display */
  compact?: boolean;
}

/**
 * Handle for interacting with a recharge component
 */
export interface RechargeComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Get current recharge configuration */
  getValue: () => RechargeComponent | undefined;
  /** Set recharge configuration */
  setValue: (recharge: RechargeComponent | undefined) => void;
  /** Refresh the component display */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
}

/**
 * Common recharge presets for quick selection
 */
const RECHARGE_PRESETS = [
  { min: 5, max: 6, label: "5-6" },
  { min: 6, max: 6, label: "6" },
  { min: 4, max: 6, label: "4-6" },
  { min: 3, max: 6, label: "3-6" },
] as const;

/**
 * Timing options for when recharge roll occurs
 */
const TIMING_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "start of turn", label: "Start of turn" },
  { value: "end of turn", label: "End of turn" },
  { value: "start of combat", label: "Start of combat" },
  { value: "after use", label: "After use" },
] as const;

/**
 * Creates a recharge component for dice-based recharge mechanics
 *
 * Features:
 * - Quick preset buttons for common ranges (5-6, 6, 4-6, etc.)
 * - Visual die representation with selected range
 * - Custom range selection (min-max)
 * - Timing selector (start/end of turn)
 * - Compact inline mode
 *
 * Outputs format: "(Recharge 5-6)", "(Recharge 6)", "(Recharge 4-6 at start of turn)"
 *
 * @example
 * ```ts
 * const handle = createRechargeComponent(container, {
 *   recharge: { type: "recharge", min: 5, max: 6 },
 *   onUpdate: (recharge) => console.log("Updated:", recharge),
 *   compact: false
 * });
 * ```
 */
export function createRechargeComponent(
  parent: HTMLElement,
  options: RechargeComponentOptions
): RechargeComponentHandle {
  const { onUpdate, compact = false } = options;

  // Internal state
  let currentRecharge: RechargeComponent | undefined = options.recharge;

  const container = parent.createDiv({
    cls: compact ? "sm-cc-recharge-component sm-cc-recharge-component--compact" : "sm-cc-recharge-component",
  });

  /**
   * Renders the complete recharge component UI
   */
  const render = () => {
    container.empty();

    // Header with toggle
    const header = container.createDiv({ cls: "sm-cc-recharge-header" });

    const enableCheckbox = header.createEl("input", {
      cls: "sm-cc-recharge-toggle",
      attr: {
        type: "checkbox",
        "aria-label": "Enable recharge mechanic",
      },
    }) as HTMLInputElement;

    enableCheckbox.checked = !!currentRecharge;

    header.createEl("label", {
      text: "Recharge Mechanic",
      cls: "sm-cc-recharge-label",
    });

    // Die icon for visual representation
    const dieIcon = header.createDiv({ cls: "sm-cc-recharge-die-icon" });
    dieIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    `;

    // Toggle enable/disable
    enableCheckbox.addEventListener("change", () => {
      if (enableCheckbox.checked) {
        // Enable with default preset (5-6)
        currentRecharge = {
          type: "recharge",
          min: 5,
          max: 6,
        };
      } else {
        // Disable
        currentRecharge = undefined;
      }
      onUpdate(currentRecharge);
      render();
    });

    // Only show configuration if enabled
    if (!currentRecharge) {
      return;
    }

    // Preset buttons section
    const presetsSection = container.createDiv({ cls: "sm-cc-recharge-presets" });
    presetsSection.createDiv({
      text: "Quick Presets:",
      cls: "sm-cc-recharge-presets-label",
    });

    const presetsButtons = presetsSection.createDiv({
      cls: "sm-cc-recharge-preset-buttons",
    });

    RECHARGE_PRESETS.forEach((preset) => {
      const isActive =
        currentRecharge?.min === preset.min && currentRecharge?.max === preset.max;

      const btn = presetsButtons.createEl("button", {
        cls: isActive
          ? "sm-cc-recharge-preset-btn active"
          : "sm-cc-recharge-preset-btn",
        text: preset.label,
        attr: {
          type: "button",
          "aria-label": `Set recharge to ${preset.label}`,
          "aria-pressed": String(isActive),
        },
      });

      btn.onclick = () => {
        currentRecharge = {
          type: "recharge",
          min: preset.min,
          max: preset.max,
          timing: currentRecharge?.timing,
        };
        onUpdate(currentRecharge);
        render();
      };
    });

    // Custom range section
    const customSection = container.createDiv({ cls: "sm-cc-recharge-custom" });
    customSection.createDiv({
      text: "Custom Range:",
      cls: "sm-cc-recharge-custom-label",
    });

    const customGrid = customSection.createDiv({ cls: "sm-cc-recharge-custom-grid" });

    // Min value selector
    const minWrapper = customGrid.createDiv({ cls: "sm-cc-recharge-input-wrapper" });
    minWrapper.createSpan({ text: "Min:", cls: "sm-cc-recharge-input-label" });

    const minSelect = createSelectDropdown(minWrapper, {
      className: "sm-cc-recharge-select",
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      value: currentRecharge.min,
      ariaLabel: "Minimum recharge roll",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.min = Number(value);
          // Ensure max is at least min
          if (currentRecharge.max && currentRecharge.max < currentRecharge.min) {
            currentRecharge.max = currentRecharge.min;
          }
          onUpdate(currentRecharge);
          render();
        }
      },
    }).element;

    // Max value selector
    const maxWrapper = customGrid.createDiv({ cls: "sm-cc-recharge-input-wrapper" });
    maxWrapper.createSpan({ text: "Max:", cls: "sm-cc-recharge-input-label" });

    const maxSelect = createSelectDropdown(maxWrapper, {
      className: "sm-cc-recharge-select",
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      value: currentRecharge.max || 6,
      ariaLabel: "Maximum recharge roll",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.max = Number(value);
          onUpdate(currentRecharge);
          render();
        }
      },
    }).element;

    // Visual die representation
    const dieVisual = container.createDiv({ cls: "sm-cc-recharge-die-visual" });
    renderDieVisual(dieVisual, currentRecharge.min, currentRecharge.max || 6);

    // Timing selector
    const timingSection = container.createDiv({ cls: "sm-cc-recharge-timing" });
    timingSection.createDiv({
      text: "Recharge Timing:",
      cls: "sm-cc-recharge-timing-label",
    });

    const timingSelect = createSelectDropdown(timingSection, {
      className: "sm-cc-recharge-timing-select",
      options: TIMING_OPTIONS,
      value: currentRecharge.timing || "",
      ariaLabel: "When recharge roll occurs",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.timing = value || undefined;
          onUpdate(currentRecharge);
        }
      },
    }).element;

    // Preview output
    const preview = container.createDiv({ cls: "sm-cc-recharge-preview" });
    preview.createDiv({
      text: "Output Preview:",
      cls: "sm-cc-recharge-preview-label",
    });
    preview.createDiv({
      text: formatRechargeOutput(currentRecharge),
      cls: "sm-cc-recharge-preview-text",
    });
  };

  /**
   * Renders a visual die with highlighted faces
   */
  const renderDieVisual = (container: HTMLElement, min: number, max: number) => {
    container.empty();

    for (let face = 1; face <= 6; face++) {
      const isInRange = face >= min && face <= max;
      const faceEl = container.createDiv({
        cls: isInRange
          ? "sm-cc-recharge-die-face active"
          : "sm-cc-recharge-die-face",
        text: String(face),
        attr: {
          "aria-label": isInRange
            ? `Face ${face} (in recharge range)`
            : `Face ${face}`,
          role: "presentation",
        },
      });
    }
  };

  /**
   * Validates the recharge configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];

    if (currentRecharge) {
      if (currentRecharge.min < 1 || currentRecharge.min > 6) {
        errors.push("Recharge minimum must be between 1 and 6");
      }

      if (currentRecharge.max && currentRecharge.max < currentRecharge.min) {
        errors.push("Recharge maximum must be greater than or equal to minimum");
      }

      if (currentRecharge.max && (currentRecharge.max < 1 || currentRecharge.max > 6)) {
        errors.push("Recharge maximum must be between 1 and 6");
      }
    }

    return errors;
  };

  // Initial render
  render();

  return {
    container,
    getValue: () => currentRecharge,
    setValue: (recharge) => {
      currentRecharge = recharge;
      render();
    },
    refresh: render,
    validate,
  };
}

/**
 * Formats a recharge component for display/output
 *
 * @example
 * ```ts
 * formatRechargeOutput({ type: "recharge", min: 5, max: 6 })
 * // "(Recharge 5-6)"
 *
 * formatRechargeOutput({ type: "recharge", min: 6, max: 6 })
 * // "(Recharge 6)"
 *
 * formatRechargeOutput({ type: "recharge", min: 5, max: 6, timing: "start of turn" })
 * // "(Recharge 5-6 at start of turn)"
 * ```
 */
export function formatRechargeOutput(recharge: RechargeComponent): string {
  if (!recharge) return "";

  const max = recharge.max ?? 6;
  let rangeText: string;

  if (recharge.min === max) {
    // Single number (e.g., "6")
    rangeText = String(recharge.min);
  } else if (max === 6) {
    // Standard range ending at 6 (e.g., "5-6")
    rangeText = `${recharge.min}-6`;
  } else {
    // Custom range (e.g., "3-5")
    rangeText = `${recharge.min}-${max}`;
  }

  let output = `(Recharge ${rangeText}`;

  if (recharge.timing) {
    output += ` at ${recharge.timing}`;
  }

  output += ")";

  return output;
}

/**
 * Validates a recharge component and returns validation errors
 */
export function validateRechargeComponent(recharge: RechargeComponent): string[] {
  const errors: string[] = [];

  if (recharge.min < 1 || recharge.min > 6) {
    errors.push("Recharge minimum must be between 1 and 6");
  }

  if (recharge.max !== undefined) {
    if (recharge.max < recharge.min) {
      errors.push("Recharge maximum must be greater than or equal to minimum");
    }
    if (recharge.max < 1 || recharge.max > 6) {
      errors.push("Recharge maximum must be between 1 and 6");
    }
  }

  return errors;
}

/**
 * Parses a recharge string into a RechargeComponent
 *
 * @example
 * ```ts
 * parseRechargeString("Recharge 5-6")
 * // { type: "recharge", min: 5, max: 6 }
 *
 * parseRechargeString("Recharge 6")
 * // { type: "recharge", min: 6, max: 6 }
 *
 * parseRechargeString("(Recharge 4-6 at start of turn)")
 * // { type: "recharge", min: 4, max: 6, timing: "start of turn" }
 * ```
 */
export function parseRechargeString(str: string): RechargeComponent | undefined {
  if (!str) return undefined;

  // Match patterns like "Recharge 5-6", "(Recharge 6)", "Recharge 4-6 at start of turn"
  const match = str.match(/recharge\s+(\d+)(?:-(\d+))?(?:\s+at\s+(.+?))?(?:\)|$)/i);

  if (!match) return undefined;

  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  const timing = match[3]?.trim();

  return {
    type: "recharge",
    min,
    max,
    timing: timing || undefined,
  };
}
// src/apps/library/create/creature/components/uses-component.ts
// Modular Uses component for abilities with limited uses per rest/day

import { createNumberInput, createSelectDropdown, createTextInput } from "../../shared/form-controls";
import type { UsesComponent } from "./types";

/**
 * Options for creating a uses component
 */
export interface UsesComponentOptions {
  /** Initial uses configuration */
  uses?: UsesComponent;
  /** Callback when uses data changes */
  onUpdate: (uses: UsesComponent | undefined) => void;
  /** Optional compact mode for inline display */
  compact?: boolean;
  /** Enable stateful tracking of remaining uses */
  enableTracking?: boolean;
}

/**
 * Handle for interacting with a uses component
 */
export interface UsesComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Get current uses configuration */
  getValue: () => UsesComponent | undefined;
  /** Set uses configuration */
  setValue: (uses: UsesComponent | undefined) => void;
  /** Refresh the component display */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
  /** Get/set remaining uses (if tracking enabled) */
  getRemainingUses?: () => number;
  setRemainingUses?: (remaining: number) => void;
}

/**
 * Common count presets for quick selection
 */
const COUNT_PRESETS = [1, 2, 3, 4, 5] as const;

/**
 * Reset period options
 */
const RESET_PERIOD_OPTIONS = [
  { value: "day", label: "Per Day" },
  { value: "short", label: "Per Short Rest" },
  { value: "long", label: "Per Long Rest" },
  { value: "dawn", label: "Per Dawn" },
  { value: "dusk", label: "Per Dusk" },
  { value: "rest", label: "Per Rest (Any)" },
  { value: "custom", label: "Custom..." },
] as const;

/**
 * Creates a uses component for limited-use abilities
 *
 * Features:
 * - Number of uses input (1-99) with quick preset buttons
 * - Reset condition selector (Day, Short Rest, Long Rest, Dawn, Custom)
 * - Optional custom text for reset condition
 * - Optional stateful tracking of remaining uses
 * - Compact inline mode
 *
 * Outputs format: "(2/Day)", "(3/Long Rest)", "(1/Dawn)", "(5/Custom Text)"
 *
 * @example
 * ```ts
 * const handle = createUsesComponent(container, {
 *   uses: { type: "uses", count: 2, per: "day" },
 *   onUpdate: (uses) => console.log("Updated:", uses),
 *   compact: false,
 *   enableTracking: true
 * });
 * ```
 */
export function createUsesComponent(
  parent: HTMLElement,
  options: UsesComponentOptions
): UsesComponentHandle {
  const { onUpdate, compact = false, enableTracking = false } = options;

  // Internal state
  let currentUses: UsesComponent | undefined = options.uses;
  let remainingUses: number | undefined = currentUses?.count;
  let customText = "";

  const container = parent.createDiv({
    cls: compact ? "sm-cc-uses-component sm-cc-uses-component--compact" : "sm-cc-uses-component",
  });

  // Track custom text separately if "per" field is not a standard option
  if (currentUses && !isStandardPeriod(currentUses.per)) {
    customText = currentUses.per;
  }

  /**
   * Renders the complete uses component UI
   */
  const render = () => {
    container.empty();

    // Header with toggle
    const header = container.createDiv({ cls: "sm-cc-uses-header" });

    const enableCheckbox = header.createEl("input", {
      cls: "sm-cc-uses-toggle",
      attr: {
        type: "checkbox",
        "aria-label": "Enable limited uses",
      },
    }) as HTMLInputElement;

    enableCheckbox.checked = !!currentUses;

    header.createEl("label", {
      text: "Limited Uses",
      cls: "sm-cc-uses-label",
    });

    // Icon for visual representation
    const icon = header.createDiv({ cls: "sm-cc-uses-icon" });
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    `;

    // Toggle enable/disable
    enableCheckbox.addEventListener("change", () => {
      if (enableCheckbox.checked) {
        // Enable with default (1/Day)
        currentUses = {
          type: "uses",
          count: 1,
          per: "day",
        };
        remainingUses = 1;
      } else {
        // Disable
        currentUses = undefined;
        remainingUses = undefined;
      }
      onUpdate(currentUses);
      render();
    });

    // Only show configuration if enabled
    if (!currentUses) {
      return;
    }

    // Count section
    const countSection = container.createDiv({ cls: "sm-cc-uses-count-section" });
    countSection.createDiv({
      text: "Number of Uses:",
      cls: "sm-cc-uses-section-label",
    });

    // Quick preset buttons
    const presetsButtons = countSection.createDiv({
      cls: "sm-cc-uses-preset-buttons",
    });

    COUNT_PRESETS.forEach((count) => {
      const isActive = currentUses?.count === count;

      const btn = presetsButtons.createEl("button", {
        cls: isActive ? "sm-cc-uses-preset-btn active" : "sm-cc-uses-preset-btn",
        text: String(count),
        attr: {
          type: "button",
          "aria-label": `Set uses to ${count}`,
          "aria-pressed": String(isActive),
        },
      });

      btn.onclick = () => {
        if (currentUses) {
          currentUses.count = count;
          remainingUses = count;
          onUpdate(currentUses);
          render();
        }
      };
    });

    // Custom count input
    const countInputWrapper = countSection.createDiv({
      cls: "sm-cc-uses-count-input-wrapper",
    });
    countInputWrapper.createSpan({
      text: "or",
      cls: "sm-cc-uses-separator",
    });

    const countInput = createNumberInput(countInputWrapper, {
      className: "sm-cc-uses-count-input",
      placeholder: "Custom",
      ariaLabel: "Number of uses",
      value: currentUses.count,
      min: 1,
      max: 99,
      onChange: (value) => {
        if (currentUses && value !== undefined) {
          currentUses.count = value;
          remainingUses = value;
          onUpdate(currentUses);
          render();
        }
      },
    });

    // Reset period section
    const periodSection = container.createDiv({ cls: "sm-cc-uses-period-section" });
    periodSection.createDiv({
      text: "Resets:",
      cls: "sm-cc-uses-section-label",
    });

    const currentPeriod = isStandardPeriod(currentUses.per) ? currentUses.per : "custom";

    const periodSelect = createSelectDropdown(periodSection, {
      className: "sm-cc-uses-period-select",
      options: RESET_PERIOD_OPTIONS,
      value: currentPeriod,
      ariaLabel: "Reset period",
      onChange: (value) => {
        if (!currentUses) return;

        if (value === "custom") {
          // Switch to custom mode - use existing custom text or empty
          currentUses.per = customText || "Custom";
        } else {
          // Switch to standard period
          currentUses.per = value;
        }

        onUpdate(currentUses);
        render();
      },
    }).element;

    // Custom text input (shown only when custom is selected)
    if (currentPeriod === "custom") {
      const customInputWrapper = periodSection.createDiv({
        cls: "sm-cc-uses-custom-input-wrapper",
      });

      const customInput = createTextInput(customInputWrapper, {
        className: "sm-cc-uses-custom-input",
        placeholder: "e.g., Per Battle, Per Moon Phase...",
        ariaLabel: "Custom reset condition",
        value: customText || currentUses.per,
        onInput: (value) => {
          if (currentUses) {
            customText = value.trim();
            currentUses.per = customText || "Custom";
            onUpdate(currentUses);
          }
        },
      });
    }

    // Optional tracking section
    if (enableTracking) {
      const trackingSection = container.createDiv({
        cls: "sm-cc-uses-tracking-section",
      });

      trackingSection.createDiv({
        text: "Current Uses:",
        cls: "sm-cc-uses-section-label",
      });

      const trackingWrapper = trackingSection.createDiv({
        cls: "sm-cc-uses-tracking-wrapper",
      });

      // Decrement button
      const decrementBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-btn",
        text: "-",
        attr: {
          type: "button",
          "aria-label": "Use one charge",
          disabled: (remainingUses ?? 0) <= 0 ? "" : undefined,
        },
      });

      decrementBtn.onclick = () => {
        if (remainingUses !== undefined && remainingUses > 0) {
          remainingUses--;
          render();
        }
      };

      // Current/Max display
      const displayText = trackingWrapper.createDiv({
        cls: "sm-cc-uses-tracking-display",
        text: `${remainingUses ?? currentUses.count} / ${currentUses.count}`,
      });

      // Increment button
      const incrementBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-btn",
        text: "+",
        attr: {
          type: "button",
          "aria-label": "Restore one charge",
          disabled:
            (remainingUses ?? currentUses.count) >= currentUses.count ? "" : undefined,
        },
      });

      incrementBtn.onclick = () => {
        if (
          remainingUses !== undefined &&
          currentUses &&
          remainingUses < currentUses.count
        ) {
          remainingUses++;
          render();
        }
      };

      // Reset button
      const resetBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-reset-btn",
        text: "Reset",
        attr: {
          type: "button",
          "aria-label": "Reset uses to maximum",
        },
      });

      resetBtn.onclick = () => {
        if (currentUses) {
          remainingUses = currentUses.count;
          render();
        }
      };
    }

    // Preview output
    const preview = container.createDiv({ cls: "sm-cc-uses-preview" });
    preview.createDiv({
      text: "Output Preview:",
      cls: "sm-cc-uses-preview-label",
    });
    preview.createDiv({
      text: formatUsesOutput(currentUses),
      cls: "sm-cc-uses-preview-text",
    });
  };

  /**
   * Validates the uses configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];

    if (currentUses) {
      if (currentUses.count < 1 || currentUses.count > 99) {
        errors.push("Uses count must be between 1 and 99");
      }

      if (!currentUses.per || !currentUses.per.trim()) {
        errors.push("Reset period is required");
      }
    }

    return errors;
  };

  // Initial render
  render();

  const handle: UsesComponentHandle = {
    container,
    getValue: () => currentUses,
    setValue: (uses) => {
      currentUses = uses;
      remainingUses = uses?.count;
      if (uses && !isStandardPeriod(uses.per)) {
        customText = uses.per;
      }
      render();
    },
    refresh: render,
    validate,
  };

  // Add tracking methods if enabled
  if (enableTracking) {
    handle.getRemainingUses = () => remainingUses ?? currentUses?.count ?? 0;
    handle.setRemainingUses = (remaining) => {
      if (currentUses && remaining >= 0 && remaining <= currentUses.count) {
        remainingUses = remaining;
        render();
      }
    };
  }

  return handle;
}

/**
 * Checks if a period string is a standard option
 */
function isStandardPeriod(per: string): boolean {
  return ["day", "short", "long", "dawn", "dusk", "rest"].includes(per);
}

/**
 * Formats a uses component for display/output
 *
 * @example
 * ```ts
 * formatUsesOutput({ type: "uses", count: 2, per: "day" })
 * // "(2/Day)"
 *
 * formatUsesOutput({ type: "uses", count: 3, per: "long" })
 * // "(3/Long Rest)"
 *
 * formatUsesOutput({ type: "uses", count: 1, per: "dawn" })
 * // "(1/Dawn)"
 *
 * formatUsesOutput({ type: "uses", count: 5, per: "Battle" })
 * // "(5/Battle)"
 * ```
 */
export function formatUsesOutput(uses: UsesComponent): string {
  if (!uses) return "";

  const periodMap: Record<string, string> = {
    day: "Day",
    short: "Short Rest",
    long: "Long Rest",
    dawn: "Dawn",
    dusk: "Dusk",
    rest: "Rest",
  };

  const periodText = periodMap[uses.per] || uses.per;

  return `(${uses.count}/${periodText})`;
}

/**
 * Validates a uses component and returns validation errors
 */
export function validateUsesComponent(uses: UsesComponent): string[] {
  const errors: string[] = [];

  if (uses.count < 1 || uses.count > 99) {
    errors.push("Uses count must be between 1 and 99");
  }

  if (!uses.per || !uses.per.trim()) {
    errors.push("Reset period is required");
  }

  return errors;
}

/**
 * Parses a uses string into a UsesComponent
 *
 * @example
 * ```ts
 * parseUsesString("2/Day")
 * // { type: "uses", count: 2, per: "day" }
 *
 * parseUsesString("(3/Long Rest)")
 * // { type: "uses", count: 3, per: "long" }
 *
 * parseUsesString("1/Dawn")
 * // { type: "uses", count: 1, per: "dawn" }
 *
 * parseUsesString("5/Battle")
 * // { type: "uses", count: 5, per: "Battle" }
 * ```
 */
export function parseUsesString(str: string): UsesComponent | undefined {
  if (!str) return undefined;

  // Match patterns like "2/Day", "(3/Long Rest)", "1/Dawn"
  const match = str.match(/(\d+)\s*\/\s*(.+?)(?:\)|$)/i);

  if (!match) return undefined;

  const count = parseInt(match[1], 10);
  let per = match[2].trim();

  // Normalize common patterns to standard periods
  const normalizeMap: Record<string, string> = {
    day: "day",
    "short rest": "short",
    "long rest": "long",
    dawn: "dawn",
    dusk: "dusk",
    rest: "rest",
  };

  const normalized = normalizeMap[per.toLowerCase()];
  if (normalized) {
    per = normalized;
  }

  return {
    type: "uses",
    count,
    per,
  };
}
