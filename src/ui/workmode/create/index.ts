// src/ui/workmode/create/index.ts
// Re-exports for shared Workmode create dialog utilities.

// New unified modal system
export * from "./modal";
export * from "./open-create-modal";

// Types
export * from "./types";

// Storage
export * from "./storage";

// Components
export * from "./components/layouts";
export * from "./components/form-controls";
export * from "./components/token-editor";
export * from "./components/entry-system";

// Demo (if still needed)
export * from "./demo";

// ============================================================================
// DEPRECATED - These imports are kept for backward compatibility
// Use the new unified modal system instead
// ============================================================================

// @deprecated Use CreateModal from "./modal" instead
export { BaseCreateModal } from "./base-modal";

// @deprecated Field registry is now inline in CreateModal
export * from "./field-registry";

// @deprecated DeclarativeCreateModal merged into CreateModal
export { DeclarativeCreateModal } from "./declarative-modal";
