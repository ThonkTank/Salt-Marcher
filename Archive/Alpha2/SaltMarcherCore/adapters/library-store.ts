/**
 * Library Store
 *
 * Vault adapter for library entity persistence (creatures, terrains).
 * Stores entities as JSON files (one per entity type).
 *
 * @module SaltMarcherCore/adapters/library-store
 */

import type { Vault, TFile } from 'obsidian';
import type {
	EntityType,
	IndexEntry,
	LoadedEntity,
	ILibraryStore,
} from '../../Shared/schemas';
import type { StatblockData, TerrainData } from '../schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * JSON store structure
 */
type JsonStore<T> = {
	version: number;
	entries: T[];
};

/**
 * Entity with ID (required for store operations)
 */
type StoredEntity = Record<string, unknown> & { id: string };

// ============================================================================
// Constants
// ============================================================================

const STORE_VERSION = 1;

const STORE_PATHS: Record<EntityType, string> = {
	creature: 'user-creatures.json',
	terrain: 'user-terrains.json',
};

// ============================================================================
// LibraryStore
// ============================================================================

export class LibraryStore implements ILibraryStore {
	private storeCache: Map<EntityType, JsonStore<StoredEntity>> = new Map();

	constructor(
		private vault: Vault,
		private basePath: string
	) {}

	// ========================================================================
	// CRUD Operations
	// ========================================================================

	/**
	 * List all entities of a type.
	 */
	async list(type: EntityType): Promise<IndexEntry[]> {
		const store = await this.loadStore(type);
		return store.entries.map((e) => this.toIndexEntry(type, e));
	}

	/**
	 * Load an entity by ID.
	 */
	async load<T>(type: EntityType, id: string): Promise<LoadedEntity<T> | null> {
		const store = await this.loadStore(type);
		const entry = store.entries.find((e) => e.id === id);

		if (!entry) {
			return null;
		}

		// Get body from notes (creatures) or description (terrains)
		const body = type === 'creature'
			? (entry as unknown as StatblockData).notes ?? ''
			: (entry as unknown as TerrainData).description ?? '';

		return {
			data: entry as T,
			body,
		};
	}

	/**
	 * Save an entity.
	 */
	async save<T extends Record<string, unknown>>(
		type: EntityType,
		id: string,
		data: T,
		body: string = ''
	): Promise<void> {
		const store = await this.loadStore(type);

		// Store body in appropriate field
		const entry = { ...data, id } as StoredEntity;
		if (type === 'creature') {
			(entry as unknown as StatblockData).notes = body || undefined;
		} else {
			(entry as unknown as TerrainData).description = body || undefined;
		}

		// Update or add entry
		const existingIdx = store.entries.findIndex((e) => e.id === id);
		if (existingIdx >= 0) {
			store.entries[existingIdx] = entry;
		} else {
			store.entries.push(entry);
		}

		// Sort by name for consistency
		store.entries.sort((a, b) => {
			const nameA = (a as { name?: string }).name ?? '';
			const nameB = (b as { name?: string }).name ?? '';
			return nameA.localeCompare(nameB);
		});

		await this.saveStore(type, store);
	}

	/**
	 * Delete an entity.
	 */
	async delete(type: EntityType, id: string): Promise<void> {
		const store = await this.loadStore(type);
		store.entries = store.entries.filter((e) => e.id !== id);
		await this.saveStore(type, store);
	}

	/**
	 * Rebuild index - clears cache and reloads from disk.
	 */
	async rebuildIndex(type: EntityType): Promise<void> {
		this.storeCache.delete(type);
		await this.loadStore(type);
	}

	// ========================================================================
	// Private: Store Operations
	// ========================================================================

	private async loadStore(type: EntityType): Promise<JsonStore<StoredEntity>> {
		// Check cache
		const cached = this.storeCache.get(type);
		if (cached) {
			return cached;
		}

		const path = this.getStorePath(type);
		const store = await this.loadJsonFile<JsonStore<StoredEntity>>(path);

		if (store && store.version === STORE_VERSION) {
			this.storeCache.set(type, store);
			return store;
		}

		// Create empty store
		const emptyStore: JsonStore<StoredEntity> = {
			version: STORE_VERSION,
			entries: [],
		};
		this.storeCache.set(type, emptyStore);
		return emptyStore;
	}

	private async saveStore(type: EntityType, store: JsonStore<StoredEntity>): Promise<void> {
		await this.ensureDirectory(this.basePath);

		const path = this.getStorePath(type);
		const content = JSON.stringify(store, null, 2);
		await this.saveFile(path, content);

		this.storeCache.set(type, store);
	}

	// ========================================================================
	// Private: Index Entry Conversion
	// ========================================================================

	private toIndexEntry(type: EntityType, data: StoredEntity): IndexEntry {
		const entry: IndexEntry = {
			id: data.id,
			name: (data as { name?: string }).name ?? data.id,
			modifiedAt: Date.now(),
		};

		if (type === 'creature') {
			const creature = data as unknown as StatblockData;
			if (creature.cr) entry.cr = creature.cr;
			if (creature.type) entry.type = creature.type;
			if (creature.xp) entry.xp = creature.xp;
			if (creature.terrainPreference && creature.terrainPreference.length > 0) {
				entry.terrainPreference = creature.terrainPreference;
			}
		} else if (type === 'terrain') {
			const terrain = data as unknown as TerrainData;
			if (terrain.color) entry.color = terrain.color;
		}

		return entry;
	}

	// ========================================================================
	// Private: Path Helpers
	// ========================================================================

	private getStorePath(type: EntityType): string {
		return `${this.basePath}/${STORE_PATHS[type]}`;
	}

	// ========================================================================
	// Private: Vault Helpers
	// ========================================================================

	private async ensureDirectory(path: string): Promise<void> {
		const folder = this.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.vault.createFolder(path);
		}
	}

	private async loadJsonFile<T>(path: string): Promise<T | null> {
		const file = this.vault.getAbstractFileByPath(path);
		if (!file) {
			return null;
		}

		try {
			const content = await this.vault.read(file as TFile);
			return JSON.parse(content) as T;
		} catch {
			return null;
		}
	}

	private async saveFile(path: string, content: string): Promise<void> {
		const existingFile = this.vault.getAbstractFileByPath(path);

		if (existingFile) {
			await this.vault.modify(existingFile as TFile, content);
		} else {
			await this.vault.create(path, content);
		}
	}
}
