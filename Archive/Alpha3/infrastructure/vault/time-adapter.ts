/**
 * Infrastructure - Time Vault Adapter
 * Implements TimeStoragePort for Obsidian Vault
 */

import type { Vault, TFile } from 'obsidian';
import { z } from 'zod';
import {
  type CalendarConfig,
  type DateTime,
  CalendarConfigSchema,
  GREGORIAN_CALENDAR,
} from '@core/schemas/time';
import { entityIdSchema } from '@core/types/common';
import { ensureDirectoryExists, isFolder, isFile } from './shared';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Persisted state */
export interface TimeState {
  currentDateTime: DateTime;
  calendarId: string;
}

/**
 * Outbound Port for time persistence
 * Implemented by this adapter
 */
export interface TimeStoragePort {
  loadState(): Promise<TimeState | null>;
  saveState(state: TimeState): Promise<void>;
  loadCalendar(id: string): Promise<CalendarConfig | null>;
  listCalendars(): Promise<Array<{ id: string; name: string }>>;
}

// ═══════════════════════════════════════════════════════════════
// Zod Schemas for Persistence
// ═══════════════════════════════════════════════════════════════

const TimeStateSchema = z.object({
  currentDateTime: z.object({
    year: z.number().int(),
    month: z.number().int().min(1),
    day: z.number().int().min(1),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    calendarId: entityIdSchema<'calendar'>(),
  }),
  calendarId: z.string(),
});

// ═══════════════════════════════════════════════════════════════
// Built-in Calendar Registry
// ═══════════════════════════════════════════════════════════════

const BUILTIN_CALENDARS: Map<string, CalendarConfig> = new Map([
  ['gregorian', GREGORIAN_CALENDAR],
]);

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Create a TimeStoragePort implementation using Obsidian Vault
 */
export function createVaultTimeAdapter(
  vault: Vault,
  basePath = 'SaltMarcher'
): TimeStoragePort {
  // ─────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────

  async function loadState(): Promise<TimeState | null> {
    const path = `${basePath}/time/state.json`;

    try {
      const file = vault.getAbstractFileByPath(path);
      if (!file || !isFile(file)) {
        return null;
      }

      const content = await vault.read(file as TFile);
      const parsed = JSON.parse(content);
      const validated = TimeStateSchema.parse(parsed);

      return validated;
    } catch {
      return null;
    }
  }

  async function saveState(state: TimeState): Promise<void> {
    const path = `${basePath}/time/state.json`;
    const content = JSON.stringify(state, null, 2);

    await ensureDirectoryExists(vault, `${basePath}/time`);

    const file = vault.getAbstractFileByPath(path);
    if (file && isFile(file)) {
      await vault.modify(file as TFile, content);
    } else {
      await vault.create(path, content);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Calendar Management
  // ─────────────────────────────────────────────────────────────

  async function loadCalendar(id: string): Promise<CalendarConfig | null> {
    // Check built-in first
    const builtin = BUILTIN_CALENDARS.get(id);
    if (builtin) {
      return builtin;
    }

    // Then load custom from vault
    const path = `${basePath}/calendars/${id}.json`;

    try {
      const file = vault.getAbstractFileByPath(path);
      if (!file || !isFile(file)) {
        return null;
      }

      const content = await vault.read(file as TFile);
      const parsed = JSON.parse(content);
      const validated = CalendarConfigSchema.parse(parsed);

      return validated;
    } catch {
      return null;
    }
  }

  async function listCalendars(): Promise<Array<{ id: string; name: string }>> {
    const calendars: Array<{ id: string; name: string }> = [];

    // Built-in calendars
    for (const [id, config] of BUILTIN_CALENDARS) {
      calendars.push({ id, name: config.name });
    }

    // Custom calendars from vault
    const customPath = `${basePath}/calendars`;
    try {
      const folder = vault.getAbstractFileByPath(customPath);
      if (folder && isFolder(folder)) {
        const children = (
          folder as unknown as { children: { path: string; name: string }[] }
        ).children;
        for (const child of children) {
          if (child.path.endsWith('.json')) {
            const id = child.name.replace('.json', '');
            // Don't list duplicates if it's a built-in
            if (!BUILTIN_CALENDARS.has(id)) {
              try {
                const calendar = await loadCalendar(id);
                if (calendar) {
                  calendars.push({ id, name: calendar.name });
                }
              } catch {
                // Skip invalid calendar files
              }
            }
          }
        }
      }
    } catch {
      // Folder doesn't exist yet
    }

    return calendars;
  }

  // ─────────────────────────────────────────────────────────────
  // Return Port Implementation
  // ─────────────────────────────────────────────────────────────

  return {
    loadState,
    saveState,
    loadCalendar,
    listCalendars,
  };
}
