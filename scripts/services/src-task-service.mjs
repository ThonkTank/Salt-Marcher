/**
 * Source Task Service
 *
 * Verwaltet Task-Tabellen in Source-Dateien (src/).
 * Spiegelt die Doc-Task-Synchronisation für TypeScript/JavaScript-Dateien.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import {
  findTasksSection,
  parseSrcTaskTable,
  stripCommentPrefix
} from '../core/table/src-table-parser.mjs';
import {
  buildSrcTaskLine,
  updateSrcTaskLine,
  buildSrcTaskSection,
  SRC_TASKS_MARKER
} from '../core/table/src-table-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SRC_ROOT = join(__dirname, '..', '..', 'src');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Findet alle Source-Dateien rekursiv
 *
 * @param {string} dir - Startverzeichnis
 * @param {string[]} files - Akkumulator
 * @returns {string[]} - Array von Dateipfaden
 */
function findSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Ignoriere node_modules und versteckte Ordner
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          findSourceFiles(fullPath, files);
        }
      } else if (entry.isFile()) {
        // TypeScript und JavaScript Dateien
        if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Verzeichnis nicht lesbar - ignorieren
  }

  return files;
}

/**
 * Findet die Einfügeposition für die TASKS: Section im Header
 *
 * Reihenfolge: Ziel → Siehe → TASKS → Pipeline → DISKREPANZEN
 *
 * @param {string[]} lines - Zeilen des Files
 * @returns {number} - Zeilen-Index für Einfügung
 */
function findTasksSectionInsertPoint(lines) {
  let sieheIndex = -1;
  let diskrepanzenIndex = -1;
  let pipelineIndex = -1;
  let firstNonCommentIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Erste nicht-Kommentar-Zeile finden
    if (firstNonCommentIndex < 0 && trimmed && !trimmed.startsWith('//')) {
      firstNonCommentIndex = i;
      break;
    }

    // Siehe: Zeile finden
    if (trimmed.startsWith('// Siehe:')) {
      sieheIndex = i;
      continue;
    }

    // Pipeline-Position finden
    if (trimmed.startsWith('// Pipeline')) {
      pipelineIndex = i;
      continue;
    }

    // DISKREPANZEN finden
    if (trimmed.includes('DISKREPANZEN')) {
      diskrepanzenIndex = i;
      break;
    }
  }

  // Einfügen nach "Siehe:", aber vor Pipeline/DISKREPANZEN
  if (sieheIndex >= 0) {
    // Leere Kommentarzeile nach Siehe: überspringen
    let insertIndex = sieheIndex + 1;
    while (insertIndex < lines.length && lines[insertIndex].trim() === '//') {
      insertIndex++;
    }

    // Wenn Pipeline oder DISKREPANZEN danach kommen, davor einfügen
    if (pipelineIndex >= 0 && insertIndex >= pipelineIndex) {
      return pipelineIndex;
    }
    if (diskrepanzenIndex >= 0 && insertIndex >= diskrepanzenIndex) {
      return diskrepanzenIndex;
    }

    return insertIndex;
  }

  // Fallback: Vor DISKREPANZEN
  if (diskrepanzenIndex >= 0) {
    return diskrepanzenIndex;
  }

  // Fallback: Vor Pipeline
  if (pipelineIndex >= 0) {
    return pipelineIndex;
  }

  // Letzter Fallback: Nach dem Header-Block (erste nicht-Kommentar-Zeile)
  return firstNonCommentIndex >= 0 ? firstNonCommentIndex : 0;
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Erstellt einen Source-Task-Service
 *
 * @param {object} [options] - Optionen
 * @param {string} [options.srcRoot] - Root-Verzeichnis für Source-Dateien
 * @returns {object} - Service-Objekt
 */
export function createSrcTaskService(options = {}) {
  const srcRoot = options.srcRoot ?? DEFAULT_SRC_ROOT;

  return {
    /**
     * Findet alle Source-Dateien die eine bestimmte Task enthalten
     *
     * @param {number|string} taskId - Task-ID
     * @returns {Array<{ path: string, name: string, content: string }>}
     */
    findSourcesContainingTask(taskId) {
      const matchingFiles = [];
      const allFiles = findSourceFiles(srcRoot);
      const idStr = String(taskId);

      // Pattern: // | <id> | (am Zeilenanfang, nach Prefix)
      const pattern = new RegExp(`^//\\s*\\|\\s*${idStr}\\s*\\|`, 'm');

      for (const filePath of allFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');

          if (pattern.test(content)) {
            matchingFiles.push({
              path: filePath,
              name: basename(filePath),
              content
            });
          }
        } catch {
          // Datei nicht lesbar - überspringen
        }
      }

      return matchingFiles;
    },

    /**
     * Fügt eine Task zu einem Source-File-Header hinzu
     *
     * @param {string} filePath - Absoluter Pfad zur Source-Datei
     * @param {object} task - Task-Objekt oder fertige Task-Zeile
     * @param {object} [opts] - Optionen
     * @param {boolean} [opts.dryRun=false] - Nur simulieren
     * @returns {import('../core/result.mjs').Result<{ success: boolean, initialized: boolean }>}
     */
    addTaskToSource(filePath, task, opts = {}) {
      const { dryRun = false } = opts;

      // 1. Datei existiert?
      if (!existsSync(filePath)) {
        return err({
          code: TaskErrorCode.FILE_NOT_FOUND,
          message: `Source-Datei nicht gefunden: ${filePath}`
        });
      }

      // 2. Inhalt laden
      let content;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Source-Datei nicht lesen: ${e.message}`,
          path: filePath
        });
      }

      const lines = content.split('\n');
      let initialized = false;

      // 3. TASKS: Section finden oder erstellen
      let section = findTasksSection(lines);

      if (!section) {
        // Section erstellen
        const insertPoint = findTasksSectionInsertPoint(lines);
        const sectionLines = buildSrcTaskSection([]);

        // Leere Zeile vor der Section
        if (insertPoint > 0 && lines[insertPoint - 1]?.trim() !== '//') {
          sectionLines.unshift('//');
        }
        // Leere Zeile nach der Section
        sectionLines.push('//');

        if (!dryRun) {
          lines.splice(insertPoint, 0, ...sectionLines);
        }
        initialized = true;

        // Section neu finden nach Einfügung
        section = {
          start: insertPoint,
          headerLine: insertPoint + (sectionLines[0] === '//' ? 1 : 0),
          separatorLine: insertPoint + sectionLines.length - 2,
          end: insertPoint + sectionLines.length - 2
        };
      }

      // 4. Task-Zeile bauen
      let taskLine;
      if (typeof task === 'string') {
        // Bereits formatierte Zeile - Prefix hinzufügen
        taskLine = task.startsWith('//') ? task : `// ${task}`;
      } else {
        taskLine = buildSrcTaskLine(task);
      }

      // 5. Task-Zeile einfügen (am Ende der Section)
      const insertIndex = section.end + 1;

      if (!dryRun) {
        lines.splice(insertIndex, 0, taskLine);
        writeFileSync(filePath, lines.join('\n'));
      }

      return ok({
        success: true,
        initialized,
        path: filePath,
        insertIndex
      });
    },

    /**
     * Aktualisiert eine Task in einem Source-File
     *
     * @param {string} filePath - Absoluter Pfad zur Source-Datei
     * @param {number|string} taskId - Task-ID
     * @param {object} updates - Updates { status, beschreibung, ... }
     * @param {object} [opts] - Optionen
     * @param {boolean} [opts.dryRun=false] - Nur simulieren
     * @returns {import('../core/result.mjs').Result<{ modified: boolean, before: string, after: string }>}
     */
    updateTaskInSource(filePath, taskId, updates, opts = {}) {
      const { dryRun = false } = opts;
      const idStr = String(taskId);

      // 1. Inhalt laden
      let content;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Source-Datei nicht lesen: ${e.message}`,
          path: filePath
        });
      }

      const lines = content.split('\n');
      const pattern = new RegExp(`^//\\s*\\|\\s*${idStr}\\s*\\|`);

      let modified = false;
      let beforeLine = null;
      let afterLine = null;

      // 2. Task-Zeile finden und aktualisieren
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (pattern.test(line)) {
          beforeLine = line;
          afterLine = updateSrcTaskLine(line, updates);

          if (afterLine !== beforeLine) {
            modified = true;
            if (!dryRun) {
              lines[i] = afterLine;
            }
          }
          break;
        }
      }

      // 3. Speichern
      if (modified && !dryRun) {
        writeFileSync(filePath, lines.join('\n'));
      }

      return ok({
        modified,
        before: beforeLine,
        after: afterLine,
        file: basename(filePath),
        path: filePath
      });
    },

    /**
     * Entfernt eine Task aus einem Source-File
     *
     * @param {string} filePath - Absoluter Pfad zur Source-Datei
     * @param {number|string} taskId - Task-ID
     * @param {object} [opts] - Optionen
     * @param {boolean} [opts.dryRun=false] - Nur simulieren
     * @returns {import('../core/result.mjs').Result<{ deleted: boolean }>}
     */
    removeTaskFromSource(filePath, taskId, opts = {}) {
      const { dryRun = false } = opts;
      const idStr = String(taskId);

      // 1. Inhalt laden
      let content;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Source-Datei nicht lesen: ${e.message}`,
          path: filePath
        });
      }

      const lines = content.split('\n');
      const pattern = new RegExp(`^//\\s*\\|\\s*${idStr}\\s*\\|`);

      let deleted = false;

      // 2. Task-Zeile finden und entfernen
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];

        if (pattern.test(line)) {
          if (!dryRun) {
            lines.splice(i, 1);
          }
          deleted = true;
        }
      }

      // 3. Leere TASKS: Section entfernen
      if (deleted && !dryRun) {
        const section = findTasksSection(lines);

        // Prüfen ob Section leer ist (nur Header + Separator)
        if (section && section.end === section.separatorLine) {
          // Section entfernen (inkl. umgebende Leerzeilen)
          let removeStart = section.start;
          let removeEnd = section.separatorLine;

          // Leere Zeile davor?
          if (removeStart > 0 && lines[removeStart - 1]?.trim() === '//') {
            removeStart--;
          }
          // Leere Zeile danach?
          if (removeEnd < lines.length - 1 && lines[removeEnd + 1]?.trim() === '//') {
            removeEnd++;
          }

          lines.splice(removeStart, removeEnd - removeStart + 1);
        }

        writeFileSync(filePath, lines.join('\n'));
      } else if (deleted && !dryRun) {
        writeFileSync(filePath, lines.join('\n'));
      }

      return ok({
        deleted,
        file: basename(filePath),
        path: filePath
      });
    },

    /**
     * Gibt das Root-Verzeichnis zurück
     */
    getSrcRoot() {
      return srcRoot;
    }
  };
}

/**
 * Singleton-Instanz mit Default-Pfaden
 */
export const defaultSrcTaskService = createSrcTaskService();
