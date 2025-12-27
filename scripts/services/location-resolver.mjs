/**
 * Location Resolver Service
 *
 * Löst Domain+Layer zu Dokumentenpfaden auf.
 * Unterstützt Multi-Domain und Multi-Layer Kombinationen.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';

const DOCS_ROOT = 'docs';

// ============================================================================
// SINGLE LOOKUP
// ============================================================================

/**
 * Löst eine einzelne Domain+Layer Kombination zu einem Dokumentenpfad auf.
 *
 * @param {string} domain - Domain-Name (z.B. "Travel", "Encounter")
 * @param {string} layer - Layer-Name (z.B. "features", "domain", "application")
 * @returns {import('../core/result.mjs').Result<{docPath: string}, {code: string, message: string}>}
 */
export function resolveStorageLocation(domain, layer) {
  const layerDir = join(DOCS_ROOT, layer);

  // 1. Layer-Verzeichnis prüfen
  if (!existsSync(layerDir)) {
    const availableLayers = listLayers();
    return err({
      code: TaskErrorCode.FILE_NOT_FOUND,
      message: `Layer-Verzeichnis nicht gefunden: ${layerDir}`,
      suggestions: availableLayers
    });
  }

  // 2. Layer-spezifische Lookup-Strategie
  const lookupResult = lookupByLayer(domain, layer, layerDir);

  if (lookupResult.ok) {
    return lookupResult;
  }

  // 3. Nicht gefunden - hilfreiche Fehlermeldung
  const available = listAvailableFiles(layerDir);
  return err({
    code: TaskErrorCode.FILE_NOT_FOUND,
    message: `Keine Datei für Domain '${domain}' in Layer '${layer}' gefunden`,
    suggestions: available,
    triedPaths: lookupResult.error.triedPaths
  });
}

/**
 * Layer-spezifische Lookup-Logik
 */
function lookupByLayer(domain, layer, layerDir) {
  const triedPaths = [];

  switch (layer) {
    case 'features': {
      // Features: {Domain}.md direkt oder {domain}/{Domain}.md in Unterordner
      const domainLower = domain.toLowerCase();

      // 1. Direkte Datei: {Domain}.md
      const directFile = join(layerDir, `${domain}.md`);
      triedPaths.push(directFile);
      if (existsSync(directFile)) {
        return ok({ docPath: directFile });
      }

      // 2. Unterordner-Variante: {domain}/{Domain}.md
      const nestedFile = join(layerDir, domainLower, `${domain}.md`);
      triedPaths.push(nestedFile);
      if (existsSync(nestedFile)) {
        return ok({ docPath: nestedFile });
      }

      // 3. Case-insensitive nested lookup: {domain}/{domain}.md
      const nestedFileLower = join(layerDir, domainLower, `${domainLower}.md`);
      if (nestedFileLower !== nestedFile) {
        triedPaths.push(nestedFileLower);
        if (existsSync(nestedFileLower)) {
          return ok({ docPath: nestedFileLower });
        }
      }

      break;
    }

    case 'domain':
    case 'architecture':
    case 'application': {
      // Einfaches Muster: {Domain}.md
      const directFile = join(layerDir, `${domain}.md`);
      triedPaths.push(directFile);
      if (existsSync(directFile)) {
        return ok({ docPath: directFile });
      }

      // Case-insensitive Fallback
      const lowerFile = join(layerDir, `${domain.toLowerCase()}.md`);
      if (lowerFile !== directFile) {
        triedPaths.push(lowerFile);
        if (existsSync(lowerFile)) {
          return ok({ docPath: lowerFile });
        }
      }

      // PascalCase Fallback
      const pascalFile = join(layerDir, `${capitalize(domain)}.md`);
      if (pascalFile !== directFile && pascalFile !== lowerFile) {
        triedPaths.push(pascalFile);
        if (existsSync(pascalFile)) {
          return ok({ docPath: pascalFile });
        }
      }

      break;
    }

    case 'prototypes': {
      // Prototypes: lowercase {domain}.md
      const protoFile = join(layerDir, `${domain.toLowerCase()}.md`);
      triedPaths.push(protoFile);
      if (existsSync(protoFile)) {
        return ok({ docPath: protoFile });
      }
      break;
    }

    case 'data': {
      // Data-Schemas: lowercase {domain}.md
      const dataFile = join(layerDir, `${domain.toLowerCase()}.md`);
      triedPaths.push(dataFile);
      if (existsSync(dataFile)) {
        return ok({ docPath: dataFile });
      }
      break;
    }

    default: {
      // Generischer Fallback
      const directFile = join(layerDir, `${domain}.md`);
      triedPaths.push(directFile);
      if (existsSync(directFile)) {
        return ok({ docPath: directFile });
      }
    }
  }

  return err({ triedPaths });
}

// ============================================================================
// MULTI LOOKUP
// ============================================================================

/**
 * Löst mehrere Domain+Layer Kombinationen auf.
 * Mindestens ein Match pro Layer ist erforderlich.
 *
 * @param {string[]} domains - Array von Domain-Namen
 * @param {string[]} layers - Array von Layer-Namen
 * @returns {import('../core/result.mjs').Result<{docs: string[], docsPerLayer: Map<string, string[]>}, {code: string, message: string}>}
 */
export function resolveMultiLocations(domains, layers) {
  const docsPerLayer = new Map();
  const missingLayers = [];

  for (const layer of layers) {
    const layerDocs = [];

    for (const domain of domains) {
      const result = resolveStorageLocation(domain, layer);
      if (result.ok) {
        layerDocs.push(result.value.docPath);
      }
    }

    if (layerDocs.length === 0) {
      missingLayers.push(layer);
    } else {
      docsPerLayer.set(layer, layerDocs);
    }
  }

  // Fehler wenn irgendein Layer keinen Match hat
  if (missingLayers.length > 0) {
    return err({
      code: TaskErrorCode.FILE_NOT_FOUND,
      message: `Kein Match für Layer '${missingLayers.join("', '")}' mit Domains ['${domains.join("', '")}']`,
      missingLayers,
      docsPerLayer: Object.fromEntries(docsPerLayer)
    });
  }

  // Alle Docs sammeln (dedupliziert)
  const allDocs = [...new Set([...docsPerLayer.values()].flat())];

  return ok({
    docs: allDocs,
    docsPerLayer
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Listet alle verfügbaren Dateien in einem Layer-Verzeichnis.
 * Für hilfreiche Fehlermeldungen.
 *
 * @param {string} layerDir - Pfad zum Layer-Verzeichnis
 * @returns {string[]} - Liste von verfügbaren Dateinamen/Ordnern
 */
export function listAvailableFiles(layerDir) {
  if (!existsSync(layerDir)) {
    return [];
  }

  const files = [];

  try {
    const entries = readdirSync(layerDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        // Direkte Markdown-Datei
        files.push(entry.name.replace('.md', ''));
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Prüfe auf {dir}/{dir}.md Muster
        const nestedPath = join(layerDir, entry.name, `${entry.name}.md`);
        if (existsSync(nestedPath)) {
          files.push(`${entry.name}/`);
        }
        // Auch PascalCase prüfen
        const pascalName = capitalize(entry.name);
        const nestedPascal = join(layerDir, entry.name, `${pascalName}.md`);
        if (nestedPascal !== nestedPath && existsSync(nestedPascal)) {
          if (!files.includes(`${entry.name}/`)) {
            files.push(`${entry.name}/`);
          }
        }
      }
    }
  } catch {
    // Fehler ignorieren, leere Liste zurückgeben
  }

  return files.sort();
}

/**
 * Listet alle verfügbaren Layer-Verzeichnisse.
 *
 * @returns {string[]} - Liste von Layer-Namen
 */
export function listLayers() {
  if (!existsSync(DOCS_ROOT)) {
    return [];
  }

  try {
    const entries = readdirSync(DOCS_ROOT, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Parst einen Komma-separierten String in ein Array.
 * Trimmt Whitespace von jedem Eintrag.
 *
 * @param {string} input - Komma-separierter String
 * @returns {string[]} - Array von getrimmten Strings
 */
export function parseCommaSeparated(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  return input
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Kapitalisiert den ersten Buchstaben.
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Erstellt einen Location-Resolver Service.
 *
 * @param {object} [options] - Optionen
 * @param {string} [options.docsRoot] - Alternatives Docs-Verzeichnis
 * @returns {object} - Service-Objekt
 */
export function createLocationResolverService(options = {}) {
  return {
    resolveStorageLocation,
    resolveMultiLocations,
    listAvailableFiles,
    listLayers,
    parseCommaSeparated
  };
}

/**
 * Default Service-Instanz
 */
export const defaultLocationResolverService = createLocationResolverService();
