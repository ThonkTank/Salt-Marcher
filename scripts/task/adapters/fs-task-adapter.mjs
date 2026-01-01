// Ziel: Dateisystem-Zugriff für Roadmap, Claims und Pfad-Auflösung
// Siehe: docs/tools/taskTool.md#pfad-auflösung
//
// Funktionen:
// - readRoadmap() - Development-Roadmap.md lesen
// - writeRoadmap(content) - Development-Roadmap.md schreiben
// - readClaims() - .task-claims.json lesen
// - writeClaims(claims) - .task-claims.json schreiben
// - resolveSpecPath(specRef) - Spec-Referenz zu absolutem Pfad
// - resolveImplPath(implRef) - Impl-Referenz zu absolutem Pfad (mit Glob-Suche)
// - functionExists(filePath, functionName) - Funktion in Datei prüfen

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, err } from '../core/result.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const ROADMAP_PATH = join(PROJECT_ROOT, 'docs', 'architecture', 'Development-Roadmap.md');
const CLAIMS_PATH = join(PROJECT_ROOT, 'docs', 'architecture', '.task-claims.json');
const DOCS_PATH = join(PROJECT_ROOT, 'docs');
const SRC_PATH = join(PROJECT_ROOT, 'src');

/**
 * Liest die Development-Roadmap.md.
 * @returns {Promise<import('../core/result.mjs').Result<string, {code: string}>>}
 */
export async function readRoadmap() {
  try {
    const content = await readFile(ROADMAP_PATH, 'utf-8');
    return ok(content);
  } catch (error) {
    return err({ code: 'READ_FAILED', path: ROADMAP_PATH, error: error.message });
  }
}

/**
 * Schreibt die Development-Roadmap.md.
 * @param {string} content
 * @returns {Promise<import('../core/result.mjs').Result<void, {code: string}>>}
 */
export async function writeRoadmap(content) {
  try {
    await writeFile(ROADMAP_PATH, content, 'utf-8');
    return ok(undefined);
  } catch (error) {
    return err({ code: 'WRITE_FAILED', path: ROADMAP_PATH, error: error.message });
  }
}

/**
 * Liest die .task-claims.json.
 * @returns {Promise<ClaimsData>}
 */
export async function readClaims() {
  try {
    const content = await readFile(CLAIMS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Datei existiert nicht oder ist leer -> leere Claims
    return { claims: {}, keys: {} };
  }
}

/**
 * Schreibt die .task-claims.json.
 * @param {ClaimsData} claims
 * @returns {Promise<void>}
 */
export async function writeClaims(claims) {
  await writeFile(CLAIMS_PATH, JSON.stringify(claims, null, 2), 'utf-8');
}

/**
 * Löst Spec-Referenz zu absolutem Pfad auf.
 * @param {string} specRef - z.B. 'Culture-Resolution.md#section' oder 'services/encounter/groupActivity.md#section'
 * @returns {Promise<import('../core/result.mjs').Result<string, {code: string}>>}
 */
export async function resolveSpecPath(specRef) {
  // Anchor entfernen
  const pathOnly = specRef.split('#')[0];

  // Erst direkten Pfad versuchen (für vollständige Pfade wie 'services/encounter/groupActivity.md')
  const directPath = join(DOCS_PATH, pathOnly);
  if (existsSync(directPath)) {
    return ok(directPath);
  }

  // Sonst rekursive Suche nach Dateiname
  const filename = pathOnly.split('/').pop();
  const matches = await findFiles(DOCS_PATH, filename);

  if (matches.length === 0) {
    return err({ code: 'FILE_NOT_FOUND', filename, searchPath: DOCS_PATH });
  }

  if (matches.length > 1) {
    return err({ code: 'AMBIGUOUS_FILE', filename, matches });
  }

  return ok(matches[0]);
}

/**
 * Löst Impl-Referenz zu absolutem Pfad auf.
 * Unterstützt beide Formate:
 * - Einfach: 'groupActivity.ts.selectActivity() [ändern]'
 * - Vollständig: 'types/entities/creature.ts.someFunc() [ändern]'
 * @param {string} implRef
 * @returns {Promise<import('../core/result.mjs').Result<{path: string, functionName: string | null, tag: string | null}, {code: string}>>}
 */
export async function resolveImplPath(implRef) {
  // Tag extrahieren ([neu], [ändern], [fertig])
  const tagMatch = implRef.match(/\[(neu|ändern|fertig)\]$/);
  const tag = tagMatch ? `[${tagMatch[1]}]` : null;
  const refWithoutTag = implRef.replace(/\s*\[(neu|ändern|fertig)\]$/, '').trim();

  // Format: "path/to/filename.ts.functionName()" oder "path/to/filename.ts" oder "filename.ts"
  const match = refWithoutTag.match(/^(.+\.ts)(?:\.(\w+)\(\))?$/);
  if (!match) {
    return err({ code: 'INVALID_IMPL_FORMAT', impl: implRef });
  }

  const [, filePath, functionName] = match;
  const filename = filePath.split('/').pop(); // Nur Dateiname für Suche

  // Bei [neu] Tag: Pfad aus Referenz ableiten (Datei existiert noch nicht)
  if (tag === '[neu]') {
    const targetPath = join(SRC_PATH, filePath);
    return ok({ path: targetPath, functionName: functionName || null, tag });
  }

  // 1. Erst direkten Pfad versuchen (für vollständige Pfade wie 'types/entities/creature.ts')
  const directPath = join(SRC_PATH, filePath);
  if (existsSync(directPath)) {
    return ok({ path: directPath, functionName: functionName || null, tag });
  }

  // 2. Rekursive Suche in src/ (für einfache Dateinamen wie 'groupActivity.ts')
  const matches = await findFiles(SRC_PATH, filename);

  if (matches.length === 0) {
    return err({ code: 'FILE_NOT_FOUND', filename: filePath, searchPath: SRC_PATH });
  }

  if (matches.length > 1) {
    return err({ code: 'AMBIGUOUS_FILE', filename, matches });
  }

  return ok({ path: matches[0], functionName: functionName || null, tag });
}

/**
 * Sucht rekursiv nach Dateien mit bestimmtem Namen.
 * @param {string} dir - Startverzeichnis
 * @param {string} filename - Gesuchter Dateiname
 * @returns {Promise<string[]>} - Gefundene absolute Pfade
 */
async function findFiles(dir, filename) {
  const { readdir } = await import('node:fs/promises');
  const results = [];

  async function search(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await search(fullPath);
      } else if (entry.name === filename) {
        results.push(fullPath);
      }
    }
  }

  try {
    await search(dir);
  } catch {
    // Verzeichnis existiert nicht oder keine Berechtigung
  }

  return results;
}

/**
 * Prüft ob eine Funktion in einer Datei existiert.
 * @param {string} filePath - Absoluter Pfad zur Datei
 * @param {string} functionName - Funktionsname
 * @returns {Promise<boolean>}
 */
export async function functionExists(filePath, functionName) {
  try {
    const content = await readFile(filePath, 'utf-8');

    // Regex-Patterns für Funktionsdefinitionen
    const patterns = [
      new RegExp(`export\\s+function\\s+${functionName}\\s*\\(`),
      new RegExp(`export\\s+const\\s+${functionName}\\s*=`),
      new RegExp(`export\\s+async\\s+function\\s+${functionName}\\s*\\(`),
      new RegExp(`function\\s+${functionName}\\s*\\(`),
      new RegExp(`const\\s+${functionName}\\s*=`),
      new RegExp(`async\\s+function\\s+${functionName}\\s*\\(`),
    ];

    return patterns.some(pattern => pattern.test(content));
  } catch {
    return false;
  }
}

/**
 * @typedef {Object} ClaimsData
 * @property {Object.<string, ClaimEntry>} claims
 * @property {Object.<string, string>} keys
 */

/**
 * @typedef {Object} ClaimEntry
 * @property {string} key
 * @property {number} timestamp
 * @property {string} previousStatus
 */

export { PROJECT_ROOT, DOCS_PATH, SRC_PATH };
