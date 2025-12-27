/**
 * Spec Validator Service
 *
 * Validiert Spec-Referenzen im Format `datei.md#abschnitt`.
 * Prüft ob Datei und Heading existieren.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { parseCommaSeparated } from './location-resolver.mjs';

const DOCS_ROOT = 'docs';

// ============================================================================
// SINGLE VALIDATION
// ============================================================================

/**
 * Validiert eine einzelne Spec-Referenz.
 *
 * @param {string} specString - Spec im Format `datei.md#abschnitt`
 * @param {string} layer - Layer für Datei-Lookup (z.B. "features")
 * @returns {import('../core/result.mjs').Result<{filePath: string, section: string}, {code: string, message: string}>}
 */
export function validateSpec(specString, layer) {
  // 1. Format parsen
  const parsed = parseSpecString(specString);
  if (!parsed.ok) {
    return parsed;
  }

  const { fileName, section } = parsed.value;

  // 2. Datei finden
  const filePath = findSpecFile(fileName, layer);
  if (!filePath) {
    return err({
      code: TaskErrorCode.FILE_NOT_FOUND,
      message: `Spec-Datei nicht gefunden: ${fileName} in Layer '${layer}'`,
      fileName,
      layer
    });
  }

  // 3. Heading prüfen
  const headingExists = checkHeadingExists(filePath, section);
  if (!headingExists) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Spec-Abschnitt nicht gefunden: '## ${section}' oder '### ${section}' in ${fileName}`,
      filePath,
      section
    });
  }

  return ok({ filePath, section });
}

/**
 * Validiert mehrere Spec-Referenzen (Komma-separiert).
 *
 * @param {string} specsString - Komma-separierte Specs
 * @param {string} layer - Layer für Datei-Lookup
 * @returns {import('../core/result.mjs').Result<{specs: Array<{filePath: string, section: string}>}, {code: string, message: string}>}
 */
export function validateSpecs(specsString, layer) {
  const specList = parseCommaSeparated(specsString);

  if (specList.length === 0) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Keine gültigen Spec-Referenzen gefunden'
    });
  }

  const validSpecs = [];
  const errors = [];

  for (const spec of specList) {
    const result = validateSpec(spec, layer);
    if (result.ok) {
      validSpecs.push(result.value);
    } else {
      errors.push({ spec, error: result.error });
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.spec}: ${e.error.message}`).join('\n');
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültige Spec-Referenzen:\n${errorMessages}`,
      errors
    });
  }

  return ok({ specs: validSpecs });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parst einen Spec-String im Format `datei.md#abschnitt`.
 */
function parseSpecString(specString) {
  if (!specString || typeof specString !== 'string') {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Spec-String ist leer oder ungültig'
    });
  }

  const trimmed = specString.trim();

  // Format: datei.md#abschnitt
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex === -1) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültiges Spec-Format: '${trimmed}'. Erwartet: 'datei.md#abschnitt'`
    });
  }

  const fileName = trimmed.substring(0, hashIndex).trim();
  const section = trimmed.substring(hashIndex + 1).trim();

  if (!fileName) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Dateiname fehlt in Spec: '${trimmed}'`
    });
  }

  if (!section) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Abschnitt fehlt in Spec: '${trimmed}'`
    });
  }

  return ok({ fileName, section });
}

/**
 * Findet eine Spec-Datei im angegebenen Layer.
 * Sucht direkt und in Unterordnern.
 */
function findSpecFile(fileName, layer) {
  const layerDir = join(DOCS_ROOT, layer);

  // 1. Direkte Datei im Layer
  const directPath = join(layerDir, fileName);
  if (existsSync(directPath)) {
    return directPath;
  }

  // 2. Datei in Unterordner (basierend auf Dateiname ohne .md)
  const baseName = fileName.replace('.md', '').toLowerCase();
  const nestedPath = join(layerDir, baseName, fileName);
  if (existsSync(nestedPath)) {
    return nestedPath;
  }

  // 3. Case-insensitive nested
  const nestedPathLower = join(layerDir, baseName, `${baseName}.md`);
  if (existsSync(nestedPathLower)) {
    return nestedPathLower;
  }

  return null;
}

/**
 * Prüft ob ein Heading in einer Markdown-Datei existiert.
 * Sucht nach ## oder ### Headings.
 */
function checkHeadingExists(filePath, section) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Normalisiere den gesuchten Abschnitt
    const normalizedSection = section.toLowerCase().trim();

    for (const line of lines) {
      // Prüfe auf ## oder ### Heading
      const match = line.match(/^#{1,3}\s+(.+)$/);
      if (match) {
        const headingText = match[1].trim().toLowerCase();
        if (headingText === normalizedSection) {
          return true;
        }
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
 * Erstellt einen Spec-Validator Service.
 *
 * @param {object} [options] - Optionen
 * @returns {object} - Service-Objekt
 */
export function createSpecValidatorService(options = {}) {
  return {
    validateSpec,
    validateSpecs,
    parseSpecString
  };
}

/**
 * Default Service-Instanz
 */
export const defaultSpecValidatorService = createSpecValidatorService();
