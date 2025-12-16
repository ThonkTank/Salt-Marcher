/**
 * Form Builder Types
 *
 * Shared types for form control builders.
 *
 * @module core/utils/form/types
 */

/**
 * Option for select dropdowns and button toggles.
 */
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Configuration for slider controls.
 */
export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  value: number;
}

/**
 * Options for label-value pair display.
 */
export interface LabelValueOptions {
  skipIfEmpty?: boolean;
  labelClass?: string;
  valueClass?: string;
}
