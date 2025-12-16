/**
 * Base class for brush tools that load Library data
 *
 * Extends BaseBrushTool with:
 * - Standardized data loading (regions, factions, locations)
 * - Workspace event subscription management
 * - Data caching for performance
 * - Dropdown update abstraction
 *
 * Subclasses must implement:
 * - `getDataSources()` - Return array of DataSources to load
 * - `updateDataDropdowns()` - Update UI dropdowns with loaded data
 * - All BaseBrushTool abstract methods
 *
 * @example
 * ```typescript
 * export class AreaBrushTool extends BaseDataBrushTool<Region | Faction> {
 *   protected getDataSources() {
 *     return [
 *       LIBRARY_DATA_SOURCES.regions,
 *       LIBRARY_DATA_SOURCES.factions
 *     ];
 *   }
 *
 *   protected updateDataDropdowns(items: (Region | Faction)[]) {
 *     const regions = items.filter(i => "terrain" in i);
 *     const factions = items.filter(i => "memberCount" in i);
 *     // Update UI dropdowns...
 *   }
 *
 *   protected setupWorkspaceSubscriptions() {
 *     this.subscribeToWorkspace("salt:regions-updated", () => this.reloadData());
 *     this.subscribeToWorkspace("salt:factions-updated", () => this.reloadData());
 *   }
 * }
 * ```
 */

import type { EventRef } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-base-brush");
import { BaseBrushTool } from "./base-brush-tool";
import { DataLoadError, type BrushState, type ToolPanelContext } from "./base-tool-types";
import type { BaseEntry, DataSource } from "src/features/data-manager";

/**
 * Workspace event subscription handle
 */
type WorkspaceSubscription = EventRef;

/**
 * Base class for tools that load Library data
 *
 * Eliminates data loading boilerplate by providing:
 * - Standard data loading patterns
 * - Workspace event subscriptions (auto-cleanup)
 * - Data caching for performance
 * - Error handling for data loading
 */
export abstract class BaseDataBrushTool<
	TEntry extends BaseEntry = BaseEntry,
	TState extends BrushState = BrushState,
> extends BaseBrushTool<TState> {
	/** Cached data entries (by name) */
	protected dataCache: Map<string, TEntry> = new Map();

	/** Workspace event subscriptions (cleaned up on destroy) */
	private subscriptions: WorkspaceSubscription[] = [];

	/**
	 * Create data brush tool instance
	 *
	 * Calls setupWorkspaceSubscriptions() and loadData() automatically
	 *
	 * @param root - DOM element for tool panel
	 * @param ctx - Tool panel context (app, file, handles)
	 */
	constructor(root: HTMLElement, ctx: ToolPanelContext) {
		super(root, ctx);

		// Setup workspace event listeners
		this.setupWorkspaceSubscriptions();

		// Load initial data (async, fire-and-forget)
		void this.loadData("initial");
	}

	// ============================================================
	// Data Loading (standardized across all data tools)
	// ============================================================

	/**
	 * Load data from all data sources
	 *
	 * - Calls list() for each data source
	 * - Calls load() for each file
	 * - Updates data cache
	 * - Updates UI dropdowns
	 * - Handles errors with user feedback
	 *
	 * @param event - "initial" (first load) or "refresh" (workspace event)
	 */
	protected async loadData(event: "initial" | "refresh"): Promise<void> {
		try {
			this.ctx.setStatus("Loading data...", "loading");

			const sources = this.getDataSources();
			const allEntries: TEntry[] = [];

			// Load data from each source
			for (const source of sources) {
				const files = await source.list(this.ctx.app);

				for (const file of files) {
					const entry = await source.load(this.ctx.app, file);
					allEntries.push(entry as TEntry);
				}
			}

			// Update cache
			this.dataCache.clear();
			for (const entry of allEntries) {
				this.dataCache.set(entry.name, entry);
			}

			// Update UI dropdowns
			this.updateDataDropdowns(allEntries);

			this.ctx.setStatus(`Loaded ${allEntries.length} items`, "info");
			logger.debug(`[${this.constructor.name}] Data loaded`, {
				event,
				count: allEntries.length,
			});
		} catch (err) {
			// Wrap error in DataLoadError for consistent handling
			const dataError = new DataLoadError(`Failed to load data: ${err}`, err);

			this.errorHandler.handle(dataError, {
				operation: "load data",
				tool: this.constructor.name,
				details: { event },
			});
		}
	}

	/**
	 * Reload data (triggered by workspace events)
	 *
	 * Convenience method for workspace event handlers
	 */
	protected async reloadData(): Promise<void> {
		await this.loadData("refresh");
	}

	// ============================================================
	// Workspace Event Subscriptions (auto-cleanup)
	// ============================================================

	/**
	 * Subscribe to workspace event
	 *
	 * Subscriptions are automatically cleaned up on destroy()
	 *
	 * @param eventName - Workspace event name (e.g., "salt:regions-updated")
	 * @param handler - Event handler function
	 *
	 * @example
	 * ```typescript
	 * protected setupWorkspaceSubscriptions() {
	 *   this.subscribeToWorkspace("salt:regions-updated", () => this.reloadData());
	 * }
	 * ```
	 */
	protected subscribeToWorkspace(eventName: string, handler: () => void): void {
		const sub = this.ctx.app.workspace.on(eventName as any, handler);
		this.subscriptions.push(sub);
		logger.debug(`[${this.constructor.name}] Subscribed to ${eventName}`);
	}

	/**
	 * Setup workspace event subscriptions
	 *
	 * Override this method to subscribe to relevant events.
	 * Called during construction.
	 *
	 * @example
	 * ```typescript
	 * protected setupWorkspaceSubscriptions() {
	 *   this.subscribeToWorkspace("salt:regions-updated", () => this.reloadData());
	 *   this.subscribeToWorkspace("salt:factions-updated", () => this.reloadData());
	 * }
	 * ```
	 */
	protected setupWorkspaceSubscriptions(): void {
		// Override in subclasses
	}

	// ============================================================
	// Lifecycle (cleanup subscriptions)
	// ============================================================

	/**
	 * Destroy tool and cleanup subscriptions
	 *
	 * Removes all workspace event listeners before destroying
	 */
	destroy(): void {
		// Cleanup workspace subscriptions
		this.subscriptions.forEach((sub) => {
			this.ctx.app.workspace.offref(sub);
		});
		this.subscriptions = [];

		logger.debug(`[${this.constructor.name}] Unsubscribed from workspace events`);

		// Call parent destroy
		super.destroy();
	}

	// ============================================================
	// Abstract Methods (subclasses must implement)
	// ============================================================

	/**
	 * Get data sources to load
	 *
	 * Return array of DataSource instances to load data from.
	 * Called during loadData().
	 *
	 * @example
	 * ```typescript
	 * protected getDataSources() {
	 *   return [
	 *     LIBRARY_DATA_SOURCES.regions,
	 *     LIBRARY_DATA_SOURCES.factions
	 *   ];
	 * }
	 * ```
	 */
	protected abstract getDataSources(): DataSource<string, TEntry>[];

	/**
	 * Update UI dropdowns with loaded data
	 *
	 * Called after loadData() successfully loads data.
	 * Update dropdown options, clear selections if needed, etc.
	 *
	 * @param items - All loaded entries
	 *
	 * @example
	 * ```typescript
	 * protected updateDataDropdowns(items: (Region | Faction)[]) {
	 *   const regions = items.filter(i => "terrain" in i);
	 *   const factions = items.filter(i => "memberCount" in i);
	 *
	 *   // Update region dropdown
	 *   const regionSelect = this.root.querySelector<HTMLSelectElement>(".region-select");
	 *   regionSelect.innerHTML = "";
	 *   regionSelect.createEl("option", { value: "", text: "(none)" });
	 *   regions.forEach(r => {
	 *     regionSelect.createEl("option", { value: r.name, text: r.name });
	 *   });
	 *
	 *   // Update faction dropdown
	 *   const factionSelect = this.root.querySelector<HTMLSelectElement>(".faction-select");
	 *   factionSelect.innerHTML = "";
	 *   factionSelect.createEl("option", { value: "", text: "(none)" });
	 *   factions.forEach(f => {
	 *     factionSelect.createEl("option", { value: f.name, text: f.name });
	 *   });
	 * }
	 * ```
	 */
	protected abstract updateDataDropdowns(items: TEntry[]): void;
}
