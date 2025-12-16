/**
 * MockVaultAdapter
 *
 * Purpose: In-memory implementation of VaultAdapter for testing
 * Location: src/adapters/mock-vault-adapter.ts
 *
 * Design:
 * - TFile simulation (creates mock TFile objects)
 * - In-memory file storage (path → content map)
 * - Enables unit testing without Obsidian
 * - Zero external dependencies
 *
 * Usage:
 * ```typescript
 * const vault = new MockVaultAdapter();
 * const file = await vault.create("test.md", "# Test");
 * const content = await vault.read(file);
 * ```
 */

import type { TFile, TFolder, TAbstractFile, CachedMetadata } from "obsidian";
import { VaultAdapterError } from "./vault-adapter";
import type { VaultAdapter } from "./vault-adapter";

/**
 * Mock TFile implementation for testing
 */
class MockTFile implements TFile {
	stat: { ctime: number; mtime: number; size: number };
	basename: string;
	extension: string;

	constructor(
		public path: string,
		public name: string,
		public parent: TFolder | null
	) {
		this.stat = {
			ctime: Date.now(),
			mtime: Date.now(),
			size: 0,
		};
		this.basename = name.replace(/\.md$/, "");
		this.extension = "md";
	}

	// Required by TAbstractFile
	vault: any = null;
}

/**
 * Mock TFolder implementation for testing
 */
class MockTFolder implements TFolder {
	children: TAbstractFile[] = [];
	isRoot: () => boolean = () => this.parent === null;

	constructor(
		public path: string,
		public name: string,
		public parent: TFolder | null
	) {}

	// Required by TAbstractFile
	vault: any = null;
}

/**
 * In-memory VaultAdapter for testing
 *
 * Simulates Obsidian Vault API without external dependencies.
 */
export class MockVaultAdapter implements VaultAdapter {
	private files: Map<string, { file: TFile; content: string }> = new Map();
	private folders: Map<string, TFolder> = new Map();

	constructor() {
		// Create root folder
		this.folders.set("", new MockTFolder("", "", null));
	}

	// ==================== File Operations ====================

	async read(file: TFile): Promise<string> {
		const entry = this.files.get(file.path);
		if (!entry) {
			throw VaultAdapterError.notFound(file.path);
		}
		return entry.content;
	}

	async cachedRead(file: TFile): Promise<string> {
		// Mock implementation: no cache, just read
		return this.read(file);
	}

	async modify(file: TFile, content: string): Promise<void> {
		const entry = this.files.get(file.path);
		if (!entry) {
			throw VaultAdapterError.notFound(file.path);
		}

		entry.content = content;
		entry.file.stat.mtime = Date.now();
		entry.file.stat.size = content.length;
	}

	async create(path: string, content: string): Promise<TFile> {
		// Check if already exists
		if (this.files.has(path)) {
			throw VaultAdapterError.alreadyExists(path);
		}

		// Ensure parent folder exists
		const parentPath = path.substring(0, path.lastIndexOf("/"));
		if (parentPath && !this.folders.has(parentPath)) {
			await this.createFolder(parentPath);
		}

		// Create file
		const name = path.split("/").pop() || path;
		const parent = parentPath ? (this.folders.get(parentPath) as TFolder) : null;
		const file = new MockTFile(path, name, parent);
		file.stat.size = content.length;

		// Store file
		this.files.set(path, { file, content });

		// Add to parent folder's children
		if (parent) {
			parent.children.push(file);
		}

		return file;
	}

	async delete(file: TFile): Promise<void> {
		if (!this.files.has(file.path)) {
			throw VaultAdapterError.notFound(file.path);
		}

		// Remove from parent folder's children
		if (file.parent) {
			file.parent.children = file.parent.children.filter((child) => child !== file);
		}

		// Delete file
		this.files.delete(file.path);
	}

	async rename(file: TFile, newPath: string): Promise<void> {
		const entry = this.files.get(file.path);
		if (!entry) {
			throw VaultAdapterError.notFound(file.path);
		}

		// Check if destination exists
		if (this.files.has(newPath)) {
			throw VaultAdapterError.alreadyExists(newPath);
		}

		// Ensure parent folder exists
		const parentPath = newPath.substring(0, newPath.lastIndexOf("/"));
		if (parentPath && !this.folders.has(parentPath)) {
			await this.createFolder(parentPath);
		}

		// Update file
		const newName = newPath.split("/").pop() || newPath;
		const newParent = parentPath ? (this.folders.get(parentPath) as TFolder) : null;

		// Remove from old parent
		if (file.parent) {
			file.parent.children = file.parent.children.filter((child) => child !== file);
		}

		// Update file properties
		file.path = newPath;
		file.name = newName;
		file.basename = newName.replace(/\.md$/, "");
		file.parent = newParent;

		// Add to new parent
		if (newParent) {
			newParent.children.push(file);
		}

		// Update storage
		this.files.delete(entry.file.path);
		this.files.set(newPath, entry);
	}

	// ==================== Directory Operations ====================

	async createFolder(path: string): Promise<void> {
		// Check if already exists
		if (this.folders.has(path)) {
			return; // No-op if folder exists
		}

		// Check if path exists as file
		if (this.files.has(path)) {
			throw VaultAdapterError.invalidPath(path, "Path exists as a file, not a folder");
		}

		// Create parent folders recursively
		const parts = path.split("/").filter((p) => p);
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;

			if (!this.folders.has(current)) {
				const parent = current.includes("/")
					? (this.folders.get(current.substring(0, current.lastIndexOf("/"))) as TFolder)
					: null;
				const folder = new MockTFolder(current, part, parent);

				// Add to parent's children
				if (parent) {
					parent.children.push(folder);
				}

				this.folders.set(current, folder);
			}
		}
	}

	// ==================== Query Operations ====================

	getAbstractFileByPath(path: string): TAbstractFile | null {
		// Check files first
		const fileEntry = this.files.get(path);
		if (fileEntry) {
			return fileEntry.file;
		}

		// Check folders
		return this.folders.get(path) || null;
	}

	getMarkdownFiles(): TFile[] {
		return Array.from(this.files.values())
			.map((entry) => entry.file)
			.filter((file) => file.extension === "md")
			.sort((a, b) => b.stat.mtime - a.stat.mtime); // Newest first
	}

	// ==================== Metadata Operations ====================

	getMetadata(file: TFile): CachedMetadata | null {
		// Mock implementation: no metadata cache
		return null;
	}

	getFrontmatter(file: TFile): Record<string, unknown> | null {
		// Mock implementation: no frontmatter parsing
		return null;
	}

	// ==================== Event Support ====================

	on(
		event: "create" | "delete" | "rename" | "modify",
		callback: (file: TAbstractFile, oldPath?: string) => void
	): () => void {
		// Mock implementation: no event system
		// Return no-op unsubscribe function
		return () => {};
	}

	// ==================== Adapter-Specific Properties ====================

	get basePath(): string {
		return "/mock/vault";
	}

	// ==================== Testing Utilities ====================

	/**
	 * Get all files (for testing/debugging)
	 */
	getAllFiles(): TFile[] {
		return Array.from(this.files.values()).map((entry) => entry.file);
	}

	/**
	 * Get all folders (for testing/debugging)
	 */
	getAllFolders(): TFolder[] {
		return Array.from(this.folders.values());
	}

	/**
	 * Clear all files and folders (reset state)
	 */
	clear(): void {
		this.files.clear();
		this.folders.clear();
		// Recreate root folder
		this.folders.set("", new MockTFolder("", "", null));
	}

	/**
	 * Get file content by path (convenience method for tests)
	 */
	getContentByPath(path: string): string | null {
		const entry = this.files.get(path);
		return entry ? entry.content : null;
	}
}
