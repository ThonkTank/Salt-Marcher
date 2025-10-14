// src/ui/workmode/create/types.ts
// Type definitions for the declarative workmode create modal contract.
import type { App } from "obsidian";

export type FieldType =
  | "text" | "textarea" | "number-stepper"
  | "select" | "multiselect" | "tags" | "structured-tags"
  | "toggle" | "date" | "color"
  | "markdown" | "array" | "object" | "composite-stat"
  | "composite" | "repeating" | "autocomplete" | "display";

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

export interface StructuredTagsSuggestion {
  key: string;
  label: string;
}

export interface StructuredTagsValueConfig {
  placeholder?: string;
  unit?: string;
  pattern?: string;
}

export interface StructuredTagsFieldSpec extends FieldSpec<Array<{type: string; value: string}>> {
  type: "structured-tags";
  config: {
    suggestions: StructuredTagsSuggestion[];
    valueConfig: StructuredTagsValueConfig;
  };
}

export interface DisplayFieldSpec extends FieldSpec<string | number> {
  type: "display";
  config: {
    compute: (data: Record<string, unknown>) => string | number;
    prefix?: string | ((data: Record<string, unknown>) => string);    // e.g. "+", "-", or dynamic function
    suffix?: string | ((data: Record<string, unknown>) => string);    // e.g. "ft.", or dynamic function
    className?: string; // Additional CSS class for styling
  };
}

export type AnyFieldSpec = FieldSpec | CompositeFieldSpec | AutocompleteFieldSpec | StructuredTagsFieldSpec | DisplayFieldSpec;

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
