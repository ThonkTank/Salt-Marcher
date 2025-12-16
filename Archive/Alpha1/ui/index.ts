// src/ui/index.ts
// Shared UI infrastructure for workmode views

// Patterns: Reusable modal and panel patterns
export * from "./patterns";

// Utils: Shared utilities
export * from "./utils/split-view-container";
export * from "./utils/watcher-hub";

// Data Manager Components: Entry management and rendering
export {
  mountEntryManager,
  type EntryManagerOptions,
  type EntryManagerHandles,
  type EntryCategoryDefinition,
  type EntryFilterDefinition,
} from "../features/data-manager/storage/entry-manager";

export {
  renderEntryCard,
  type EntryRenderContext,
  type EntryCardConfigFactory,
  type EntryRenderer,
  type EntryCardBadge,
  type EntryCardActionOptions,
  type EntryCardContentOptions,
  type StandardEntryCardOptions,
  type EntryCardSlots,
} from "../features/data-manager/storage/entry-card";

// Field Controls: Reusable input controls
export {
  createNumberStepper,
  type NumberStepperOptions,
  type NumberStepperHandle,
  type NumberInputOptions,
} from "../features/data-manager/fields/number-stepper-control";
