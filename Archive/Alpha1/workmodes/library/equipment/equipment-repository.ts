// src/workmodes/library/equipment/equipment-repository.ts
// Repository for equipment using the unified item repository

import type { App } from "obsidian";
import { ItemRepository, type ItemBackendType, type ItemQueryFilter } from "../items/item-repository";
import type { EquipmentData } from "./equipment-types";

/**
 * Equipment repository using unified item backend
 *
 * This is a specialized wrapper around ItemRepository that:
 * - Automatically sets entityType to "equipment"
 * - Provides equipment-specific type safety
 * - Uses same backend infrastructure as items
 *
 * **Features:**
 * - Unified SQLite backend for fast queries
 * - Automatic type conversion
 * - Cache layer integration
 * - Index support for filtered queries
 *
 * **Usage:**
 * ```typescript
 * const repo = new EquipmentRepository({ backend: "vault" });
 * await repo.preload(app);
 *
 * // Query by type
 * const weapons = await repo.query(app, { type: "weapon" });
 *
 * // Get all equipment
 * const allEquipment = await repo.loadAll(app);
 * ```
 */
export class EquipmentRepository {
	private itemRepo: ItemRepository;

	constructor(config: { backend: ItemBackendType } = { backend: "vault" }) {
		this.itemRepo = new ItemRepository({
			backend: config.backend,
			equipmentPath: "Equipment",
		});
		// Set entity type to equipment
		this.itemRepo.setEntityType("equipment");
	}

	/**
	 * Initialize repository
	 */
	async initialize(app: App): Promise<void> {
		await this.itemRepo.initialize(app);
	}

	/**
	 * Preload all equipment into cache
	 */
	async preload(app: App): Promise<void> {
		if (this.itemRepo.preload) {
			await this.itemRepo.preload(app);
		}
	}

	/**
	 * Load all equipment
	 */
	async loadAll(app: App): Promise<EquipmentData[]> {
		const items = await this.itemRepo.loadAll(app);
		return items as EquipmentData[];
	}

	/**
	 * Load equipment by name
	 */
	async load(app: App, name: string): Promise<EquipmentData> {
		const item = await this.itemRepo.load(app, name);
		return item as EquipmentData;
	}

	/**
	 * Save equipment
	 */
	async save(app: App, id: string, data: EquipmentData): Promise<void> {
		await this.itemRepo.save(app, id, data as any);
	}

	/**
	 * Delete equipment
	 */
	async delete(app: App, id: string): Promise<void> {
		await this.itemRepo.delete(app, id);
	}

	/**
	 * Check if equipment exists
	 */
	async exists(app: App, id: string): Promise<boolean> {
		return this.itemRepo.exists(app, id);
	}

	/**
	 * Query equipment with filters
	 */
	async query(app: App, filter: ItemQueryFilter): Promise<EquipmentData[]> {
		const items = await this.itemRepo.query(app, filter);
		return items as EquipmentData[];
	}

	/**
	 * Find equipment by index
	 */
	async findByIndex(app: App, indexName: string, key: string): Promise<EquipmentData[]> {
		const items = await this.itemRepo.findByIndex(app, indexName, key);
		return items as EquipmentData[];
	}

	/**
	 * Get index keys
	 */
	getIndexKeys(indexName: string): string[] {
		return this.itemRepo.getIndexKeys(indexName);
	}

	/**
	 * Get statistics
	 */
	async getStats(app: App): Promise<{
		total: number;
		byType: Record<string, number>;
	}> {
		const stats = await this.itemRepo.getStats(app);

		// Convert categories to types for equipment
		return {
			total: stats.totalItems,
			byType: stats.categories,
		};
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		return this.itemRepo.getCacheStats();
	}

	/**
	 * Invalidate cache
	 */
	async invalidateCache(): Promise<void> {
		await this.itemRepo.invalidateCache();
	}
}
