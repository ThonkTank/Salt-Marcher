// Ziel: Claim-Management für exklusive Task-Bearbeitung
// Siehe: docs/tools/taskTool.md#claim---task-claimen
//
// Funktionen:
// - claimTask(taskId, tasks, claims) - Task claimen
// - releaseClaim(key, claims, tasks) - Claim freigeben
// - validateClaim(taskId, key, claims) - Claim-Key validieren
// - cleanupExpiredClaims(claims, tasks) - Abgelaufene Claims entfernen
// - generateKey() - 4-Zeichen Schlüssel generieren
// - isExpired(timestamp) - Prüft ob Claim abgelaufen
// - formatRemainingTime(timestamp) - Verbleibende Zeit formatieren

import { ok, err } from '../core/result.mjs';
import { STATUS } from '../core/table/schema.mjs';

const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Stunden
const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Claiment eine Task für exklusive Bearbeitung.
 * @param {string} taskId - Task-ID (z.B. '14' oder '#14')
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {import('../core/result.mjs').Result<{key: string, task: import('../core/table/parser.mjs').Task}, {code: string}>}
 */
export function claimTask(taskId, tasks, claims) {
  const normalizedId = taskId.replace('#', '');
  const task = tasks.find(t => String(t.id) === normalizedId);

  if (!task) {
    return err({ code: 'TASK_NOT_FOUND', id: taskId });
  }

  // Prüfen ob bereits geclaimed
  if (claims.claims[normalizedId]) {
    const existingClaim = claims.claims[normalizedId];
    if (!isExpired(existingClaim.timestamp)) {
      return err({ code: 'ALREADY_CLAIMED', id: taskId, key: existingClaim.key });
    }
    // Abgelaufener Claim wird überschrieben
  }

  // Neuen Key generieren
  let key;
  do {
    key = generateKey();
  } while (claims.keys[key]); // Sicherstellen dass Key unique ist

  // Claim speichern
  claims.claims[normalizedId] = {
    key,
    timestamp: Date.now(),
    previousStatus: task.status,
  };
  claims.keys[key] = normalizedId;

  // Task-Status auf 🔒 setzen
  task.status = STATUS.claimed.symbol;

  return ok({ key, task });
}

/**
 * Gibt einen Claim frei.
 * @param {string} key - 4-Zeichen Schlüssel
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {import('../core/result.mjs').Result<{task: import('../core/table/parser.mjs').Task, previousStatus: string}, {code: string}>}
 */
export function releaseClaim(key, claims, tasks) {
  const taskId = claims.keys[key];

  if (!taskId) {
    return err({ code: 'INVALID_KEY', key });
  }

  const claim = claims.claims[taskId];
  const task = tasks.find(t => String(t.id) === taskId);

  if (!task) {
    return err({ code: 'TASK_NOT_FOUND', id: taskId });
  }

  // Vorherigen Status wiederherstellen
  const previousStatus = claim.previousStatus;
  task.status = previousStatus;

  // Claim entfernen
  delete claims.claims[taskId];
  delete claims.keys[key];

  return ok({ task, previousStatus });
}

/**
 * Validiert einen Claim-Key für eine Task.
 * @param {string} taskId
 * @param {string} key
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {import('../core/result.mjs').Result<{timestamp: number, previousStatus: string}, {code: string}>}
 */
export function validateClaim(taskId, key, claims) {
  const normalizedId = taskId.replace('#', '');
  const claim = claims.claims[normalizedId];

  if (!claim) {
    return err({ code: 'NOT_CLAIMED', id: taskId });
  }

  if (claim.key !== key) {
    return err({ code: 'INVALID_KEY', id: taskId, expected: claim.key });
  }

  if (isExpired(claim.timestamp)) {
    return err({ code: 'CLAIM_EXPIRED', id: taskId });
  }

  return ok(claim);
}

/**
 * Entfernt abgelaufene Claims und stellt vorherige Status wieder her.
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {{ claims: import('../adapters/fs-task-adapter.mjs').ClaimsData, restoredTasks: import('../core/table/parser.mjs').Task[] }}
 */
export function cleanupExpiredClaims(claims, tasks) {
  const restoredTasks = [];

  for (const [taskId, claim] of Object.entries(claims.claims)) {
    if (isExpired(claim.timestamp)) {
      const task = tasks.find(t => String(t.id) === taskId);
      if (task) {
        task.status = claim.previousStatus;
        restoredTasks.push(task);
      }

      delete claims.claims[taskId];
      delete claims.keys[claim.key];
    }
  }

  return { claims, restoredTasks };
}

/**
 * Generiert 4-Zeichen alphanumerischen Schlüssel.
 * @returns {string}
 */
export function generateKey() {
  return Array.from({ length: 4 }, () =>
    KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]
  ).join('');
}

/**
 * Prüft ob ein Claim abgelaufen ist.
 * @param {number} timestamp
 * @returns {boolean}
 */
export function isExpired(timestamp) {
  return Date.now() - timestamp > CLAIM_EXPIRY_MS;
}

/**
 * Berechnet verbleibende Zeit eines Claims.
 * @param {number} timestamp
 * @returns {string} - z.B. "1h 30min"
 */
export function formatRemainingTime(timestamp) {
  const remaining = CLAIM_EXPIRY_MS - (Date.now() - timestamp);
  if (remaining <= 0) return 'abgelaufen';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}
