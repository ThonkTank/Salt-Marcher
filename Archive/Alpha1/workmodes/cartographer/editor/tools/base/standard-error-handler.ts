/**
 * Standard error handling for Cartographer tools
 *
 * Provides centralized error reporting with:
 * - User-friendly error messages
 * - Structured error logging
 * - Context enrichment for debugging
 * - Integration with status bar
 *
 * @example
 * ```typescript
 * const errorHandler = new StandardErrorHandler(ctx);
 *
 * try {
 *   await saveTile(...);
 * } catch (err) {
 *   errorHandler.handle(err, {
 *     operation: "save tile",
 *     tool: "TerrainBrush",
 *     coord: { q: 0, r: 0 }
 *   });
 * }
 * ```
 */

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-base-brush");
import { VaultModifyError, DataLoadError, type ErrorContext } from "./base-tool-types";
import type { ToolPanelContext } from "../../tool-panel.interface";

export class StandardErrorHandler {
	constructor(private ctx: ToolPanelContext) {}

	/**
	 * Handle an error with user-friendly messaging
	 *
	 * - Logs error with full context
	 * - Shows user-friendly message in status bar
	 * - Enriches error with tool/operation info
	 *
	 * @param err - Caught error
	 * @param context - Error context (operation, tool, etc.)
	 */
	handle(err: unknown, context: ErrorContext): void {
		// Log detailed error with context
		logger.error(`[${context.tool}] ${context.operation} failed`, {
			error: err,
			coord: context.coord,
			details: context.details,
		});

		// Show user-friendly message
		const message = this.getUserMessage(err, context);
		this.ctx.setStatus(message, "error");
	}

	/**
	 * Convert technical error to user-friendly message
	 *
	 * @param err - Caught error
	 * @param context - Error context
	 * @returns User-friendly error message
	 */
	private getUserMessage(err: unknown, context: ErrorContext): string {
		// VaultModifyError: File permission or write errors
		if (err instanceof VaultModifyError) {
			return `Could not save ${context.operation}. Check file permissions.`;
		}

		// DataLoadError: Failed to load regions/factions/locations
		if (err instanceof DataLoadError) {
			return `Could not load data for ${context.tool}. Try refreshing the tool.`;
		}

		// File not found errors
		if (err instanceof Error && err.message.includes("File not found")) {
			return `Map file not found. Try reopening Cartographer.`;
		}

		// File not found errors (vault API)
		if (err instanceof Error && err.message.includes("No file")) {
			return `No map file selected. Select a map to continue.`;
		}

		// Map not rendered errors
		if (err instanceof Error && err.message.includes("not rendered")) {
			return `Map not loaded yet. Wait for map to render.`;
		}

		// Generic fallback
		return `${context.operation} failed. Check console for details.`;
	}
}
