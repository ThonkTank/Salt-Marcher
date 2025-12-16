/**
 * ObsidianVaultAdapter
 *
 * Purpose: Production implementation of VaultAdapter using Obsidian's Vault API
 * Location: src/adapters/obsidian-vault-adapter.ts
 *
 * Design:
 * - Delegates to Obsidian Vault API for all operations
 * - Wraps errors in VaultAdapterError for consistent handling
 * - Maintains TFile cache for getAbstractFileByPath()
 * - Zero performance overhead (thin wrapper)
 */

import type { Vault, TFile, TAbstractFile, CachedMetadata, MetadataCache } from "obsidian";
import { TFolder } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('adapter-vault');
import { VaultAdapterError } from "./vault-adapter";
import type { VaultAdapter } from "./vault-adapter";

/**
 * Production VaultAdapter using Obsidian's Vault API
 */
export class ObsidianVaultAdapter implements VaultAdapter {
	constructor(
		private readonly vault: Vault,
		private readonly metadataCache: MetadataCache
	) {}

	// ==================== File Operations ====================

	async read(file: TFile): Promise<string> {
		try {
			return await this.vault.read(file);
		} catch (error) {
			logger.error(`Failed to read file: ${file.path}`, error);
			throw VaultAdapterError.unknown(`Failed to read file: ${file.path}`, error as Error);
		}
	}

	async cachedRead(file: TFile): Promise<string> {
		try {
			return await this.vault.cachedRead(file);
		} catch (error) {
			logger.error(`Failed to cached read file: ${file.path}`, error);
			throw VaultAdapterError.unknown(
				`Failed to cached read file: ${file.path}`,
				error as Error
			);
		}
	}

	async modify(file: TFile, content: string): Promise<void> {
		try {
			await this.vault.modify(file, content);
		} catch (error) {
			logger.error(`Failed to modify file: ${file.path}`, error);
			throw VaultAdapterError.unknown(`Failed to modify file: ${file.path}`, error as Error);
		}
	}

	async create(path: string, content: string): Promise<TFile> {
		try {
			// Check if file already exists
			const existing = this.getAbstractFileByPath(path);
			if (existing) {
				throw VaultAdapterError.alreadyExists(path);
			}

			return await this.vault.create(path, content);
		} catch (error) {
			if (error instanceof VaultAdapterError) {
				throw error;
			}
			logger.error(`Failed to create file: ${path}`, error);
			throw VaultAdapterError.unknown(`Failed to create file: ${path}`, error as Error);
		}
	}

	async delete(file: TFile): Promise<void> {
		try {
			await this.vault.delete(file);
		} catch (error) {
			logger.error(`Failed to delete file: ${file.path}`, error);
			throw VaultAdapterError.unknown(`Failed to delete file: ${file.path}`, error as Error);
		}
	}

	async rename(file: TFile, newPath: string): Promise<void> {
		try {
			// Check if destination already exists
			const existing = this.getAbstractFileByPath(newPath);
			if (existing) {
				throw VaultAdapterError.alreadyExists(newPath);
			}

			await this.vault.rename(file, newPath);
		} catch (error) {
			if (error instanceof VaultAdapterError) {
				throw error;
			}
			logger.error(
				`Failed to rename file from ${file.path} to ${newPath}`,
				error
			);
			throw VaultAdapterError.unknown(
				`Failed to rename file from ${file.path} to ${newPath}`,
				error as Error
			);
		}
	}

	// ==================== Directory Operations ====================

	async createFolder(path: string): Promise<void> {
		try {
			// Check if already exists
			const existing = this.getAbstractFileByPath(path);
			if (existing) {
				if (existing instanceof TFolder) {
					// Already exists as folder, no-op
					return;
				} else {
					throw VaultAdapterError.invalidPath(path, "Path exists as a file, not a folder");
				}
			}

			await this.vault.createFolder(path);
		} catch (error) {
			if (error instanceof VaultAdapterError) {
				throw error;
			}

			// Handle "Folder already exists" error (race condition from parallel operations)
			if (error instanceof Error && error.message.includes("already exists")) {
				// Verify it's actually a folder
				const existing = this.getAbstractFileByPath(path);
				if (existing instanceof TFolder) {
					return; // Success (folder created by concurrent operation)
				}
			}

			logger.error(`Failed to create folder: ${path}`, error);
			throw VaultAdapterError.unknown(`Failed to create folder: ${path}`, error as Error);
		}
	}

	// ==================== Query Operations ====================

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.vault.getAbstractFileByPath(path);
	}

	getMarkdownFiles(): TFile[] {
		return this.vault.getMarkdownFiles();
	}

	// ==================== Metadata Operations ====================

	getMetadata(file: TFile): CachedMetadata | null {
		return this.metadataCache.getFileCache(file);
	}

	getFrontmatter(file: TFile): Record<string, unknown> | null {
		const metadata = this.getMetadata(file);
		return metadata?.frontmatter ?? null;
	}

	// ==================== Event Support ====================

	on(
		event: "create" | "delete" | "rename" | "modify",
		callback: (file: TAbstractFile, oldPath?: string) => void
	): () => void {
		// Delegate to Obsidian's vault event system
		const eventRef = this.vault.on(event as any, callback as any);

		// Return unsubscribe function
		return () => {
			this.vault.offref(eventRef);
		};
	}

	// ==================== Adapter-Specific Properties ====================

	get basePath(): string {
		// Access via adapter property (Obsidian-specific)
		// @ts-ignore - Obsidian internal API
		return this.vault.adapter.basePath;
	}
}
