/**
 * Filesystem Claims Adapter
 *
 * Implementiert den ClaimsPort für Filesystem-Zugriff.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { CLAIM_EXPIRY_MS } from '../core/table/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLAIMS_PATH = join(__dirname, '..', '..', 'docs', 'architecture', '.task-claims.json');

/**
 * Erstellt einen Filesystem-basierten Claims-Adapter
 *
 * @param {object} [options] - Optionen
 * @param {string} [options.path] - Pfad zur Claims-Datei
 * @param {number} [options.expiryMs] - Claim-Ablaufzeit in ms
 * @returns {import('../ports/claims-port.mjs').ClaimsPort}
 */
export function createFsClaimsAdapter(options = {}) {
  const claimsPath = options.path ?? DEFAULT_CLAIMS_PATH;
  const expiryMs = options.expiryMs ?? CLAIM_EXPIRY_MS;

  /**
   * Interne Hilfsfunktion zum Laden
   */
  function loadClaims() {
    try {
      if (!existsSync(claimsPath)) {
        return {};
      }
      const content = readFileSync(claimsPath, 'utf-8');
      const data = JSON.parse(content);
      return data.claims || {};
    } catch {
      return {};
    }
  }

  /**
   * Interne Hilfsfunktion zum Speichern
   */
  function saveClaims(claims) {
    writeFileSync(claimsPath, JSON.stringify({ claims }, null, 2));
  }

  return {
    /**
     * Lädt alle Claims
     * @returns {import('../core/result.mjs').Result<import('../ports/claims-port.mjs').ClaimsData>}
     */
    load() {
      try {
        return ok(loadClaims());
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Claims nicht laden: ${e.message}`,
          path: claimsPath,
          cause: e
        });
      }
    },

    /**
     * Speichert alle Claims
     * @param {import('../ports/claims-port.mjs').ClaimsData} claims
     * @returns {import('../core/result.mjs').Result<void>}
     */
    save(claims) {
      try {
        saveClaims(claims);
        return ok(undefined);
      } catch (e) {
        return err({
          code: TaskErrorCode.WRITE_FAILED,
          message: `Konnte Claims nicht speichern: ${e.message}`,
          path: claimsPath,
          cause: e
        });
      }
    },

    /**
     * Holt einen spezifischen Claim
     * @param {string} taskId
     * @returns {import('../core/result.mjs').Result<import('../ports/claims-port.mjs').Claim|null>}
     */
    getClaim(taskId) {
      try {
        const claims = loadClaims();
        const claim = claims[String(taskId)];

        if (!claim) {
          return ok(null);
        }

        // Prüfen ob abgelaufen
        const claimTime = new Date(claim.timestamp).getTime();
        if (Date.now() - claimTime > expiryMs) {
          // Abgelaufenen Claim entfernen
          delete claims[String(taskId)];
          saveClaims(claims);
          return ok(null);
        }

        return ok(claim);
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Claim nicht laden: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Setzt einen Claim
     * @param {string} taskId
     * @param {import('../ports/claims-port.mjs').Claim} claim
     * @returns {import('../core/result.mjs').Result<void>}
     */
    setClaim(taskId, claim) {
      try {
        const claims = loadClaims();
        claims[String(taskId)] = claim;
        saveClaims(claims);
        return ok(undefined);
      } catch (e) {
        return err({
          code: TaskErrorCode.WRITE_FAILED,
          message: `Konnte Claim nicht setzen: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Entfernt einen Claim
     * @param {string} taskId
     * @returns {import('../core/result.mjs').Result<void>}
     */
    removeClaim(taskId) {
      try {
        const claims = loadClaims();
        delete claims[String(taskId)];
        saveClaims(claims);
        return ok(undefined);
      } catch (e) {
        return err({
          code: TaskErrorCode.WRITE_FAILED,
          message: `Konnte Claim nicht entfernen: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Entfernt abgelaufene Claims
     * @returns {import('../core/result.mjs').Result<Array<{taskId: string, owner: string}>>}
     */
    cleanupExpired() {
      try {
        const claims = loadClaims();
        const now = Date.now();
        const expired = [];

        for (const [taskId, claim] of Object.entries(claims)) {
          const claimTime = new Date(claim.timestamp).getTime();
          if (now - claimTime > expiryMs) {
            expired.push({ taskId, owner: claim.owner });
            delete claims[taskId];
          }
        }

        if (expired.length > 0) {
          saveClaims(claims);
        }

        return ok(expired);
      } catch (e) {
        return err({
          code: TaskErrorCode.WRITE_FAILED,
          message: `Konnte abgelaufene Claims nicht bereinigen: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Gibt den Pfad zur Claims-Datei zurück
     * @returns {string}
     */
    getPath() {
      return claimsPath;
    }
  };
}

/**
 * Singleton-Instanz mit Default-Pfad
 */
export const defaultClaimsAdapter = createFsClaimsAdapter();
