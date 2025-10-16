// src/ui/create/index.ts
// Re-exports for shared Workmode create dialog utilities.

// Unified modal system
export * from "./modal/modal";
export * from "./modal/open-create-modal";

// Types
export * from "./types";

// Storage
export * from "./storage/storage";

// Components
export * from "./layout/layouts";
export * from "./layout/form-controls";
export * from "./storage/entry-system";

// ============================================================================
// LEGACY - Backwards compatibility exports
// ============================================================================

// @deprecated BaseCreateModal renamed to CreateModal. Use CreateModal instead.
export { CreateModal as BaseCreateModal } from "./modal/modal";
