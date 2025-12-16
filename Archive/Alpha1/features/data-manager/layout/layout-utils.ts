// src/features/data-manager/layout-utils.ts
// Utilities for calculating optimal grid layouts based on field dimensions

import type { AnyFieldSpec } from "../types";

export interface FieldDimensions {
  minControlWidth: number;  // Minimum width needed for the control
  isWide: boolean;          // Should always span full width
  hasFixedWidth: boolean;   // Has fixed width (doesn't flex)
}

/**
 * Calculates minimum dimensions for different field types.
 * Takes into account composite controls (multi-component fields).
 */
export class FieldWidthCalculator {
  private static readonly TYPE_DEFAULTS: Record<string, Partial<FieldDimensions>> = {
    // Simple inputs - flexible width
    'text': { minControlWidth: 180, isWide: false, hasFixedWidth: false },
    'select': { minControlWidth: 160, isWide: false, hasFixedWidth: false },
    'date': { minControlWidth: 140, isWide: false, hasFixedWidth: false },

    // Composite inputs - calculated from components
    'number-stepper': {
      // Decrement (32px) + gap (4px) + input (80px) + gap (4px) + increment (32px)
      minControlWidth: 152,
      isWide: false,
      hasFixedWidth: false
    },
    'tags': {
      // Input (min 180px) + gap (8px) + button (40px)
      // Tags get sm-cc-setting--wide class in modal.ts, so treat as wide
      minControlWidth: 228,
      isWide: true,
      hasFixedWidth: false
    },
    'structured-tags': {
      // Type input (min 180px) + value input (min 120px) + gap (8px) + button (40px)
      // Structured tags are always wide due to complexity
      minControlWidth: 368,
      isWide: true,
      hasFixedWidth: false
    },
    'autocomplete': {
      minControlWidth: 200,
      isWide: false,
      hasFixedWidth: false
    },

    // Small fixed-width controls
    'toggle': { minControlWidth: 60, isWide: false, hasFixedWidth: true },
    'color': { minControlWidth: 80, isWide: false, hasFixedWidth: true },

    // Multi-option controls - depends on options
    'multiselect': {
      minControlWidth: 200,  // Calculated dynamically
      isWide: false,
      hasFixedWidth: false
    },

    // Wide fields - always span all columns
    'textarea': { minControlWidth: 400, isWide: true, hasFixedWidth: false },
    'markdown': { minControlWidth: 500, isWide: true, hasFixedWidth: false },
    'repeating': { minControlWidth: 600, isWide: true, hasFixedWidth: false },
    'composite': { minControlWidth: 500, isWide: true, hasFixedWidth: false },
    'composite-stat': { minControlWidth: 500, isWide: true, hasFixedWidth: false },
    'array': { minControlWidth: 400, isWide: true, hasFixedWidth: false },
    'object': { minControlWidth: 400, isWide: true, hasFixedWidth: false },
  };

  static calculate(field: AnyFieldSpec): FieldDimensions {
    const defaults = this.TYPE_DEFAULTS[field.type] ?? {
      minControlWidth: 200,
      isWide: false,
      hasFixedWidth: false
    };

    // Spec override has priority
    if (field.minWidth !== undefined) {
      return {
        isWide: field.preferWide ?? defaults.isWide ?? false,
        hasFixedWidth: defaults.hasFixedWidth ?? false,
        minControlWidth: field.minWidth,
      };
    }

    // Type-specific calculations
    switch (field.type) {
      case 'multiselect':
        return this.calculateMultiselect(field, defaults);

      default:
        return {
          minControlWidth: defaults.minControlWidth ?? 200,
          isWide: field.preferWide ?? defaults.isWide ?? false,
          hasFixedWidth: defaults.hasFixedWidth ?? false,
        };
    }
  }

  private static calculateMultiselect(
    field: AnyFieldSpec,
    defaults: Partial<FieldDimensions>
  ): FieldDimensions {
    const options = (field as any).options ?? [];
    // Each option: checkbox (20px) + gap (8px) + label (variable, ~80px avg)
    const avgOptionWidth = 108;
    const optionsPerRow = 3; // Assumption
    const rows = Math.ceil(options.length / optionsPerRow);
    const minWidth = rows > 1
      ? optionsPerRow * avgOptionWidth
      : options.length * avgOptionWidth;

    return {
      minControlWidth: Math.max(minWidth, defaults.minControlWidth ?? 200),
      isWide: rows > 2, // Many options → wide
      hasFixedWidth: false,
    };
  }

}
