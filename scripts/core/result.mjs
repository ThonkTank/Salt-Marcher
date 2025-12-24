/**
 * Result Pattern für Task-Scripts
 *
 * Leichtgewichtige Result<T, E> Implementation für konsistentes Error-Handling.
 * Orientiert sich an src/core/types/result.ts, aber ohne TypeScript.
 */

// ============================================================================
// RESULT CONSTRUCTORS
// ============================================================================

/**
 * Erstellt ein erfolgreiches Result
 * @template T
 * @param {T} value - Der Erfolgs-Wert
 * @returns {{ ok: true, value: T }}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * Erstellt ein fehlerhaftes Result
 * @template E
 * @param {E} error - Der Fehler
 * @returns {{ ok: false, error: E }}
 */
export function err(error) {
  return { ok: false, error };
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Prüft ob ein Result erfolgreich ist
 * @param {object} result - Das Result
 * @returns {boolean}
 */
export function isOk(result) {
  return result?.ok === true;
}

/**
 * Prüft ob ein Result fehlerhaft ist
 * @param {object} result - Das Result
 * @returns {boolean}
 */
export function isErr(result) {
  return result?.ok === false;
}

/**
 * Extrahiert den Wert oder gibt einen Default zurück
 * @template T, D
 * @param {object} result - Das Result
 * @param {D} defaultValue - Default-Wert bei Fehler
 * @returns {T | D}
 */
export function unwrapOr(result, defaultValue) {
  return result?.ok ? result.value : defaultValue;
}

/**
 * Extrahiert den Wert oder wirft einen Error
 * @template T
 * @param {object} result - Das Result
 * @returns {T}
 * @throws {Error} - Wenn Result ein Fehler ist
 */
export function unwrap(result) {
  if (result?.ok) {
    return result.value;
  }
  throw new Error(result?.error?.message ?? JSON.stringify(result?.error));
}

/**
 * Transformiert den Wert eines erfolgreichen Results
 * @template T, U
 * @param {object} result - Das Result
 * @param {(value: T) => U} fn - Transformations-Funktion
 * @returns {{ ok: true, value: U } | { ok: false, error: any }}
 */
export function map(result, fn) {
  if (result?.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transformiert den Fehler eines fehlerhaften Results
 * @template E, F
 * @param {object} result - Das Result
 * @param {(error: E) => F} fn - Transformations-Funktion
 * @returns {object}
 */
export function mapErr(result, fn) {
  if (result?.ok === false) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Kombiniert mehrere Results - Fehler beim ersten Fehlschlag
 * @param {object[]} results - Array von Results
 * @returns {object} - Ok mit Array aller Werte, oder erster Fehler
 */
export function all(results) {
  const values = [];
  for (const result of results) {
    if (!result?.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Task-spezifische Fehler-Codes
 */
export const TaskErrorCode = Object.freeze({
  // Entity Errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  BUG_NOT_FOUND: 'BUG_NOT_FOUND',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',

  // Validation Errors
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_DEPS: 'INVALID_DEPS',
  INVALID_ID: 'INVALID_ID',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INSUFFICIENT_COLUMNS: 'INSUFFICIENT_COLUMNS',

  // Dependency Errors
  CIRCULAR_DEP: 'CIRCULAR_DEP',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  DEP_NOT_FOUND: 'DEP_NOT_FOUND',

  // Claim Errors
  CLAIM_CONFLICT: 'CLAIM_CONFLICT',
  CLAIM_EXPIRED: 'CLAIM_EXPIRED',
  CLAIM_NOT_OWNER: 'CLAIM_NOT_OWNER',
  CLAIM_REQUIRED: 'CLAIM_REQUIRED',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  NOT_OWNER: 'NOT_OWNER',
  INVALID_KEY: 'INVALID_KEY',

  // State Errors
  ALREADY_DONE: 'ALREADY_DONE',

  // I/O Errors
  READ_FAILED: 'READ_FAILED',
  WRITE_FAILED: 'WRITE_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PARSE_FAILED: 'PARSE_FAILED'
});

/**
 * Erstellt einen Task-Fehler
 * @param {string} code - Fehler-Code aus TaskErrorCode
 * @param {string} message - Lesbare Fehlermeldung
 * @param {object} [details] - Zusätzliche Details
 * @returns {object} - Fehler-Objekt
 */
export function taskError(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Führt eine Funktion aus und fängt Exceptions als Err
 * @template T
 * @param {() => T} fn - Funktion die ausgeführt werden soll
 * @returns {{ ok: true, value: T } | { ok: false, error: { code: string, message: string, cause: any } }}
 */
export function tryCatch(fn) {
  try {
    return ok(fn());
  } catch (e) {
    return err({
      code: 'EXCEPTION',
      message: e.message ?? String(e),
      cause: e
    });
  }
}

/**
 * Async Version von tryCatch
 * @template T
 * @param {() => Promise<T>} fn - Async Funktion
 * @returns {Promise<object>}
 */
export async function tryCatchAsync(fn) {
  try {
    return ok(await fn());
  } catch (e) {
    return err({
      code: 'EXCEPTION',
      message: e.message ?? String(e),
      cause: e
    });
  }
}
