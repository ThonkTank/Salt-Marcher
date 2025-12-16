/**
 * Base classes and utilities for Cartographer tools
 *
 * This module provides:
 * - BaseBrushTool: Common brush behavior (circle, lifecycle, click handling)
 * - BaseDataBrushTool: Data loading for tools that use Library entities
 * - StandardErrorHandler: Centralized error reporting
 * - Common types: BrushState, ErrorContext, etc.
 *
 * @example
 * ```typescript
 * import { BaseBrushTool, type BrushState } from "./base";
 *
 * export class MyBrushTool extends BaseBrushTool {
 *   // ... implementation
 * }
 * ```
 */

export { BaseBrushTool } from "./base-brush-tool";
export { BaseDataBrushTool } from "./base-data-brush-tool";
export { StandardErrorHandler } from "./standard-error-handler";
export type {
	BrushState,
	ErrorContext,
	AxialCoord,
	ToolPanelContext,
	ToolPanelHandle,
} from "./base-tool-types";
export { VaultModifyError, DataLoadError } from "./base-tool-types";

// Brush executor - unified execution system
export {
	executeBrush,
	type BrushExecutorContext,
	type BrushPayloadResult,
	type BrushExecutorCallbacks,
	type BrushExecutorResult,
} from "./brush-executor";
