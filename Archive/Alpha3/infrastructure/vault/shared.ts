/**
 * Infrastructure - Shared Vault Utilities
 * Common helpers for all Vault adapters
 */

import type { Vault } from 'obsidian';

/**
 * Ensure a directory path exists in the vault
 * Creates all intermediate directories if needed
 */
export async function ensureDirectoryExists(
  vault: Vault,
  path: string
): Promise<void> {
  const parts = path.split('/');
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const folder = vault.getAbstractFileByPath(currentPath);
    if (!folder) {
      try {
        await vault.createFolder(currentPath);
      } catch {
        // Folder might already exist (race condition)
      }
    }
  }
}

/**
 * Check if an abstract file is a folder
 */
export function isFolder(file: unknown): boolean {
  return file !== null && typeof file === 'object' && 'children' in file;
}

/**
 * Check if an abstract file is a file (not folder)
 */
export function isFile(file: unknown): boolean {
  return file !== null && typeof file === 'object' && 'extension' in file;
}
