// src/features/maps/data/elevation-repository.ts
// Storage layer for elevation field data (control points)

import type { App} from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("elevation-repository");
import { type ControlPoint, type ElevationFieldConfig } from "@services/elevation";

/**
 * Elevation JSON Format
 *
 * Git-friendly JSON storage for elevation control points.
 * Separate from tile data to keep concerns isolated.
 */
export interface ElevationJSON {
	/** Schema version for future migrations */
	version: number;
	/** Source map file path */
	mapPath: string;
	/** Elevation field configuration */
	config: ElevationFieldConfig;
	/** Control points array */
	controlPoints: ControlPoint[];
	/** Last modified timestamp (ISO 8601) */
	lastModified?: string;
}

/**
 * Create empty elevation JSON
 */
export function createEmptyElevationJSON(mapPath: string): ElevationJSON {
	return {
		version: 1,
		mapPath,
		config: {
			resolution: 200,
			interpolation: "rbf",
			sigma: 50,
		},
		controlPoints: [],
		lastModified: new Date().toISOString(),
	};
}

/**
 * Parse elevation JSON from string
 */
export function parseElevationJSON(raw: string): ElevationJSON {
	try {
		const parsed = JSON.parse(raw);

		// Validate structure
		if (typeof parsed !== "object" || parsed === null) {
			throw new Error("Invalid JSON: expected object");
		}

		if (typeof parsed.version !== "number") {
			throw new Error("Invalid JSON: missing version");
		}

		if (typeof parsed.mapPath !== "string") {
			throw new Error("Invalid JSON: missing mapPath");
		}

		if (!Array.isArray(parsed.controlPoints)) {
			throw new Error("Invalid JSON: controlPoints must be array");
		}

		// Version migration (future-proof)
		if (parsed.version !== 1) {
			logger.warn(
				`Unsupported version ${parsed.version}, expected 1. Using default config.`,
			);
		}

		return parsed as ElevationJSON;
	} catch (error) {
		logger.error("Failed to parse elevation JSON:", error);
		throw error;
	}
}

/**
 * Serialize elevation JSON to string
 */
export function serializeElevationJSON(data: ElevationJSON): string {
	// Pretty print for git-friendliness
	return JSON.stringify(data, null, 2);
}

/**
 * Validate control point data
 */
export function validateControlPoint(point: any): point is ControlPoint {
	if (typeof point !== "object" || point === null) {
		return false;
	}

	if (typeof point.id !== "string") {
		return false;
	}

	if (typeof point.x !== "number" || !isFinite(point.x)) {
		return false;
	}

	if (typeof point.y !== "number" || !isFinite(point.y)) {
		return false;
	}

	if (typeof point.elevation !== "number" || !isFinite(point.elevation)) {
		return false;
	}

	const validTypes = ["painted", "falloff", "peak", "ridge", "valley", "manual"];
	if (!validTypes.includes(point.type)) {
		return false;
	}

	return true;
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get elevation JSON file path for map.
 *
 * Format: "Maps/Regional-Map.elevation.json"
 */
export function getElevationJSONPath(mapFile: TFile): string {
	const basePath = mapFile.path.replace(/\.md$/, "");
	return `${basePath}.elevation.json`;
}

/**
 * Get backup folder path for elevation files.
 */
function getBackupFolder(app: App): string {
	// @ts-ignore - Plugin API
	const pluginDir = app.vault.configDir + "/plugins/salt-marcher";
	return normalizePath(`${pluginDir}/backups/elevation`);
}

/**
 * Get backup file path with timestamp.
 */
function getBackupPath(app: App, mapFile: TFile, timestamp: number): string {
	const backupFolder = getBackupFolder(app);
	const baseName = mapFile.basename;
	return normalizePath(`${backupFolder}/${baseName}-${timestamp}.json`);
}

// ============================================================================
// File I/O
// ============================================================================

/**
 * Load elevation JSON from disk.
 *
 * Returns null if file doesn't exist yet.
 */
export async function loadElevationJSON(app: App, mapFile: TFile): Promise<ElevationJSON | null> {
	const jsonPath = getElevationJSONPath(mapFile);
	const file = app.vault.getAbstractFileByPath(jsonPath);

	if (!file || !(file instanceof TFile)) {
		logger.info(`No elevation file found: ${jsonPath}`);
		return null;
	}

	try {
		const raw = await app.vault.read(file);
		const parsed = parseElevationJSON(raw);

		logger.info(
			`Loaded ${parsed.controlPoints.length} control points from ${jsonPath}`,
		);
		return parsed;
	} catch (error) {
		logger.error(`Failed to load ${jsonPath}:`, error);
		throw error;
	}
}

/**
 * Save elevation JSON to disk with automatic backup.
 */
export async function saveElevationJSON(
	app: App,
	mapFile: TFile,
	data: ElevationJSON,
): Promise<void> {
	const jsonPath = getElevationJSONPath(mapFile);

	try {
		// Ensure backups folder exists
		const backupFolder = getBackupFolder(app);
		if (!app.vault.getAbstractFileByPath(backupFolder)) {
			try {
				await app.vault.createFolder(backupFolder);
			} catch (error) {
				// Ignore "already exists" errors from race condition
				if (!(error instanceof Error && error.message.includes("already exists"))) {
					throw error;
				}
			}
		}

		// Create backup of current version (if exists)
		const existingFile = app.vault.getAbstractFileByPath(jsonPath);
		if (existingFile && existingFile instanceof TFile) {
			const backupPath = getBackupPath(app, mapFile, Date.now());
			const content = await app.vault.read(existingFile);
			await app.vault.create(backupPath, content);
			logger.debug(`Created backup: ${backupPath}`);

			// Cleanup old backups (keep last 5)
			await cleanupOldBackups(app, mapFile, 5);
		}

		// Update lastModified timestamp
		data.lastModified = new Date().toISOString();

		// Serialize and save
		const serialized = serializeElevationJSON(data);

		if (existingFile && existingFile instanceof TFile) {
			await app.vault.modify(existingFile, serialized);
		} else {
			await app.vault.create(jsonPath, serialized);
		}

		logger.info(`Saved ${data.controlPoints.length} control points to ${jsonPath}`);
	} catch (error) {
		logger.error(`Failed to save ${jsonPath}:`, error);
		throw error;
	}
}

/**
 * Delete elevation JSON file.
 */
export async function deleteElevationJSON(app: App, mapFile: TFile): Promise<void> {
	const jsonPath = getElevationJSONPath(mapFile);
	const file = app.vault.getAbstractFileByPath(jsonPath);

	if (file && file instanceof TFile) {
		await app.vault.delete(file);
		logger.info(`Deleted elevation file: ${jsonPath}`);
	}
}

/**
 * Check if elevation JSON exists for map.
 */
export function hasElevationJSON(app: App, mapFile: TFile): boolean {
	const jsonPath = getElevationJSONPath(mapFile);
	const file = app.vault.getAbstractFileByPath(jsonPath);
	return file !== null && file instanceof TFile;
}

// ============================================================================
// Backup Management
// ============================================================================

/**
 * Cleanup old backup files, keeping only the most recent N.
 */
async function cleanupOldBackups(app: App, mapFile: TFile, keepCount: number): Promise<void> {
	const backupFolder = getBackupFolder(app);
	const backupFolderFile = app.vault.getAbstractFileByPath(backupFolder);

	if (!backupFolderFile) {
		return;
	}

	try {
		const baseName = mapFile.basename;
		const backupFiles = app.vault
			.getFiles()
			.filter((f) => f.path.startsWith(backupFolder) && f.basename.startsWith(baseName))
			.sort((a, b) => b.stat.mtime - a.stat.mtime); // Newest first

		// Delete old backups beyond keepCount
		const toDelete = backupFiles.slice(keepCount);
		for (const file of toDelete) {
			await app.vault.delete(file);
			logger.debug(`Deleted old backup: ${file.path}`);
		}

		if (toDelete.length > 0) {
			logger.info(`Cleaned up ${toDelete.length} old backups`);
		}
	} catch (error) {
		logger.error("Failed to cleanup backups:", error);
	}
}
