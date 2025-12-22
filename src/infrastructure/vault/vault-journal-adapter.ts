/**
 * Vault adapter for Journal storage.
 *
 * Stores each JournalEntry as a separate JSON file in the journal directory.
 * This approach scales better with many entries compared to a single aggregated file.
 *
 * File structure:
 * SaltMarcher/almanac/journal/
 *   ├── {entry-id}.json
 *   ├── {entry-id}.json
 *   └── ...
 */

import type { Result, AppError, EntityId } from '@core/index';
import { ok, err, createError } from '@core/index';
import type { JournalEntry } from '@core/schemas';
import { journalEntrySchema } from '@core/schemas';
import type { VaultIO } from './shared';
import type { JournalStoragePort } from '@/features/journal/types';

// ============================================================================
// Types
// ============================================================================

export interface VaultJournalAdapterDeps {
  vaultIO: VaultIO;
  /** Function to get the journal directory path */
  getJournalPath: () => string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create the Vault adapter for Journal storage.
 */
export function createVaultJournalAdapter(
  deps: VaultJournalAdapterDeps
): JournalStoragePort {
  const { vaultIO, getJournalPath } = deps;

  /**
   * Get the file path for a journal entry.
   */
  function getEntryPath(id: EntityId<'journal'>): string {
    return `${getJournalPath()}/${id}.json`;
  }

  return {
    async loadAll(): Promise<Result<JournalEntry[], AppError>> {
      const journalPath = getJournalPath();

      // Ensure directory exists
      const ensureResult = await vaultIO.ensureDir(journalPath);
      if (!ensureResult.ok) {
        return ensureResult as Result<JournalEntry[], AppError>;
      }

      // List all JSON files in the journal directory
      const filesResult = await vaultIO.listJsonFiles(journalPath);
      if (!filesResult.ok) {
        return filesResult as Result<JournalEntry[], AppError>;
      }

      const fileNames = filesResult.value;
      const entries: JournalEntry[] = [];
      const errors: string[] = [];

      // Load each entry file
      for (const fileName of fileNames) {
        const filePath = `${journalPath}/${fileName}.json`;
        const result = await vaultIO.readJson(filePath, journalEntrySchema);

        if (result.ok) {
          entries.push(result.value);
        } else {
          // Log error but continue loading other entries
          errors.push(`${fileName}: ${result.error.message}`);
        }
      }

      // Warn about any failed entries but don't fail the entire load
      if (errors.length > 0) {
        console.warn('Journal: Some entries failed to load:', errors);
      }

      return ok(entries);
    },

    async save(entry: JournalEntry): Promise<Result<void, AppError>> {
      const entryPath = getEntryPath(entry.id);

      // Ensure directory exists
      const journalPath = getJournalPath();
      const ensureResult = await vaultIO.ensureDir(journalPath);
      if (!ensureResult.ok) {
        return ensureResult;
      }

      // Write the entry
      return vaultIO.writeJson(entryPath, entry);
    },

    async delete(id: EntityId<'journal'>): Promise<Result<void, AppError>> {
      const entryPath = getEntryPath(id);

      // Check if file exists
      const fileExists = await vaultIO.exists(entryPath);
      if (!fileExists) {
        return err(
          createError('JOURNAL_ENTRY_NOT_FOUND', `Journal entry not found: ${id}`)
        );
      }

      // Delete by writing empty content and then removing
      // Note: Obsidian Vault API doesn't have a direct delete method in VaultIO
      // For now, we'll need to handle this differently
      // TODO: Add delete method to VaultIO interface

      // Workaround: We can't delete via VaultIO, so we return an error
      // This will need to be addressed by adding a delete method to VaultIO
      return err(
        createError(
          'DELETE_NOT_SUPPORTED',
          'Delete operation requires VaultIO.delete method'
        )
      );
    },

    async exists(id: EntityId<'journal'>): Promise<boolean> {
      const entryPath = getEntryPath(id);
      return vaultIO.exists(entryPath);
    },
  };
}
