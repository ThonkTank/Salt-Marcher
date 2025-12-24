/**
 * Filesystem Task Adapter
 *
 * Implementiert den TaskPort mit automatischer Synchronisation.
 * Jede Änderung an einer Task wird automatisch in ALLEN Instanzen
 * (Roadmap + Feature-Docs) durchgeführt.
 *
 * Services müssen keine Lines oder Indices mehr kennen.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename, relative } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { parseRoadmap, detectDocTableFormat, formatDeps } from '../core/table/parser.mjs';
import { buildDocTaskLine, updateDocTaskLine, updateTaskLine, buildTaskLine, buildBugLine, buildEmptyTaskTable } from '../core/table/builder.mjs';
import { TaskStatus } from '../core/table/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROADMAP_PATH = join(__dirname, '..', '..', 'docs', 'architecture', 'Development-Roadmap.md');
const DEFAULT_DOCS_PATH = join(__dirname, '..', '..', 'docs');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Findet alle Markdown-Dateien rekursiv in einem Verzeichnis
 */
function findMarkdownFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findMarkdownFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Erkennt das Format einer Doc-Datei anhand des Headers
 */
function detectDocFormat(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('| # |') && line.includes('Beschreibung')) {
      return detectDocTableFormat(line);
    }
  }
  return null;
}

/**
 * Prüft ob ein Doc bereits eine Task-Tabelle enthält
 *
 * @param {string} content - Der Inhalt der Datei
 * @returns {boolean} - true wenn Tabelle vorhanden
 */
function docHasTable(content) {
  const lines = content.split('\n');
  // Suche nach Task-Tabellen-Header (| # | ...)
  return lines.some(line =>
    line.includes('| # |') && line.includes('Beschreibung')
  );
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Erstellt einen Filesystem-basierten Task-Adapter
 *
 * @param {object} [options] - Optionen
 * @param {string} [options.roadmapPath] - Pfad zur Roadmap-Datei
 * @param {string} [options.docsPath] - Pfad zum docs-Verzeichnis
 * @returns {import('../ports/task-port.mjs').TaskPort}
 */
export function createFsTaskAdapter(options = {}) {
  const roadmapPath = options.roadmapPath ?? DEFAULT_ROADMAP_PATH;
  const docsPath = options.docsPath ?? DEFAULT_DOCS_PATH;

  // ============================================================================
  // Internal: Doc Operations
  // ============================================================================

  /**
   * Findet alle Docs die eine bestimmte Task enthalten
   */
  function findDocsContainingTask(taskId) {
    const matchingDocs = [];
    const allDocs = findMarkdownFiles(docsPath);
    const idStr = String(taskId);

    for (const filePath of allDocs) {
      if (filePath.endsWith('Development-Roadmap.md')) continue;

      try {
        const content = readFileSync(filePath, 'utf-8');
        const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`, 'm');

        if (pattern.test(content)) {
          matchingDocs.push({
            path: filePath,
            name: basename(filePath),
            content
          });
        }
      } catch {
        // Datei nicht lesbar - überspringen
      }
    }

    return matchingDocs;
  }

  /**
   * Synchronisiert eine Task-Änderung in einem einzelnen Doc
   */
  function syncDocFile(doc, taskId, updates, dryRun) {
    const lines = doc.content.split('\n');
    const format = detectDocFormat(doc.content);
    const idStr = String(taskId);
    let modified = false;
    let beforeLine = null;
    let afterLine = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

      if (pattern.test(line)) {
        beforeLine = line;
        afterLine = updateDocTaskLine(line, updates, format);

        if (afterLine !== beforeLine) {
          modified = true;
          if (!dryRun) {
            lines[i] = afterLine;
          }
        }
        break;
      }
    }

    if (modified && !dryRun) {
      writeFileSync(doc.path, lines.join('\n'));
    }

    return {
      file: doc.name,
      path: doc.path,
      modified,
      before: beforeLine,
      after: afterLine
    };
  }

  /**
   * Löscht eine Task aus einem einzelnen Doc
   */
  function deleteFromDoc(doc, taskId, dryRun) {
    const docLines = doc.content.split('\n');
    const idStr = String(taskId);
    let deleted = false;

    for (let i = docLines.length - 1; i >= 0; i--) {
      const line = docLines[i];
      const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

      if (pattern.test(line)) {
        if (!dryRun) {
          docLines.splice(i, 1);
        }
        deleted = true;
      }
    }

    if (deleted && !dryRun) {
      writeFileSync(doc.path, docLines.join('\n'));
    }

    return { file: doc.name, path: doc.path, deleted };
  }

  /**
   * Splittet eine Task in einem einzelnen Doc
   */
  function splitInDoc(doc, taskId, splitData, dryRun) {
    const { idA, idB, descA, descB, task } = splitData;
    const docLines = doc.content.split('\n');
    const format = detectDocFormat(doc.content);
    const idStr = String(taskId);
    let modified = false;

    for (let i = 0; i < docLines.length; i++) {
      const line = docLines[i];
      const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

      if (pattern.test(line)) {
        let docLineA, docLineB;

        if (format?.isNewFormat) {
          const docCells = line.split('|');
          const refs = docCells[9]?.trim() || '-';
          const imp = docCells[10]?.trim() || '-';

          docLineA = buildDocTaskLine({
            number: idA,
            status: TaskStatus.DONE,
            domain: task.domain,
            layer: task.layer || '-',
            beschreibung: descA,
            prio: task.prio,
            mvp: task.mvp,
            depsRaw: task.depsRaw,
            spec: refs,
            imp
          });

          docLineB = buildDocTaskLine({
            number: idB,
            status: TaskStatus.OPEN,
            domain: task.domain,
            layer: task.layer || '-',
            beschreibung: descB,
            prio: task.prio,
            mvp: task.mvp,
            depsRaw: `#${idA}`,
            spec: refs,
            imp: '-'
          });
        } else {
          const docCells = line.split('|');
          const refs = docCells[6] || '';

          docLineA = ['', ` ${idA} `, ` ${descA} `, docCells[3], docCells[4], docCells[5], refs, ''].join('|');
          docLineB = ['', ` ${idB} `, ` ${descB} `, docCells[3], docCells[4], ` #${idA} `, refs, ''].join('|');
        }

        if (!dryRun) {
          docLines.splice(i, 1, docLineA, docLineB);
          writeFileSync(doc.path, docLines.join('\n'));
        }
        modified = true;
        break;
      }
    }

    return { file: doc.name, path: doc.path, modified };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    /**
     * Lädt und parst die Roadmap
     */
    load() {
      try {
        const content = readFileSync(roadmapPath, 'utf-8');

        const parseResult = parseRoadmap(content, {
          separateBugs: true,
          includeLineIndex: true,
          includeOriginalLine: true,
          returnLines: true,
          returnItemMap: true
        });

        if (!parseResult.ok) {
          return parseResult;
        }

        return ok(parseResult.value);
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Roadmap nicht lesen: ${e.message}`,
          path: roadmapPath,
          cause: e
        });
      }
    },

    /**
     * Aktualisiert eine Task in Roadmap UND allen Docs
     *
     * Der Adapter:
     * 1. Lädt die Roadmap
     * 2. Findet die Task anhand der ID
     * 3. Aktualisiert die Roadmap-Zeile
     * 4. Speichert die Roadmap
     * 5. Findet alle Docs mit dieser Task
     * 6. Synchronisiert die Änderung in alle Docs
     */
    updateTask(taskId, updates, opts = {}) {
      const { dryRun = false } = opts;

      // 1. Roadmap laden
      const loadResult = this.load();
      if (!loadResult.ok) return loadResult;

      const { lines, itemMap } = loadResult.value;
      const task = itemMap.get(taskId);

      if (!task) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Task ${taskId} nicht gefunden`
        });
      }

      // 2. Task in Roadmap aktualisieren
      const beforeLine = task.originalLine;
      const afterLine = updateTaskLine(beforeLine, updates);
      const roadmapModified = afterLine !== beforeLine;

      if (roadmapModified) {
        lines[task.lineIndex] = afterLine;
      }

      // 3. Roadmap speichern
      if (roadmapModified && !dryRun) {
        writeFileSync(roadmapPath, lines.join('\n'));
      }

      // 4. Alle Docs synchronisieren (nur für nicht-Bugs)
      const docResults = [];
      if (!task.isBug) {
        // Aktuelle Werte aus der Task holen, Updates überschreiben
        const docUpdates = {
          status: updates.status ?? task.status,
          domain: updates.domain ?? task.domain,
          layer: updates.layer ?? task.layer,
          beschreibung: updates.beschreibung ?? task.beschreibung,
          prio: updates.prio ?? task.prio,
          mvp: updates.mvp ?? task.mvp,
          deps: updates.deps ?? task.depsRaw,
          imp: updates.imp ?? task.imp
        };

        // Spec-Feld übernehmen
        if (updates.spec) {
          docUpdates.spec = updates.spec;
        }

        const docs = findDocsContainingTask(taskId);
        for (const doc of docs) {
          const result = syncDocFile(doc, taskId, docUpdates, dryRun);
          if (result.modified) {
            docResults.push(result);
          }
        }
      }

      return ok({
        success: true,
        roadmap: {
          modified: roadmapModified,
          before: beforeLine,
          after: afterLine
        },
        docs: docResults
      });
    },

    /**
     * Löscht eine Task aus Roadmap UND allen Docs
     */
    deleteTask(taskId, opts = {}) {
      const { dryRun = false } = opts;

      // 1. Roadmap laden
      const loadResult = this.load();
      if (!loadResult.ok) return loadResult;

      const { lines, itemMap } = loadResult.value;
      const task = itemMap.get(taskId);

      if (!task) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Task ${taskId} nicht gefunden`
        });
      }

      // 2. Aus Roadmap löschen
      const deletedLine = lines[task.lineIndex];
      if (!dryRun) {
        lines.splice(task.lineIndex, 1);
        writeFileSync(roadmapPath, lines.join('\n'));
      }

      // 3. Aus allen Docs löschen
      const docResults = [];
      if (!task.isBug) {
        const docs = findDocsContainingTask(taskId);
        for (const doc of docs) {
          const result = deleteFromDoc(doc, taskId, dryRun);
          if (result.deleted) {
            docResults.push(result);
          }
        }
      }

      return ok({
        success: true,
        roadmap: { deleted: true, line: deletedLine },
        docs: docResults
      });
    },

    /**
     * Splittet eine Task in zwei Teile in Roadmap UND allen Docs
     */
    splitTask(taskId, splitData, opts = {}) {
      const { dryRun = false, descA, descB } = { ...opts, ...splitData };

      // 1. Roadmap laden
      const loadResult = this.load();
      if (!loadResult.ok) return loadResult;

      const { lines, tasks, itemMap } = loadResult.value;
      const task = itemMap.get(taskId);

      if (!task) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Task ${taskId} nicht gefunden`
        });
      }

      // 2. Neue IDs generieren
      const maxId = Math.max(...tasks.filter(t => typeof t.number === 'number').map(t => t.number));
      const idA = taskId;
      const idB = maxId + 1;

      // 3. Neue Zeilen für Roadmap erstellen
      const lineA = buildTaskLine({
        number: idA,
        status: TaskStatus.DONE,
        domain: task.domain,
        layer: task.layer || '-',
        beschreibung: descA,
        prio: task.prio,
        mvp: task.mvp,
        deps: task.deps,
        spec: task.spec,
        imp: task.imp
      });

      const lineB = buildTaskLine({
        number: idB,
        status: TaskStatus.OPEN,
        domain: task.domain,
        layer: task.layer || '-',
        beschreibung: descB,
        prio: task.prio,
        mvp: task.mvp,
        deps: [idA],
        spec: task.spec,
        imp: '-'
      });

      // 4. Roadmap aktualisieren
      if (!dryRun) {
        lines.splice(task.lineIndex, 1, lineA, lineB);
        writeFileSync(roadmapPath, lines.join('\n'));
      }

      // 5. Docs synchronisieren
      const docResults = [];
      if (!task.isBug) {
        const docs = findDocsContainingTask(taskId);
        const fullSplitData = { idA, idB, descA, descB, task };
        for (const doc of docs) {
          const result = splitInDoc(doc, taskId, fullSplitData, dryRun);
          if (result.modified) {
            docResults.push(result);
          }
        }
      }

      return ok({
        success: true,
        newIds: { a: idA, b: idB },
        roadmap: { modified: true, originalLine: task.originalLine, newLines: [lineA, lineB] },
        docs: docResults
      });
    },

    /**
     * Fügt eine neue Task zur Roadmap hinzu
     * Wenn doc angegeben, wird die Task auch in das Doc eingefügt
     */
    addTask(taskData, opts = {}) {
      const { dryRun = false, doc = null, init = false } = opts;
      const { domain, layer = '-', beschreibung, prio = 'mittel', mvp = 'Nein', deps = [], spec = '-', isBug = false } = taskData;

      // 1. Roadmap laden
      const loadResult = this.load();
      if (!loadResult.ok) return loadResult;

      const { lines, tasks, bugs } = loadResult.value;

      // 2. Neue ID generieren
      let newId;
      let newLine;

      if (isBug) {
        const maxBugId = bugs.length > 0
          ? Math.max(...bugs.map(b => parseInt(String(b.number).replace('b', ''), 10)))
          : 0;
        newId = `b${maxBugId + 1}`;

        newLine = buildBugLine({
          number: newId,
          status: TaskStatus.OPEN,
          beschreibung,
          prio,
          deps
        });
      } else {
        const maxId = tasks.length > 0
          ? Math.max(...tasks.filter(t => typeof t.number === 'number').map(t => t.number))
          : 0;
        newId = maxId + 1;

        newLine = buildTaskLine({
          number: newId,
          status: TaskStatus.OPEN,
          domain: domain || '-',
          layer: layer || '-',
          beschreibung,
          prio,
          mvp,
          deps,
          spec,
          imp: '-'
        });
      }

      // 3. Einfügeposition finden (am Ende der jeweiligen Tabelle)
      let insertIndex = -1;

      if (isBug) {
        // Bug-Tabelle finden (nach "## Bugs")
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].match(/^\|\s*b\d+\s*\|/)) {
            insertIndex = i + 1;
            break;
          }
        }
      } else {
        // Task-Tabelle finden (nach "## Tasks" aber vor "## Bugs")
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^\|\s*\d+\s*\|/) && !lines[i].match(/^\|\s*b\d+\s*\|/)) {
            insertIndex = i + 1;
          }
          if (lines[i].includes('## Bugs')) {
            break;
          }
        }
      }

      // 4. Neue Zeile einfügen
      if (insertIndex > 0 && !dryRun) {
        lines.splice(insertIndex, 0, newLine);
        writeFileSync(roadmapPath, lines.join('\n'));
      }

      // 5. Auch in Doc einfügen (wenn angegeben, nur für Tasks)
      let docResult = null;
      if (doc && !isBug) {
        docResult = this.addTaskToDoc(doc, newLine, { init, dryRun });
        if (!docResult.ok) {
          // Rollback: Task aus Roadmap entfernen
          if (!dryRun && insertIndex > 0) {
            lines.splice(insertIndex, 1);
            writeFileSync(roadmapPath, lines.join('\n'));
          }
          return docResult;
        }
      }

      return ok({
        success: true,
        newId,
        isBug,
        line: newLine,
        doc: docResult?.ok ? { path: doc, initialized: docResult.value.initialized } : null
      });
    },

    /**
     * Fügt eine Task-Zeile zu einem spezifischen Doc hinzu
     *
     * @param {string} docRelPath - Relativer Pfad ab docs/, z.B. "features/Travel-System.md"
     * @param {string} taskLine - Die fertige Task-Zeile
     * @param {object} [opts] - Optionen
     * @param {boolean} [opts.init=false] - Tabelle erstellen falls nicht vorhanden
     * @param {boolean} [opts.dryRun=false] - Vorschau ohne Speichern
     * @returns {import('../core/result.mjs').Result<{success: boolean, initialized: boolean}>}
     */
    addTaskToDoc(docRelPath, taskLine, opts = {}) {
      const { init = false, dryRun = false } = opts;
      const fullPath = join(docsPath, docRelPath);

      // 1. Prüfen ob Doc existiert
      if (!existsSync(fullPath)) {
        return err({
          code: TaskErrorCode.FILE_NOT_FOUND,
          message: `Doc nicht gefunden: ${docRelPath}`
        });
      }

      // 2. Inhalt laden
      let content;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Doc nicht lesen: ${e.message}`,
          path: fullPath,
          cause: e
        });
      }

      // 3. Prüfen ob Tabelle existiert
      const hasTable = docHasTable(content);
      let initialized = false;

      if (!hasTable && !init) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: `Doc hat keine Task-Tabelle. Nutze --init um eine zu erstellen.`
        });
      }

      // 4. Tabelle initialisieren falls nötig
      let lines = content.split('\n');

      if (!hasTable && init) {
        // Tabelle am Ende des Docs anhängen
        const tableBlock = buildEmptyTaskTable();
        lines.push(...tableBlock.split('\n'));
        initialized = true;
      }

      // 5. Task-Zeile einfügen (am Ende der Tabelle)
      // Finde die letzte Zeile der Tabelle (letzte Zeile die mit | beginnt)
      let insertIndex = -1;

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        // Finde Task-Zeilen (| <nummer> | ...) oder Separator
        if (line.match(/^\|.*\|/) && !line.match(/^\|\s*#\s*\|/) && !line.match(/^\|[-:\s|]+\|$/)) {
          insertIndex = i + 1;
          break;
        }
        // Falls wir den Header/Separator finden aber keine Datenzeilen, einfügen danach
        if (line.match(/^\|[-:\s|]+\|$/)) {
          insertIndex = i + 1;
          break;
        }
      }

      if (insertIndex === -1) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: `Konnte Einfügeposition in Doc nicht finden`
        });
      }

      // 6. Zeile einfügen und speichern
      if (!dryRun) {
        lines.splice(insertIndex, 0, taskLine);
        writeFileSync(fullPath, lines.join('\n'));
      }

      return ok({
        success: true,
        initialized,
        path: fullPath,
        insertIndex
      });
    },

    /**
     * Findet alle Docs die eine bestimmte Task enthalten
     */
    findDocsContainingTask,

    /**
     * Sammelt alle Task-Definitionen aus Roadmap und Feature-Docs
     */
    getAllTaskDefinitions() {
      try {
        const loadResult = this.load();
        if (!loadResult.ok) return loadResult;

        const { tasks } = loadResult.value;
        const definitions = new Map();

        // Roadmap-Tasks hinzufügen
        for (const task of tasks) {
          definitions.set(task.number, [{ source: 'Roadmap', task }]);
        }

        // Feature-Docs durchsuchen
        const docFiles = findMarkdownFiles(docsPath);
        for (const filePath of docFiles) {
          if (filePath.endsWith('Development-Roadmap.md')) continue;

          try {
            const content = readFileSync(filePath, 'utf-8');
            const docName = basename(filePath);

            const docLines = content.split('\n');
            for (const line of docLines) {
              // 10-Spalten: # | Status | Domain | Layer | Beschreibung | ...
              const match = line.match(/^\|\s*(\d+[a-z]?)\s*\|\s*([⬜✅🔶⚠️🔒⛔📋❌])\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
              if (match) {
                const idStr = match[1];
                const id = /[a-z]$/i.test(idStr) ? idStr.toLowerCase() : parseInt(idStr, 10);
                const docTask = {
                  number: id,
                  status: match[2],
                  domain: match[3].trim(),
                  layer: match[4].trim(),
                  beschreibung: match[5].trim()
                };

                if (definitions.has(id)) {
                  definitions.get(id).push({ source: docName, task: docTask });
                } else {
                  definitions.set(id, [{ source: docName, task: docTask }]);
                }
              }
            }
          } catch {
            // Datei nicht lesbar - überspringen
          }
        }

        return ok(definitions);
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Task-Definitionen nicht laden: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Findet verwaiste Task-Referenzen in Docs (IDs die in Docs aber nicht in Roadmap existieren)
     *
     * @param {Set<number|string>} validIds - Gültige IDs aus der Roadmap
     * @returns {import('../core/result.mjs').Result<Array<{file: string, id: number|string}>>}
     */
    findOrphanReferences(validIds) {
      try {
        const orphans = [];
        const docFiles = findMarkdownFiles(docsPath);

        for (const filePath of docFiles) {
          if (filePath.endsWith('Development-Roadmap.md')) continue;

          try {
            const content = readFileSync(filePath, 'utf-8');
            const docName = basename(filePath);

            const docLines = content.split('\n');
            for (const line of docLines) {
              // Task-Referenzen in Tabellen finden
              const match = line.match(/^\|\s*(\d+[a-z]?)\s*\|/);
              if (match) {
                const idStr = match[1];
                const id = /[a-z]$/i.test(idStr) ? idStr.toLowerCase() : parseInt(idStr, 10);

                if (!validIds.has(id)) {
                  orphans.push({ file: docName, id });
                }
              }
            }
          } catch {
            // Datei nicht lesbar - überspringen
          }
        }

        return ok(orphans);
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Konnte Orphan-Referenzen nicht suchen: ${e.message}`,
          cause: e
        });
      }
    },

    /**
     * Gibt den Pfad zur Roadmap zurück
     */
    getRoadmapPath() {
      return roadmapPath;
    },

    /**
     * Gibt den Pfad zum docs-Verzeichnis zurück
     */
    getDocsPath() {
      return docsPath;
    }
  };
}

/**
 * Singleton-Instanz mit Default-Pfaden
 */
export const defaultTaskAdapter = createFsTaskAdapter();
