/**
 * NotificationService for user-facing error and info messages.
 *
 * Wraps Obsidian's Notice API with typed error handling.
 * Used by ViewModels to display feedback to users.
 */

import { Notice } from 'obsidian';
import type { AppError } from '@core/types/common';

// ============================================================================
// Types
// ============================================================================

export interface NotificationService {
  /** Show info message (3s duration) */
  info(message: string): void;

  /** Show warning message (5s duration) */
  warn(message: string): void;

  /** Show error message (8s duration) */
  error(message: string): void;

  /** Format and show AppError as user-friendly message */
  errorFromResult(error: AppError): void;
}

// ============================================================================
// Error Code to User Message Mapping
// ============================================================================

/**
 * Maps error codes to user-friendly messages.
 * Add new error codes here as they are introduced.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Not Found errors
  MAP_NOT_FOUND: 'Karte nicht gefunden',
  PARTY_NOT_FOUND: 'Party nicht gefunden',
  TERRAIN_NOT_FOUND: 'Terrain nicht gefunden',
  CALENDAR_NOT_FOUND: 'Kalender nicht gefunden',
  ENTITY_NOT_FOUND: 'Entity nicht gefunden',

  // Invalid errors
  INVALID_COORDINATE: 'Ungültige Koordinate',
  INVALID_TRANSPORT: 'Ungültiger Transportmodus',
  INVALID_STATE: 'Ungültiger Zustand',
  INVALID_DURATION: 'Ungültige Zeitdauer',

  // Failed errors
  SAVE_FAILED: 'Speichern fehlgeschlagen',
  LOAD_FAILED: 'Laden fehlgeschlagen',
  PARSE_FAILED: 'Datei konnte nicht gelesen werden',

  // Travel errors
  MOVEMENT_BLOCKED: 'Bewegung nicht möglich',
  NOT_ADJACENT: 'Ziel nicht benachbart',
  TERRAIN_IMPASSABLE: 'Terrain nicht passierbar',

  // Time errors
  TIME_ADVANCE_FAILED: 'Zeit konnte nicht vorgerückt werden',
  CALENDAR_CHANGE_FAILED: 'Kalender konnte nicht gewechselt werden',
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Format AppError to user-friendly message.
 * Falls back to error.message if code not mapped.
 */
function formatErrorForUser(error: AppError): string {
  const mappedMessage = ERROR_MESSAGES[error.code];
  if (mappedMessage) {
    return mappedMessage;
  }

  // Fallback: Use error message or generic text
  return error.message || 'Ein Fehler ist aufgetreten';
}

/**
 * Create a NotificationService instance.
 * Uses Obsidian's Notice API for displaying messages.
 */
export function createNotificationService(): NotificationService {
  return {
    info(message: string): void {
      new Notice(message, 3000);
    },

    warn(message: string): void {
      new Notice(`⚠️ ${message}`, 5000);
    },

    error(message: string): void {
      new Notice(`❌ ${message}`, 8000);
    },

    errorFromResult(error: AppError): void {
      const userMessage = formatErrorForUser(error);
      this.error(userMessage);
    },
  };
}
