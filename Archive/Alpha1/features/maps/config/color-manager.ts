// src/features/maps/config/colors/color-manager.ts
// Centralized color management for regions and factions
//
// Single source of truth for entity colors with clear fallback chain:
// 1. Stored color from entity frontmatter (user-customized)
// 2. Deterministic palette color (for factions only)
// 3. Type-specific default (#2196f3 regions, #f44336 factions)

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("color-manager");
import { getFactionColor } from "./faction-colors";

/**
 * Default colors for entity types
 */
const DEFAULT_COLORS = Object.freeze({
	region: "#2196f3",   // Blue
	faction: "#f44336",  // Red
});

/**
 * Centralized color management for regions and factions.
 *
 * @example
 * ```typescript
 * const colorManager = new ColorManager(app);
 *
 * // Get color with fallback chain
 * const color = await colorManager.getEntityColor("region", "Misty Woods");
 * // → Returns stored color, or default #2196f3
 *
 * // Update color
 * await colorManager.setEntityColor("faction", "Empire", "#ff5722");
 * // → Saves to frontmatter
 * ```
 */
export class ColorManager {
	constructor(private app: App) {}

	/**
	 * Get color for entity with fallback chain.
	 *
	 * Fallback order:
	 * 1. Stored color from entity frontmatter (user-customized)
	 * 2. Deterministic palette color (for factions only)
	 * 3. Type-specific default (#2196f3 regions, #f44336 factions)
	 *
	 * @param entityType - "region" or "faction"
	 * @param entityName - Entity name (e.g., "Misty Woods", "Empire")
	 * @returns Hex color string (#RRGGBB)
	 */
	async getEntityColor(
		entityType: "region" | "faction",
		entityName: string
	): Promise<string> {
		// 1. Try to load stored color from frontmatter
		const storedColor = await this.loadStoredColor(entityType, entityName);
		if (storedColor) {
			logger.debug(`Using stored color for ${entityType} "${entityName}": ${storedColor}`);
			return storedColor;
		}

		// 2. For factions, try deterministic palette
		if (entityType === "faction") {
			const paletteColor = this.getPaletteColor(entityName);
			logger.debug(`Using palette color for faction "${entityName}": ${paletteColor}`);
			return paletteColor;
		}

		// 3. Fall back to type-specific default
		const defaultColor = this.getDefaultColor(entityType);
		logger.debug(`Using default color for ${entityType} "${entityName}": ${defaultColor}`);
		return defaultColor;
	}

	/**
	 * Update entity color (writes to frontmatter).
	 *
	 * @param entityType - "region" or "faction"
	 * @param entityName - Entity name
	 * @param color - Hex color string (#RRGGBB)
	 * @returns true if successful, false if entity not found
	 */
	async setEntityColor(
		entityType: "region" | "faction",
		entityName: string,
		color: string
	): Promise<boolean> {
		const entityFile = await this.findEntityFile(entityType, entityName);
		if (!entityFile) {
			logger.warn(`Entity not found: ${entityType} "${entityName}"`);
			return false;
		}

		try {
			await this.app.fileManager.processFrontMatter(entityFile, (fm) => {
				fm.color = color;
			});
			logger.info(`Updated ${entityType} "${entityName}" color to ${color}`);
			return true;
		} catch (error) {
			logger.error(`Failed to update color for ${entityType} "${entityName}"`, error);
			return false;
		}
	}

	/**
	 * Get default color for entity type.
	 *
	 * @param entityType - "region" or "faction"
	 * @returns Default hex color (#2196f3 for regions, #f44336 for factions)
	 */
	getDefaultColor(entityType: "region" | "faction"): string {
		return DEFAULT_COLORS[entityType];
	}

	/**
	 * Get deterministic palette color (for factions).
	 *
	 * @param factionId - Faction name/ID
	 * @returns Hex color from 16-color palette (deterministic hash)
	 */
	getPaletteColor(factionId: string): string {
		return getFactionColor(factionId);
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	/**
	 * Load stored color from entity frontmatter.
	 *
	 * @returns Hex color if found and valid, null otherwise
	 */
	private async loadStoredColor(
		entityType: string,
		entityName: string
	): Promise<string | null> {
		const entityFile = await this.findEntityFile(entityType, entityName);
		if (!entityFile) return null;

		const cache = this.app.metadataCache.getFileCache(entityFile);
		const color = cache?.frontmatter?.color;

		// Validate hex color format
		if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/i.test(color)) {
			return color;
		}

		return null;
	}

	/**
	 * Find entity file in vault.
	 *
	 * @returns TFile if found, null otherwise
	 */
	private async findEntityFile(
		entityType: string,
		entityName: string
	): Promise<TFile | null> {
		const folder = entityType === "region" ? "Regions" : "Factions";
		const files = this.app.vault.getMarkdownFiles();

		return files.find(f =>
			f.path.includes(`/${folder}/`) &&
			f.basename === entityName
		) || null;
	}
}
