/**
 * Shared Vault I/O utilities.
 *
 * Provides JSON read/write operations with schema validation
 * and proper error handling for Obsidian Vault integration.
 */

import type { Vault, TFile, TFolder } from 'obsidian';
import { TFolder as ObsidianTFolder } from 'obsidian';
import type { Result, AppError } from '@core/index';
import { ok, err, createError } from '@core/index';
import { z } from 'zod';

// ============================================================================
// Vault I/O Interface
// ============================================================================

/**
 * Vault I/O operations for JSON file handling.
 */
export interface VaultIO {
  /**
   * Read and parse JSON file with schema validation.
   *
   * @param path - File path relative to vault root
   * @param schema - Zod schema for validation
   * @returns Validated data (output type with defaults applied) or error
   *
   * Error codes:
   * - FILE_NOT_FOUND: File doesn't exist
   * - PARSE_FAILED: JSON parse or schema validation failed
   */
  readJson<S extends z.ZodTypeAny>(
    path: string,
    schema: S
  ): Promise<Result<z.output<S>, AppError>>;

  /**
   * Write JSON data to file.
   * Creates parent directories if they don't exist.
   *
   * @param path - File path relative to vault root
   * @param data - Data to serialize as JSON
   * @returns Success or error
   *
   * Error codes:
   * - WRITE_FAILED: Failed to write file
   */
  writeJson<T>(path: string, data: T): Promise<Result<void, AppError>>;

  /**
   * Check if file exists at path.
   */
  exists(path: string): Promise<boolean>;

  /**
   * List JSON files in directory.
   * Returns file names without extension (basenames).
   *
   * @param dirPath - Directory path relative to vault root
   * @returns Array of file basenames or error
   *
   * If directory doesn't exist, returns empty array (not an error).
   *
   * Error codes:
   * - INVALID_PATH: Path exists but is not a directory
   */
  listJsonFiles(dirPath: string): Promise<Result<string[], AppError>>;

  /**
   * Ensure directory exists, creating it if necessary.
   *
   * @param path - Directory path relative to vault root
   * @returns Success or error
   *
   * Error codes:
   * - WRITE_FAILED: Failed to create directory
   */
  ensureDir(path: string): Promise<Result<void, AppError>>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create VaultIO instance for the given Obsidian Vault.
 */
export function createVaultIO(vault: Vault): VaultIO {
  /**
   * Helper to ensure parent directories exist.
   */
  async function ensureDirImpl(path: string): Promise<Result<void, AppError>> {
    if (!path || path === '/') {
      return ok(undefined);
    }

    const existing = vault.getAbstractFileByPath(path);
    if (existing) {
      return ok(undefined);
    }

    try {
      await vault.createFolder(path);
      return ok(undefined);
    } catch (e) {
      // Folder might have been created by another operation (race condition)
      if (vault.getAbstractFileByPath(path)) {
        return ok(undefined);
      }

      return err(
        createError('WRITE_FAILED', `Failed to create directory: ${path}`, {
          error: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }

  return {
    async readJson<S extends z.ZodTypeAny>(
      path: string,
      schema: S
    ): Promise<Result<z.output<S>, AppError>> {
      const file = vault.getAbstractFileByPath(path);

      if (!file) {
        return err(createError('FILE_NOT_FOUND', `File not found: ${path}`));
      }

      // Type guard: ensure it's a file, not a folder
      if (!(file instanceof Object) || !('stat' in file)) {
        return err(createError('FILE_NOT_FOUND', `Path is not a file: ${path}`));
      }

      try {
        const content = await vault.read(file as TFile);
        const parsed = JSON.parse(content);
        const validated = schema.safeParse(parsed);

        if (!validated.success) {
          return err(
            createError('PARSE_FAILED', `Schema validation failed: ${path}`, {
              zodError: validated.error.flatten(),
            })
          );
        }

        return ok(validated.data);
      } catch (e) {
        return err(
          createError('PARSE_FAILED', `Failed to parse JSON: ${path}`, {
            error: e instanceof Error ? e.message : String(e),
          })
        );
      }
    },

    async writeJson<T>(path: string, data: T): Promise<Result<void, AppError>> {
      try {
        const content = JSON.stringify(data, null, 2);
        const file = vault.getAbstractFileByPath(path);

        if (file && 'stat' in file) {
          // File exists, modify it
          await vault.modify(file as TFile, content);
        } else {
          // File doesn't exist, ensure parent directory exists and create
          const lastSlash = path.lastIndexOf('/');
          if (lastSlash > 0) {
            const dirPath = path.substring(0, lastSlash);
            const dirResult = await ensureDirImpl(dirPath);
            if (!dirResult.ok) {
              return dirResult;
            }
          }

          await vault.create(path, content);
        }

        return ok(undefined);
      } catch (e) {
        return err(
          createError('WRITE_FAILED', `Failed to write file: ${path}`, {
            error: e instanceof Error ? e.message : String(e),
          })
        );
      }
    },

    async exists(path: string): Promise<boolean> {
      return vault.getAbstractFileByPath(path) !== null;
    },

    async listJsonFiles(dirPath: string): Promise<Result<string[], AppError>> {
      const folder = vault.getAbstractFileByPath(dirPath);

      if (!folder) {
        // Directory doesn't exist - return empty list (not an error)
        return ok([]);
      }

      if (!(folder instanceof ObsidianTFolder)) {
        return err(
          createError('INVALID_PATH', `Path is not a directory: ${dirPath}`)
        );
      }

      const files = (folder as TFolder).children
        .filter(
          (f): f is TFile =>
            'extension' in f && (f as TFile).extension === 'json'
        )
        .map((f) => f.basename); // filename without extension

      return ok(files);
    },

    async ensureDir(path: string): Promise<Result<void, AppError>> {
      return ensureDirImpl(path);
    },
  };
}
