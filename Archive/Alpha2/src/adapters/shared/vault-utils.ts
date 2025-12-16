/**
 * Vault utilities for file operations
 *
 * Shared helpers to eliminate duplication across store implementations.
 */

import type { Vault, TFile, TFolder, TAbstractFile } from 'obsidian';

/**
 * Ensure a directory exists in the vault, creating it if necessary
 */
export async function ensureDirectory(vault: Vault, path: string): Promise<void> {
    const folder = vault.getAbstractFileByPath(path);
    if (!folder) {
        await vault.createFolder(path);
    }
}

/**
 * Save content to a file, creating or updating as needed
 */
export async function saveFile(
    vault: Vault,
    path: string,
    content: string
): Promise<void> {
    const existingFile = vault.getAbstractFileByPath(path);

    if (existingFile) {
        await vault.modify(existingFile as TFile, content);
    } else {
        await vault.create(path, content);
    }
}

/**
 * Save JSON data to a file
 */
export async function saveJsonFile(
    vault: Vault,
    path: string,
    data: unknown
): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await saveFile(vault, path, content);
}

/**
 * Load content from a file
 * Returns null if file doesn't exist
 */
export async function loadFile(
    vault: Vault,
    path: string
): Promise<string | null> {
    const file = vault.getAbstractFileByPath(path);
    if (!file) {
        return null;
    }

    try {
        return await vault.read(file as TFile);
    } catch {
        return null;
    }
}

/**
 * Load and parse JSON from a file
 * Returns null if file doesn't exist or parse fails
 */
export async function loadJsonFile<T>(
    vault: Vault,
    path: string
): Promise<T | null> {
    const content = await loadFile(vault, path);
    if (content === null) {
        return null;
    }

    try {
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(vault: Vault, path: string): Promise<boolean> {
    const file = vault.getAbstractFileByPath(path);
    if (file) {
        await vault.delete(file);
        return true;
    }
    return false;
}

/**
 * Check if a file exists
 */
export function fileExists(vault: Vault, path: string): boolean {
    return vault.getAbstractFileByPath(path) !== null;
}

/**
 * List files in a directory with optional extension filter
 */
export function listFilesInDirectory(
    vault: Vault,
    directory: string,
    extension?: string
): TFile[] {
    return vault.getFiles().filter((f) => {
        if (!f.path.startsWith(directory)) return false;
        if (extension && f.extension !== extension) return false;
        return true;
    });
}
