// src/workmodes/library/items/item-repository.ts
// Repository for items with backend abstraction and caching

import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-items');
import { AbstractIndexedRepository } from "@services/repositories/abstract-indexed-repository";
import type { ItemData } from "./item-types";
import type { EquipmentData } from "../equipment/equipment-types";
import { parseFrontmatter } from "@adapters/frontmatter-parser";

/**
 * Item query filter (for vault backend filtering)
 */
export interface ItemQueryFilter {
	name?: string;
	category?: string;
	rarity?: string;
	type?: string;
	attunement?: boolean;
	search?: string;
	offset?: number;
	limit?: number;
	entityType?: "item" | "equipment";
}

/**
 * Backend type for item repository
 * Note: SQLite backend removed - now vault-only
 */
export type ItemBackendType = "vault";

/**
 * Repository configuration
 */
export interface ItemRepositoryConfig {
	/** Backend to use for data access */
	backend: ItemBackendType;
	/** Base path in vault for items (vault backend only) */
	itemsPath?: string;
	/** Base path in vault for equipment (vault backend only) */
	equipmentPath?: string;
}

/**
 * Item repository with vault backend
 *
 * **Features:**
 * - Unified interface for items and equipment
 * - Index support for fast filtered queries
 * - Cache layer for repeated reads
 *
 * **Usage:**
 * ```typescript
 * const repo = new ItemRepository({ backend: "vault" });
 * await repo.preload(app);
 *
 * // Query by category
 * const weapons = await repo.findByIndex(app, "category", "Weapon");
 *
 * // Query by rarity
 * const rareItems = await repo.findByIndex(app, "rarity", "Rare");
 *
 * // Get all items
 * const allItems = await repo.loadAll(app);
 * ```
 */
export class ItemRepository extends AbstractIndexedRepository<ItemData> {
	private config: ItemRepositoryConfig;
	private entityType: "item" | "equipment" = "item";

	constructor(config: ItemRepositoryConfig = { backend: "vault" }) {
		super();
		this.config = config;

		// Register indexes
		this.registerIndex("category", false); // Single-value
		this.registerIndex("rarity", false); // Single-value
		this.registerIndex("type", false); // Single-value
	}

	/**
	 * Set entity type (item or equipment)
	 * Used to filter queries in SQLite backend
	 */
	setEntityType(entityType: "item" | "equipment"): void {
		this.entityType = entityType;
	}

	/**
	 * Get entity type
	 */
	getEntityType(): "item" | "equipment" {
		return this.entityType;
	}

	/**
	 * Initialize repository and backend
	 */
	async initialize(app: App): Promise<void> {
		logger.info("Using vault backend");
	}

	/**
	 * Load all items from backend
	 */
	async loadAll(app: App): Promise<ItemData[]> {
		// Vault backend: scan files
		return this.loadFromVault(app);
	}

	/**
	 * Load single item by name
	 */
	async load(app: App, name: string): Promise<ItemData> {
		// Vault backend: load from file
		return this.loadFromVaultByName(app, name);
	}

	/**
	 * Save item to backend
	 */
	async save(app: App, id: string, data: ItemData): Promise<void> {
		// Vault backend: save to file
		await this.saveToVault(app, id, data);
		await this.invalidateCache();
	}

	/**
	 * Delete item from backend
	 */
	async delete(app: App, id: string): Promise<void> {
		// Vault backend: delete file
		await this.deleteFromVault(app, id);
		await this.invalidateCache();
	}

	/**
	 * Check if item exists
	 */
	async exists(app: App, id: string): Promise<boolean> {
		// Vault backend: check file exists
		return this.existsInVault(app, id);
	}

	/**
	 * Query items with filters (vault backend - filters in memory)
	 */
	async query(app: App, filter: ItemQueryFilter): Promise<ItemData[]> {
		// Vault backend: load all and filter in memory
		const allItems = await this.loadAll(app);
		return this.filterItemsInMemory(allItems, filter);
	}

	/**
	 * Query items using multiple index criteria (optimized)
	 *
	 * Uses the new multi-field query capability for efficient filtering.
	 * Performs index-based intersection queries instead of loading all items.
	 *
	 * @param app - Obsidian App instance
	 * @param filters - Map of index names to values
	 * @returns Items matching ALL criteria
	 *
	 * @example
	 * ```typescript
	 * // Find all Rare Weapons
	 * const rareWeapons = await repo.queryByIndexes(app, {
	 *   category: 'Weapon',
	 *   rarity: 'Rare'
	 * });
	 *
	 * // Find all Very Rare Armor of a specific type
	 * const veryRareArmor = await repo.queryByIndexes(app, {
	 *   category: 'Armor',
	 *   rarity: 'Very Rare',
	 *   type: 'Plate'
	 * });
	 * ```
	 */
	async queryByIndexes(app: App, filters: Record<string, string>): Promise<ItemData[]> {
		// Use the inherited findByIndexes method from AbstractIndexedRepository
		return this.findByIndexes(app, filters);
	}

	/**
	 * Get repository statistics
	 */
	async getStats(app: App): Promise<{
		totalItems: number;
		categories: Record<string, number>;
		rarities: Record<string, number>;
	}> {
		// Vault backend: compute stats from loaded items
		await this.ensureCacheLoaded(app);
		const items = this.getAllCached();

		const categories: Record<string, number> = {};
		const rarities: Record<string, number> = {};

		for (const item of items) {
			if (item.category) {
				categories[item.category] = (categories[item.category] ?? 0) + 1;
			}
			if (item.rarity) {
				rarities[item.rarity] = (rarities[item.rarity] ?? 0) + 1;
			}
		}

		return {
			totalItems: items.length,
			categories,
			rarities,
		};
	}

	// ==================== Abstract Method Implementations ====================

	/**
	 * Get entity ID for cache key generation
	 */
	protected getEntityId(entity: ItemData): string {
		return entity.name;
	}

	/**
	 * Load entity from source (vault)
	 */
	protected async loadFromSource(app: App, id: string): Promise<ItemData> {
		return this.loadFromVaultByName(app, id);
	}

	/**
	 * Load all entities from source (vault)
	 */
	protected async loadAllFromSource(app: App): Promise<ItemData[]> {
		return this.loadFromVault(app);
	}

	/**
	 * Save entity to source (vault)
	 */
	protected async saveToSource(app: App, id: string, data: ItemData): Promise<void> {
		return this.saveToVault(app, id, data);
	}

	/**
	 * Delete entity from source (vault)
	 */
	protected async deleteFromSource(app: App, id: string): Promise<void> {
		return this.deleteFromVault(app, id);
	}

	// ==================== Index Support ====================

	protected getIndexValue(entity: ItemData, indexName: string): string | string[] {
		if (indexName === "category") {
			return entity.category ?? "";
		}
		if (indexName === "rarity") {
			return entity.rarity ?? "";
		}
		if (indexName === "type") {
			return entity.type ?? "";
		}
		return "";
	}

	// ==================== Vault Backend Implementation ====================

	/**
	 * Load items from vault files
	 */
	private async loadFromVault(app: App): Promise<ItemData[]> {
		const basePath =
			this.entityType === "item"
				? this.config.itemsPath ?? "Items"
				: this.config.equipmentPath ?? "Equipment";

		const folder = app.vault.getAbstractFileByPath(basePath);
		if (!folder || !("children" in folder)) {
			logger.warn(`Folder not found: ${basePath}`);
			return [];
		}

		const items: ItemData[] = [];
		const files = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(basePath));

		for (const file of files) {
			try {
				const content = await app.vault.cachedRead(file);
				const parsed = parseFrontmatter(content);
				const data = parsed.frontmatter as ItemData;

				if (data && data.name) {
					items.push(data);
				}
			} catch (err) {
				logger.warn(`Failed to load item from ${file.path}`, err);
			}
		}

		return items;
	}

	/**
	 * Load single item from vault by name
	 */
	private async loadFromVaultByName(app: App, name: string): Promise<ItemData> {
		const basePath =
			this.entityType === "item"
				? this.config.itemsPath ?? "Items"
				: this.config.equipmentPath ?? "Equipment";

		const filePath = `${basePath}/${name}.md`;
		const file = app.vault.getAbstractFileByPath(filePath);

		if (!file || !("extension" in file)) {
			throw new Error(`Item not found: ${name}`);
		}

		const content = await app.vault.cachedRead(file as TFile);
		const parsed = parseFrontmatter(content);
		return parsed.frontmatter as ItemData;
	}

	/**
	 * Save item to vault file
	 */
	private async saveToVault(app: App, id: string, data: ItemData): Promise<void> {
		const basePath =
			this.entityType === "item"
				? this.config.itemsPath ?? "Items"
				: this.config.equipmentPath ?? "Equipment";

		const filePath = `${basePath}/${id}.md`;
		const content = this.serializeToMarkdown(data);

		const file = app.vault.getAbstractFileByPath(filePath);
		if (file && "extension" in file) {
			await app.vault.modify(file as TFile, content);
		} else {
			await app.vault.create(filePath, content);
		}
	}

	/**
	 * Delete item from vault
	 */
	private async deleteFromVault(app: App, id: string): Promise<void> {
		const basePath =
			this.entityType === "item"
				? this.config.itemsPath ?? "Items"
				: this.config.equipmentPath ?? "Equipment";

		const filePath = `${basePath}/${id}.md`;
		const file = app.vault.getAbstractFileByPath(filePath);

		if (file && "extension" in file) {
			await app.vault.delete(file as TFile);
		}
	}

	/**
	 * Check if item exists in vault
	 */
	private async existsInVault(app: App, id: string): Promise<boolean> {
		const basePath =
			this.entityType === "item"
				? this.config.itemsPath ?? "Items"
				: this.config.equipmentPath ?? "Equipment";

		const filePath = `${basePath}/${id}.md`;
		const file = app.vault.getAbstractFileByPath(filePath);

		return file !== null && "extension" in file;
	}

	/**
	 * Serialize item to markdown
	 */
	private serializeToMarkdown(data: ItemData): string {
		// Simple frontmatter serialization
		const frontmatter = Object.entries(data)
			.map(([key, value]) => {
				if (typeof value === "object") {
					return `${key}: ${JSON.stringify(value)}`;
				}
				return `${key}: ${value}`;
			})
			.join("\n");

		return `---\n${frontmatter}\n---\n\n# ${data.name}\n\n${data.description ?? ""}`;
	}

	/**
	 * Filter items in memory (fallback for vault backend)
	 */
	private filterItemsInMemory(items: ItemData[], filter: ItemQueryFilter): ItemData[] {
		let filtered = items;

		if (filter.name) {
			const search = filter.name.toLowerCase();
			filtered = filtered.filter((item) => item.name.toLowerCase().includes(search));
		}

		if (filter.category) {
			filtered = filtered.filter((item) => item.category === filter.category);
		}

		if (filter.rarity) {
			filtered = filtered.filter((item) => item.rarity === filter.rarity);
		}

		if (filter.type) {
			filtered = filtered.filter((item) => item.type === filter.type);
		}

		if (filter.attunement !== undefined) {
			filtered = filtered.filter((item) => item.attunement === filter.attunement);
		}

		if (filter.search) {
			const search = filter.search.toLowerCase();
			filtered = filtered.filter(
				(item) =>
					item.name.toLowerCase().includes(search) ||
					item.description?.toLowerCase().includes(search)
			);
		}

		// Pagination
		if (filter.offset) {
			filtered = filtered.slice(filter.offset);
		}

		if (filter.limit) {
			filtered = filtered.slice(0, filter.limit);
		}

		return filtered;
	}

	// ==================== Cache Management ====================

	/**
	 * Ensure cache is loaded with items
	 */
	protected async ensureCacheLoaded(app: App): Promise<void> {
		if (!this.cacheLoaded) {
			const items = await this.loadAll(app);
			this.cache.clear();
			for (const item of items) {
				this.cache.set(item.name, item);
			}
			this.buildIndexes(items);
			this.cacheLoaded = true;
			logger.info(`Loaded ${items.length} items into cache`);
		}
	}

	/**
	 * Get all cached items
	 */
	private getAllCached(): ItemData[] {
		return Array.from(this.cache.values());
	}
}
