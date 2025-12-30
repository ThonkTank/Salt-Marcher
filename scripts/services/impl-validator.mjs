/**
 * Impl Validator Service
 *
 * Validiert Impl-Referenzen im Format `datei.funktion() [tag]`.
 * Prüft ob Datei und Funktion existieren (für [ändern] und [fertig]).
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { parseCommaSeparated } from './location-resolver.mjs';

const SRC_ROOT = 'src';

// Gültige Tags
const VALID_TAGS = ['neu', 'ändern', 'fertig'];

// ============================================================================
// SINGLE VALIDATION
// ============================================================================

/**
 * Validiert eine einzelne Impl-Referenz.
 *
 * @param {string} implString - Impl im Format `datei.funktion() [tag]`
 * @returns {import('../core/result.mjs').Result<{filePath: string, functionName: string, tag: string}, {code: string, message: string}>}
 */
export function validateImpl(implString) {
  // 1. Format parsen
  const parsed = parseImplString(implString);
  if (!parsed.ok) {
    return parsed;
  }

  const { fileName, functionName, tag } = parsed.value;

  // 2. Für [neu]: Nur Format validieren
  if (tag === 'neu') {
    return ok({
      filePath: null, // Datei muss nicht existieren
      fileName,
      functionName,
      tag,
      exists: false
    });
  }

  // 3. Für [ändern] und [fertig]: Datei und Funktion müssen existieren
  const filePath = findImplFile(fileName);
  if (!filePath) {
    return err({
      code: TaskErrorCode.FILE_NOT_FOUND,
      message: `Impl-Datei nicht gefunden: ${fileName}`,
      fileName
    });
  }

  const functionExists = checkFunctionExists(filePath, functionName);
  if (!functionExists) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Impl-Funktion nicht gefunden: '${functionName}' in ${fileName}`,
      filePath,
      functionName
    });
  }

  return ok({
    filePath,
    fileName,
    functionName,
    tag,
    exists: true
  });
}

/**
 * Validiert mehrere Impl-Referenzen (Komma-separiert).
 *
 * @param {string} implsString - Komma-separierte Impls
 * @returns {import('../core/result.mjs').Result<{impls: Array<{filePath: string|null, functionName: string, tag: string}>}, {code: string, message: string}>}
 */
export function validateImpls(implsString) {
  const implList = parseCommaSeparated(implsString);

  if (implList.length === 0) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Keine gültigen Impl-Referenzen gefunden'
    });
  }

  const validImpls = [];
  const errors = [];

  for (const impl of implList) {
    const result = validateImpl(impl);
    if (result.ok) {
      validImpls.push(result.value);
    } else {
      errors.push({ impl, error: result.error });
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.impl}: ${e.error.message}`).join('\n');
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültige Impl-Referenzen:\n${errorMessages}`,
      errors
    });
  }

  return ok({ impls: validImpls });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parst einen Impl-String im Format `datei.funktion() [tag]`.
 */
export function parseImplString(implString) {
  if (!implString || typeof implString !== 'string') {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Impl-String ist leer oder ungültig'
    });
  }

  const trimmed = implString.trim();

  // Format: datei.funktion() [tag]
  // Regex mit Unicode-Support für Umlaute im Tag
  const match = trimmed.match(/^(.+\.(?:ts|js|mjs))\.(\w+)\(\)\s*\[([a-zA-ZäöüÄÖÜß]+)\]$/);

  if (!match) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültiges Impl-Format: '${trimmed}'. Erwartet: 'datei.ts.funktion() [tag]'`
    });
  }

  const [, fileName, functionName, tag] = match;

  // Tag validieren
  if (!VALID_TAGS.includes(tag)) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültiger Tag: '[${tag}]'. Erlaubt: [${VALID_TAGS.join('], [')}]`
    });
  }

  return ok({ fileName, functionName, tag });
}

/**
 * Findet eine Impl-Datei im src-Verzeichnis.
 * Sucht rekursiv in allen Unterordnern.
 *
 * @param {string} fileName - Dateiname (z.B. "groupSeed.ts")
 * @returns {string|null} - Vollständiger Pfad oder null
 */
export function findImplFile(fileName) {
  return findFileRecursive(SRC_ROOT, fileName);
}

/**
 * Rekursive Dateisuche.
 */
function findFileRecursive(dir, fileName) {
  if (!existsSync(dir)) {
    return null;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = findFileRecursive(fullPath, fileName);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Prüft ob eine Funktion in einer Datei existiert.
 * Sucht nach verschiedenen Patterns.
 */
function checkFunctionExists(filePath, functionName) {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Patterns für Funktionen:
    // 1. export function name(
    // 2. export const name = (
    // 3. export const name = function(
    // 4. export const name = async (
    // 5. name: function(
    // 6. name(
    // 7. async name(

    const patterns = [
      new RegExp(`\\bexport\\s+function\\s+${functionName}\\s*\\(`),
      new RegExp(`\\bexport\\s+const\\s+${functionName}\\s*=`),
      new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`),
      new RegExp(`\\b${functionName}\\s*:\\s*function`),
      new RegExp(`\\b${functionName}\\s*:\\s*\\(`),
      new RegExp(`\\b${functionName}\\s*:\\s*async`),
      new RegExp(`\\basync\\s+function\\s+${functionName}\\s*\\(`),
      new RegExp(`\\b${functionName}\\s*\\(`),
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Erstellt einen Impl-Validator Service.
 *
 * @param {object} [options] - Optionen
 * @returns {object} - Service-Objekt
 */
export function createImplValidatorService(options = {}) {
  return {
    validateImpl,
    validateImpls,
    parseImplString,
    findImplFile,
    VALID_TAGS
  };
}

/**
 * Default Service-Instanz
 */
export const defaultImplValidatorService = createImplValidatorService();
