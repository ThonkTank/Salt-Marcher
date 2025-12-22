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

/** Notification severity level */
export type NotificationType = 'info' | 'warning' | 'error';

/** Action button for notifications (Post-MVP: not yet implemented) */
export interface NotificationAction {
  label: string;
  action: () => void;
}

/** Structured notification with title, message, and optional actions */
export interface Notification {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // ms, undefined = type-based default
  actions?: NotificationAction[]; // Post-MVP: accepted but ignored
}

export interface NotificationService {
  /** Show structured notification (primary API per spec) */
  show(notification: Notification): void;

  /** Show info message (3s duration) - convenience method */
  info(message: string): void;

  /** Show warning message (5s duration) - convenience method */
  warn(message: string): void;

  /** Show error message (8s duration) - convenience method */
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
// Constants
// ============================================================================

/** Default durations per notification type (in ms) */
const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  info: 3000,
  warning: 5000,
  error: 8000,
};

/** Prefixes per notification type for visual distinction */
const PREFIXES: Record<NotificationType, string> = {
  info: '',
  warning: '⚠️ ',
  error: '❌ ',
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

// ============================================================================
// Feature-Specific Error Formatters
// ============================================================================

/**
 * Create a fallback notification for unknown error codes.
 */
function createFallbackNotification(error: AppError): Notification {
  return {
    type: 'error',
    title: 'Fehler',
    message: error.message || 'Ein unbekannter Fehler ist aufgetreten.',
  };
}

/**
 * Format Map feature errors to Notification.
 */
export function formatMapError(error: AppError): Notification {
  switch (error.code) {
    case 'MAP_NOT_FOUND':
      return {
        type: 'error',
        title: 'Map nicht gefunden',
        message: 'Die angeforderte Map existiert nicht.',
      };
    case 'NO_MAP_LOADED':
      return {
        type: 'warning',
        title: 'Keine Map geladen',
        message: 'Bitte zuerst eine Map laden.',
      };
    case 'INVALID_COORDINATE':
      return {
        type: 'error',
        title: 'Ungültige Koordinate',
        message: 'Die angegebene Koordinate ist ungültig.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Travel feature errors to Notification.
 */
export function formatTravelError(error: AppError): Notification {
  switch (error.code) {
    case 'NO_PARTY_POSITION':
      return {
        type: 'error',
        title: 'Keine Party-Position',
        message: 'Die Party hat keine Position auf der Karte.',
      };
    case 'NO_ROUTE':
      return {
        type: 'warning',
        title: 'Keine Route',
        message: 'Es wurde keine Route geplant.',
      };
    case 'NO_WAYPOINTS':
      return {
        type: 'warning',
        title: 'Keine Wegpunkte',
        message: 'Setze mindestens einen Wegpunkt.',
      };
    case 'NO_TERRAIN':
      return {
        type: 'error',
        title: 'Kein Terrain',
        message: 'An dieser Position existiert kein Terrain.',
      };
    case 'INVALID_STATE':
      return {
        type: 'error',
        title: 'Ungültiger Zustand',
        message: 'Diese Aktion ist im aktuellen Zustand nicht möglich.',
      };
    case 'MOVEMENT_BLOCKED':
      return {
        type: 'warning',
        title: 'Bewegung blockiert',
        message: 'Die Bewegung ist nicht möglich.',
      };
    case 'NOT_ADJACENT':
      return {
        type: 'warning',
        title: 'Nicht benachbart',
        message: 'Das Ziel ist nicht benachbart.',
      };
    case 'TERRAIN_IMPASSABLE':
      return {
        type: 'warning',
        title: 'Terrain nicht passierbar',
        message: 'Dieses Terrain kann nicht betreten werden.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Time feature errors to Notification.
 */
export function formatTimeError(error: AppError): Notification {
  switch (error.code) {
    case 'NO_CALENDAR':
      return {
        type: 'error',
        title: 'Kein Kalender',
        message: 'Es ist kein Kalender geladen.',
      };
    case 'NOT_LOADED':
      return {
        type: 'error',
        title: 'Zeit nicht geladen',
        message: 'Das Zeitsystem ist nicht initialisiert.',
      };
    case 'TIME_ADVANCE_FAILED':
      return {
        type: 'error',
        title: 'Zeit-Fehler',
        message: 'Die Zeit konnte nicht vorgerückt werden.',
      };
    case 'CALENDAR_CHANGE_FAILED':
      return {
        type: 'error',
        title: 'Kalender-Fehler',
        message: 'Der Kalender konnte nicht gewechselt werden.',
      };
    case 'INVALID_DURATION':
      return {
        type: 'error',
        title: 'Ungültige Zeitdauer',
        message: 'Die angegebene Zeitdauer ist ungültig.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Weather feature errors to Notification.
 */
export function formatWeatherError(error: AppError): Notification {
  switch (error.code) {
    case 'NO_WEATHER_INDOOR':
      return {
        type: 'info',
        title: 'Kein Wetter',
        message: 'Innenräume haben kein Wetter.',
      };
    case 'NO_MAP_LOADED':
      return {
        type: 'warning',
        title: 'Keine Map geladen',
        message: 'Wetter benötigt eine geladene Map.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Party feature errors to Notification.
 */
export function formatPartyError(error: AppError): Notification {
  switch (error.code) {
    case 'NO_PARTY':
      return {
        type: 'error',
        title: 'Keine Party',
        message: 'Es ist keine Party geladen.',
      };
    case 'NO_POSITION':
      return {
        type: 'error',
        title: 'Keine Position',
        message: 'Die Party hat keine Position.',
      };
    case 'PARTY_NOT_FOUND':
      return {
        type: 'error',
        title: 'Party nicht gefunden',
        message: 'Die angeforderte Party existiert nicht.',
      };
    case 'CHARACTER_NOT_FOUND':
      return {
        type: 'error',
        title: 'Charakter nicht gefunden',
        message: 'Der Charakter wurde nicht gefunden.',
      };
    case 'ALREADY_MEMBER':
      return {
        type: 'warning',
        title: 'Bereits Mitglied',
        message: 'Der Charakter ist bereits in der Party.',
      };
    case 'NOT_MEMBER':
      return {
        type: 'warning',
        title: 'Kein Mitglied',
        message: 'Der Charakter ist nicht in der Party.',
      };
    case 'NO_CHARACTER_STORAGE':
      return {
        type: 'error',
        title: 'Kein Charakter-Speicher',
        message: 'Der Charakter-Speicher ist nicht verfügbar.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Encounter feature errors to Notification.
 */
export function formatEncounterError(error: AppError): Notification {
  switch (error.code) {
    case 'ENCOUNTER_NOT_FOUND':
      return {
        type: 'error',
        title: 'Encounter nicht gefunden',
        message: 'Der Encounter wurde nicht gefunden.',
      };
    case 'GENERATION_FAILED':
      return {
        type: 'error',
        title: 'Generierung fehlgeschlagen',
        message: 'Der Encounter konnte nicht generiert werden.',
      };
    case 'SELECTION_FAILED':
      return {
        type: 'error',
        title: 'Auswahl fehlgeschlagen',
        message: 'Keine passenden Kreaturen gefunden.',
      };
    case 'ALREADY_RESOLVED':
      return {
        type: 'warning',
        title: 'Bereits abgeschlossen',
        message: 'Dieser Encounter wurde bereits abgeschlossen.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Combat feature errors to Notification.
 */
export function formatCombatError(error: AppError): Notification {
  switch (error.code) {
    case 'COMBAT_ALREADY_ACTIVE':
      return {
        type: 'warning',
        title: 'Kampf bereits aktiv',
        message: 'Es läuft bereits ein Kampf.',
      };
    case 'COMBAT_NOT_ACTIVE':
      return {
        type: 'warning',
        title: 'Kein aktiver Kampf',
        message: 'Es ist kein Kampf aktiv.',
      };
    case 'INVALID_PARTICIPANTS':
      return {
        type: 'error',
        title: 'Ungültige Teilnehmer',
        message: 'Die Kampfteilnehmer sind ungültig.',
      };
    case 'PARTICIPANT_NOT_FOUND':
      return {
        type: 'error',
        title: 'Teilnehmer nicht gefunden',
        message: 'Der Teilnehmer wurde nicht gefunden.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Format Quest feature errors to Notification.
 */
export function formatQuestError(error: AppError): Notification {
  switch (error.code) {
    case 'QUEST_NOT_FOUND':
      return {
        type: 'error',
        title: 'Quest nicht gefunden',
        message: 'Die Quest wurde nicht gefunden.',
      };
    case 'QUEST_ALREADY_DISCOVERED':
      return {
        type: 'info',
        title: 'Quest bereits entdeckt',
        message: 'Diese Quest wurde bereits entdeckt.',
      };
    case 'QUEST_ALREADY_ACTIVE':
      return {
        type: 'warning',
        title: 'Quest bereits aktiv',
        message: 'Diese Quest ist bereits aktiv.',
      };
    case 'QUEST_ALREADY_COMPLETED':
      return {
        type: 'info',
        title: 'Quest bereits abgeschlossen',
        message: 'Diese Quest wurde bereits abgeschlossen.',
      };
    case 'QUEST_ALREADY_FAILED':
      return {
        type: 'info',
        title: 'Quest bereits gescheitert',
        message: 'Diese Quest ist bereits gescheitert.',
      };
    case 'QUEST_NOT_ACTIVE':
      return {
        type: 'warning',
        title: 'Quest nicht aktiv',
        message: 'Diese Quest ist nicht aktiv.',
      };
    case 'OBJECTIVE_NOT_FOUND':
      return {
        type: 'error',
        title: 'Ziel nicht gefunden',
        message: 'Das Quest-Ziel wurde nicht gefunden.',
      };
    case 'OBJECTIVE_NOT_TRACKED':
      return {
        type: 'warning',
        title: 'Ziel nicht verfolgt',
        message: 'Dieses Ziel wird nicht verfolgt.',
      };
    case 'OBJECTIVES_NOT_COMPLETE':
      return {
        type: 'warning',
        title: 'Ziele nicht erfüllt',
        message: 'Nicht alle Ziele sind erfüllt.',
      };
    case 'SLOT_NOT_FOUND':
      return {
        type: 'error',
        title: 'Slot nicht gefunden',
        message: 'Der Encounter-Slot wurde nicht gefunden.',
      };
    case 'SLOT_ALREADY_FILLED':
      return {
        type: 'warning',
        title: 'Slot bereits belegt',
        message: 'Dieser Slot ist bereits belegt.',
      };
    default:
      return createFallbackNotification(error);
  }
}

/**
 * Create a NotificationService instance.
 * Uses Obsidian's Notice API for displaying messages.
 */
export function createNotificationService(): NotificationService {
  return {
    show(notification: Notification): void {
      const duration = notification.duration ?? DEFAULT_DURATIONS[notification.type];
      const prefix = PREFIXES[notification.type];

      // Multiline format: Title\nMessage (if title present)
      const text = notification.title
        ? `${prefix}${notification.title}\n${notification.message}`
        : `${prefix}${notification.message}`;

      new Notice(text, duration);

      // actions[] are accepted but ignored (Post-MVP)
      // TODO #2917b: Custom Modal for notifications with actions
    },

    info(message: string): void {
      this.show({ type: 'info', title: '', message });
    },

    warn(message: string): void {
      this.show({ type: 'warning', title: '', message });
    },

    error(message: string): void {
      this.show({ type: 'error', title: '', message });
    },

    errorFromResult(error: AppError): void {
      const userMessage = formatErrorForUser(error);
      this.error(userMessage);
    },
  };
}
