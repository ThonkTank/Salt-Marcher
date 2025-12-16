/**
 * VaultAdapter Interface
 *
 * Purpose: Abstract Obsidian Vault operations to enable testing and consistent error handling
 * Location: src/adapters/vault-adapter.ts
 *
 * Design Philosophy:
 * - TFile-aware API (maintains Obsidian type safety)
 * - Wraps StorageAdapter internally (path-based operations)
 * - Minimal migration effort (drop-in replacement for app.vault)
 * - Testable via MockVaultAdapter (in-memory implementation)
 *
 * Usage Pattern:
 * ```typescript
 * // Before
 * const file = app.vault.getAbstractFileByPath(path);
 * const content = await app.vault.read(file);
 *
 * // After
 * const file = vaultAdapter.getAbstractFileByPath(path);
 * const content = await vaultAdapter.read(file);
 * ```
 */

import type { TFile, TFolder, TAbstractFile, CachedMetadata } from "obsidian";

/**
 * VaultAdapter Interface
 *
 * Abstracts Obsidian Vault operations with TFile-based API.
 * Methods mirror Obsidian's Vault API for minimal migration effort.
 */
export interface VaultAdapter {
	// ==================== File Operations ====================

	/**
	 * Read file contents as UTF-8 string
	 *
	 * @param file - File to read
	 * @returns File contents
	 * @throws Error if file doesn't exist or read fails
	 */
	read(file: TFile): Promise<string>;

	/**
	 * Read file contents using cache if available (performance optimization)
	 *
	 * @param file - File to read
	 * @returns File contents (from cache if available, disk if not)
	 * @throws Error if file doesn't exist or read fails
	 */
	cachedRead(file: TFile): Promise<string>;

	/**
	 * Modify existing file contents
	 *
	 * @param file - File to modify
	 * @param content - New content
	 * @throws Error if file doesn't exist or write fails
	 */
	modify(file: TFile, content: string): Promise<void>;

	/**
	 * Create new file with content
	 *
	 * @param path - File path (forward slashes)
	 * @param content - File content
	 * @returns Created TFile object
	 * @throws Error if file already exists or creation fails
	 */
	create(path: string, content: string): Promise<TFile>;

	/**
	 * Delete a file
	 *
	 * @param file - File to delete
	 * @throws Error if file doesn't exist or deletion fails
	 */
	delete(file: TFile): Promise<void>;

	/**
	 * Rename or move a file
	 *
	 * @param file - File to rename
	 * @param newPath - New file path
	 * @throws Error if source doesn't exist, destination exists, or rename fails
	 */
	rename(file: TFile, newPath: string): Promise<void>;

	// ==================== Directory Operations ====================

	/**
	 * Create folder and all parent folders
	 *
	 * No-op if folder already exists.
	 *
	 * @param path - Folder path (forward slashes)
	 * @throws Error if path exists as file or creation fails
	 */
	createFolder(path: string): Promise<void>;

	// ==================== Query Operations ====================

	/**
	 * Get file or folder by path
	 *
	 * @param path - File or folder path (forward slashes)
	 * @returns TFile, TFolder, or null if not found
	 */
	getAbstractFileByPath(path: string): TAbstractFile | null;

	/**
	 * Get all markdown files in vault
	 *
	 * @returns Array of TFile objects (sorted by modification time, newest first)
	 */
	getMarkdownFiles(): TFile[];

	// ==================== Metadata Operations ====================

	/**
	 * Get cached metadata for file
	 *
	 * @param file - File to get metadata for
	 * @returns Cached metadata or null if not available
	 */
	getMetadata(file: TFile): CachedMetadata | null;

	/**
	 * Get frontmatter from cached metadata
	 *
	 * @param file - File to get frontmatter from
	 * @returns Frontmatter object or null if not available
	 */
	getFrontmatter(file: TFile): Record<string, unknown> | null;

	// ==================== Event Support (optional) ====================

	/**
	 * Register event listener for vault changes
	 *
	 * Note: For production VaultAdapter, this delegates to Obsidian's vault.on().
	 * For MockVaultAdapter, this is a no-op (event simulation not needed for tests).
	 *
	 * @param event - Event name ("create", "delete", "rename", "modify")
	 * @param callback - Event callback
	 * @returns Unsubscribe function
	 */
	on(
		event: "create" | "delete" | "rename" | "modify",
		callback: (file: TAbstractFile, oldPath?: string) => void
	): () => void;

	// ==================== Adapter-Specific Properties ====================

	/**
	 * Base path to vault root
	 *
	 * Used for constructing absolute file paths.
	 * Example: "/home/user/vault"
	 */
	readonly basePath: string;
}

/**
 * VaultAdapter Error
 *
 * Typed error for vault operations.
 * Wraps underlying StorageError for consistent error handling.
 */
export class VaultAdapterError extends Error {
	constructor(
		message: string,
		public readonly code: "NOT_FOUND" | "ALREADY_EXISTS" | "INVALID_PATH" | "UNKNOWN",
		public readonly cause?: Error
	) {
		super(message);
		this.name = "VaultAdapterError";

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, VaultAdapterError);
		}
	}

	static notFound(path: string): VaultAdapterError {
		return new VaultAdapterError(`File not found: ${path}`, "NOT_FOUND");
	}

	static alreadyExists(path: string): VaultAdapterError {
		return new VaultAdapterError(`File already exists: ${path}`, "ALREADY_EXISTS");
	}

	static invalidPath(path: string, reason?: string): VaultAdapterError {
		const message = reason ? `Invalid path: ${path} (${reason})` : `Invalid path: ${path}`;
		return new VaultAdapterError(message, "INVALID_PATH");
	}

	static unknown(message: string, cause: Error): VaultAdapterError {
		return new VaultAdapterError(message, "UNKNOWN", cause);
	}
}
