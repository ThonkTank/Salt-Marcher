/**
 * Vault-backed Calendar Registry Adapter.
 *
 * Implements CalendarRegistryPort with Obsidian Vault persistence.
 * Calendars are stored as JSON files in the almanac directory.
 *
 * Note: CalendarDefinition is an Entity stored via EntityRegistry pattern,
 * but for Phase 2 we use a simpler direct adapter approach.
 */

import type { Result, AppError, CalendarId } from '@core/index';
import { ok, err, createError, toEntityId } from '@core/index';
import type { CalendarDefinition } from '@core/schemas';
import { calendarDefinitionSchema } from '@core/schemas';
import type { CalendarRegistryPort } from '@/features/time';
import type { VaultIO } from './shared';

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependencies for creating a vault calendar adapter.
 */
export interface VaultCalendarAdapterDeps {
  /** Vault I/O instance */
  vaultIO: VaultIO;

  /**
   * Function to get the current almanac path.
   * Using a function allows for dynamic path resolution
   * when settings change.
   */
  getAlmanacPath: () => string;
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create a vault-backed CalendarRegistryPort.
 *
 * @param deps - Adapter dependencies
 * @returns CalendarRegistryPort implementation
 */
export function createVaultCalendarAdapter(
  deps: VaultCalendarAdapterDeps
): CalendarRegistryPort {
  const { vaultIO, getAlmanacPath } = deps;

  /**
   * Get file path for a calendar ID.
   */
  function getFilePath(id: CalendarId): string {
    return `${getAlmanacPath()}/${String(id)}.json`;
  }

  return {
    async get(id: CalendarId): Promise<Result<CalendarDefinition, AppError>> {
      const path = getFilePath(id);
      const result = await vaultIO.readJson(path, calendarDefinitionSchema);

      // Transform FILE_NOT_FOUND to CALENDAR_NOT_FOUND (domain-level error)
      if (!result.ok && result.error.code === 'FILE_NOT_FOUND') {
        return err(createError('CALENDAR_NOT_FOUND', `Calendar not found: ${id}`));
      }

      return result;
    },

    async listIds(): Promise<Result<CalendarId[], AppError>> {
      const result = await vaultIO.listJsonFiles(getAlmanacPath());

      if (!result.ok) {
        return result;
      }

      return ok(result.value.map((name) => toEntityId<'calendar'>(name)));
    },

    async exists(id: CalendarId): Promise<boolean> {
      return vaultIO.exists(getFilePath(id));
    },
  };
}
