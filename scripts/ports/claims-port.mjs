/**
 * Claims Port Interface
 *
 * Abstraktion für Claims-Datei-Zugriff.
 * Ermöglicht Testing mit In-Memory-Implementation.
 */

/**
 * @typedef {object} Claim
 * @property {string} owner - Agent-ID des Owners
 * @property {string} timestamp - ISO-Timestamp des Claims
 */

/**
 * @typedef {Object<string, Claim>} ClaimsData
 */

/**
 * @typedef {object} ClaimsPort
 * @property {() => import('../core/result.mjs').Result<ClaimsData>} load - Lädt alle Claims
 * @property {(claims: ClaimsData) => import('../core/result.mjs').Result<void>} save - Speichert alle Claims
 * @property {(taskId: string) => import('../core/result.mjs').Result<Claim|null>} getClaim - Holt einen Claim
 * @property {(taskId: string, claim: Claim) => import('../core/result.mjs').Result<void>} setClaim - Setzt einen Claim
 * @property {(taskId: string) => import('../core/result.mjs').Result<void>} removeClaim - Entfernt einen Claim
 * @property {() => import('../core/result.mjs').Result<Array<{taskId: string, owner: string}>>} cleanupExpired - Entfernt abgelaufene Claims
 * @property {() => string} getPath - Gibt den Pfad zur Claims-Datei zurück
 */

/**
 * Erstellt einen Claims-Port
 * Dies ist eine Factory-Funktion-Signatur, die von Adaptern implementiert wird.
 *
 * @param {object} [options] - Optionen
 * @returns {ClaimsPort}
 */
export function createClaimsPort(options = {}) {
  throw new Error('createClaimsPort must be implemented by an adapter');
}

// Type exports for JSDoc
export const ClaimsPortType = /** @type {ClaimsPort} */ (null);
