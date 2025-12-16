/**
 * Base types for Cartographer tool system
 */

import type { ToolPanelContext, ToolPanelHandle } from "../../tool-panel.interface";
import type { AxialCoord } from "@geometry";

/**
 * Base state shared by all brush tools
 */
export interface BrushState {
	/** Brush radius (1-6 hexes) */
	brushRadius: number;

	/** Paint or erase mode */
	mode: "paint" | "erase";
}

/**
 * Error context for standardized error handling
 */
export interface ErrorContext {
	/** Human-readable operation description */
	operation: string;

	/** Tool class name */
	tool: string;

	/** Optional hex coordinate involved */
	coord?: AxialCoord;

	/** Additional error details */
	details?: Record<string, unknown>;
}

/**
 * Custom error for vault modification failures
 */
export class VaultModifyError extends Error {
	constructor(message: string, public cause?: unknown) {
		super(message);
		this.name = "VaultModifyError";
	}
}

/**
 * Custom error for data loading failures
 */
export class DataLoadError extends Error {
	constructor(message: string, public cause?: unknown) {
		super(message);
		this.name = "DataLoadError";
	}
}

/**
 * Re-export commonly used types for convenience
 */
export type { AxialCoord, ToolPanelContext, ToolPanelHandle };
