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
    return size > 0 && Number.isFinite(size);
  }

  const trimmed = String(size).trim();
  if (!trimmed) return false;

  const num = parseFloat(trimmed);
  return !isNaN(num) && num > 0 && Number.isFinite(num);
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

  if (!component.size?.trim()) {
    errors.push("Area size is required");
  } else {
    // Try to parse the size
    const sizeMatch = component.size.match(/^(\d+(?:\.\d+)?)\s*(?:×|x)\s*(\d+(?:\.\d+)?)?$/i);

    if (sizeMatch) {
      const primary = parseFloat(sizeMatch[1]);
      if (isNaN(primary) || primary <= 0) {
        errors.push("Primary area dimension must be a positive number");
      }

      if (sizeMatch[2]) {
        const secondary = parseFloat(sizeMatch[2]);
        if (isNaN(secondary) || secondary <= 0) {
          errors.push("Secondary area dimension must be a positive number");
        }
      }
    } else {
      const size = parseFloat(component.size);
      if (isNaN(size) || size <= 0) {
        errors.push("Area size must be a positive number");
      }
    }
  }

  return errors;
}
