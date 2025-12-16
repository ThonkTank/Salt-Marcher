// src/features/data-manager/types.ts
// Type definitions for the declarative data management system (modals, fields, storage)
import type { App } from "obsidian";

export type FieldType =
  | "text" | "textarea" | "number-stepper"
  | "select" | "multiselect" | "tokens"
  | "checkbox" | "clickable-icon" | "date" | "color"
  | "markdown" | "array" | "object" | "composite-stat"
  | "composite" | "repeating" | "autocomplete" | "display" | "heading";

export type FieldOption<T extends string = string> = { value: T; label: string };

export interface FieldVisibilityRule {
  dependsOn?: string[];
  visibleIf?: (values: Record<string, unknown>) => boolean;
}

export interface FieldSpec<T = unknown> extends FieldVisibilityRule {
  id: string;
  label: string;
  type: FieldType;
  section?: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: FieldOption[];
  default?: T;
  storageKey?: string;
  validate?: (value: T, all: Record<string, unknown>) => string | null;
  transform?: (value: T, all: Record<string, unknown>) => unknown;
  config?: Record<string, unknown>; // Widget-specific configuration

  // Layout hints for dynamic grid layout
  minWidth?: number;        // Minimum control width in pixels (overrides type defaults)
  preferWide?: boolean;     // Prefer spanning full width when space allows
}

export interface CompositeFieldSpec<T = unknown> extends FieldSpec<T> {
  type: "array" | "object" | "composite-stat" | "composite" | "repeating";
  children?: FieldSpec[];
  widget?: string; // Widget name (e.g., "stat-grid", "speed-grid", "entry-manager")
  itemTemplate?: Record<string, Partial<FieldSpec>>; // For repeating widgets
  config?: {
    // For composite fields
    groupBy?: string[];  // Group fields by prefix (e.g., ["str", "dex"] for abilities)
    fields?: AnyFieldSpec[];  // Nested field definitions (composite) or template (repeating)

    // For repeating fields - Template-based rendering
    static?: boolean;  // Hide add/remove/reorder controls
    synchronizeWidths?: boolean;  // Synchronize widths of same field types across entries

    // For field-level config (used in nested fields within repeating fields)
    init?: (entryData: Record<string, unknown>, allFormData: Record<string, unknown>) => unknown;  // Auto-initialize field value when it becomes visible

    // For repeating fields - Entry-manager based rendering
    categories?: Array<{ id: string; label: string; className?: string; title?: string }>;
    card?: (context: any) => any;  // Card factory for entry rendering
    renderEntry?: (container: HTMLElement, context: any) => HTMLElement;
    filters?: Array<{ id: string; label: string; hint?: string; predicate: (entry: any) => boolean }>;
    insertPosition?: "start" | "end";

    // Other config
    [key: string]: unknown;
  };
}

export interface AutocompleteFieldSpec<T = unknown> extends FieldSpec<T> {
  type: "autocomplete";
  config: {
    load: (query: string) => Promise<T[]> | T[];
    renderSuggestion: (item: T) => string;
    onSelect: (item: T, values: Record<string, unknown>) => void;
    minQueryLength?: number;
  };
}

// Structured tags removed - use modular tokens instead

// ============================================================================
// MODULAR TOKEN SYSTEM (NEW)
// ============================================================================

/**
 * Defines a single field within a token.
 * Each token is a Record<string, unknown> where each key corresponds to a TokenFieldDefinition.
 */
export interface TokenFieldDefinition {
  /** Unique ID of this field within the token (e.g., "type", "value", "hover") */
  id: string;

  /** Field type - uses existing simple field types */
  type: "text" | "select" | "checkbox" | "number-stepper";

  /** Optional label for display (e.g., separator like ": ") */
  label?: string;

  /** Should this field be displayed in the chip? */
  displayInChip: boolean;

  /** Can this field be edited inline by clicking on it? */
  editable: boolean;

  /** Select options (for type: "select") */
  options?: FieldOption[];

  /** Suggestions for autocomplete (string[] for simple, {key, label}[] for structured) */
  suggestions?: string[] | Array<{key: string; label: string}>;

  /** Placeholder text (for text/number inputs) */
  placeholder?: string;

  /** Min value (for number-stepper) */
  min?: number;

  /** Max value (for number-stepper) */
  max?: number;

  /** Step increment (for number-stepper) */
  step?: number;

  /** Unit suffix (e.g., "ft.", "hp") */
  unit?: string;

  /** Icon for display (e.g., "⟨wings⟩" for hover flag) */
  icon?: string;

  /** Visibility condition based on other fields in the same token */
  visibleIf?: (token: Record<string, unknown>) => boolean;

  /** Default value when creating new token */
  default?: unknown;

  /** Optional - mark field as not required */
  optional?: boolean;
}

/**
 * Configuration for modular token field.
 * Replaces both simple "tags" and "structured-tags" with a unified, flexible system.
 */
export interface TokenFieldConfig {
  /** Field definitions for each property in a token */
  fields: TokenFieldDefinition[];

  /** ID of the field used for initial input (when user types and presses +) */
  primaryField: string;

  /** Optional: Custom template for rendering chip text */
  chipTemplate?: (token: Record<string, unknown>) => string;

  /**
   * Optional: Custom initializer for new tokens.
   * Called when user adds a new token. Receives the entire form data and returns
   * initial values for the token fields. Useful for auto-calculating values based on other form fields.
   */
  getInitialValue?: (formData: Record<string, unknown>, primaryValue: string) => Record<string, unknown>;

  /**
   * Optional: Callback when a token field is changed.
   * Called when user edits a field within a token. Can modify the token to update related fields.
   * Useful for recalculating dependent values (e.g., updating skill bonus when expertise changes).
   */
  onTokenFieldChange?: (token: Record<string, unknown>, fieldId: string, newValue: unknown, formData: Record<string, unknown>) => void;
}

/**
 * Modular token field spec.
 * Unified replacement for "tags" and "structured-tags".
 */
export interface TokenFieldSpec extends FieldSpec<Array<Record<string, unknown>>> {
  type: "tokens";
  config: TokenFieldConfig;
}

export interface DisplayFieldSpec extends FieldSpec<string | number> {
  type: "display";
  config: {
    compute: (data: Record<string, unknown>, allFormData?: Record<string, unknown>) => string | number;
    prefix?: string | ((data: Record<string, unknown>, allFormData?: Record<string, unknown>) => string);    // e.g. "+", "-", or dynamic function
    suffix?: string | ((data: Record<string, unknown>, allFormData?: Record<string, unknown>) => string);    // e.g. "ft.", or dynamic function
    className?: string; // Additional CSS class for styling
    maxTokens?: number; // Expected character count for width calculation
  };
}

export interface NumberStepperFieldSpec extends FieldSpec<number> {
  type: "number-stepper";
  min?: number;
  max?: number;
  step?: number;
  autoSizeOnInput?: boolean; // Control auto-sizing on input events (default: true)
}

export interface HeadingFieldSpec extends FieldSpec<string> {
  type: "heading";
  getValue?: (data: Record<string, unknown>) => string; // Extract value from entry data
}

export interface ClickableIconFieldSpec extends FieldSpec<boolean> {
  type: "clickable-icon";
  icon?: string;          // Icon to show when active (default: "★")
  inactiveIcon?: string;  // Icon to show when inactive (default: "☆")
}

export type AnyFieldSpec = FieldSpec | CompositeFieldSpec | AutocompleteFieldSpec | TokenFieldSpec | DisplayFieldSpec | NumberStepperFieldSpec | HeadingFieldSpec | ClickableIconFieldSpec;

export interface RenderFieldArgs {
  app: App;
  container: HTMLElement;
  spec: AnyFieldSpec;
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  registerValidator: (runner: () => string[]) => void;
}

export interface FieldRenderHandle {
  focus?: () => void;
  update?: (value: unknown, all: Record<string, unknown>) => void;
  destroy?: () => void;
}

export interface FieldRegistryEntry {
  supports: (spec: AnyFieldSpec) => boolean;
  render: (args: RenderFieldArgs) => FieldRenderHandle & {
    setErrors?: (errors: string[]) => void;
    container?: HTMLElement;
  };
}

export interface DataSchema<TDraft = Record<string, unknown>, TParsed = TDraft> {
  parse: (data: unknown) => TParsed;
  safeParse: (data: unknown) => { success: boolean; data?: TParsed; error?: unknown };
  partial?: (data: unknown) => { success: boolean; data?: TDraft; error?: unknown };
}

export type StorageFormat = "md-frontmatter" | "json" | "yaml" | "codeblock";

export interface SerializedPayload {
  content: string | Record<string, unknown>;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface PersistResult {
  filePath: string;
  file?: import("obsidian").TFile;
}

export interface StorageSpec {
  format: StorageFormat;
  pathTemplate: string;
  filenameFrom: string;
  directory?: string;
  preserveCase?: boolean;  // Preserve capitalization in filenames (default: false, uses lowercase slugs)
  frontmatter?: Record<string, string> | string[];
  bodyFields?: string[];
  bodyTemplate?: (data: Record<string, any>) => string;
  blockRenderer?: {
    language: string;
    serialize: (data: Record<string, any>) => string;
    parse?: (source: string) => Record<string, any>;
  };
  hooks?: {
    ensureDirectory?: (app: App) => Promise<void>;
    beforeWrite?: (payload: SerializedPayload) => Promise<void> | void;
    afterWrite?: (result: PersistResult) => Promise<void> | void;
  };
}

export interface SectionSpec {
  id: string;
  label: string;
  description?: string;
  fieldIds: string[];
  subItems?: Array<{
    id: string;
    label: string;
  }>;
}

// Browse/List configuration types
export interface MetadataFieldSpec<TEntry = Record<string, unknown>> {
  id: string;
  cls?: string;
  getValue: (entry: TEntry) => string | number | undefined;
}

export type FilterType = "string" | "number" | "boolean" | "custom";

export interface FilterSpec<TEntry = Record<string, unknown>> {
  id: string;
  field: string;
  label: string;
  type?: FilterType;
  sortComparator?: (a: any, b: any) => number;
}

export interface SortSpec<TEntry = Record<string, unknown>> {
  id: string;
  label: string;
  field?: string;
  compareFn?: (a: TEntry, b: TEntry) => number;
}

export interface BrowseSpec<TEntry = Record<string, unknown>> {
  metadata?: MetadataFieldSpec<TEntry>[];
  filters?: FilterSpec<TEntry>[];
  sorts?: SortSpec<TEntry>[];
  search?: string[];
}

export interface LoaderSpec<TDraft = Record<string, unknown>> {
  fromFrontmatter?: (fm: Record<string, unknown>, file: import("obsidian").TFile) => TDraft | Promise<TDraft>;
}

export interface CreateSpec<
  TDraft extends Record<string, unknown> = Record<string, unknown>,
  TSerialized = TDraft,
  TResult = unknown,
> {
  kind: "creature" | "spell" | "equipment" | "region" | "terrain" | string;
  title: string;
  subtitle?: string;
  schema: DataSchema<TDraft, TSerialized>;
  fields: AnyFieldSpec[];
  storage: StorageSpec;
  defaults?: Partial<TDraft> | ((context: { presetName?: string }) => Partial<TDraft>);
  transformers?: {
    preSave?: (values: TSerialized) => TSerialized;
    postSave?: (filePath: string, values: TSerialized) => Promise<void> | void;
  };
  ui?: {
    submitLabel?: string;
    cancelLabel?: string;
    enableNavigation?: boolean;
    sections?: SectionSpec[];
  };
  behavior?: {
    autoSlugify?: boolean;
    allowDraftSave?: boolean;
  };
  browse?: BrowseSpec<any>;
  loader?: LoaderSpec<TDraft>;
}

export interface OpenCreateModalOptions {
  app?: App;
  preset?: Record<string, unknown> | string;
  initialize?: (draft: Record<string, unknown>) => Record<string, unknown>;
}

export interface OpenCreateModalResult {
  filePath: string;
  values: Record<string, any>;
}
