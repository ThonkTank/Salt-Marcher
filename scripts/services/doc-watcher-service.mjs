/**
 * Doc Watcher Service
 *
 * Überwacht Änderungen in docs/ und markiert betroffene Tasks als 🔶.
 *
 * Zwei Modi:
 * 1. docs/entities/*: Eine Task pro Schema-Datei, auto-create, jede Änderung → 🔶
 * 2. Andere docs/*: Nur Tasks deren referenzierter Abschnitt geändert wurde → 🔶
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus } from '../core/table/schema.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { createAddService } from './add-service.mjs';
import { calculateAllPropagation } from '../core/deps/propagation.mjs';

const DOCS_ROOT = 'docs';
const DATA_DIR = 'docs/entities';

// ============================================================================
// SECTION DETECTION
// ============================================================================

/**
 * Erstellt eine Map von Abschnittsnamen zu Zeilenbereichen.
 *
 * @param {string} content - Dateiinhalt
 * @returns {Map<string, {start: number, end: number, level: number}>}
 */
function buildSectionMap(content) {
  const lines = content.split('\n');
  const sections = new Map();
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const name = match[2].trim();

      // Vorherigen Abschnitt schließen
      if (currentSection) {
        currentSection.end = i - 1;
      }

      currentSection = { start: i, end: null, level, name };
      sections.set(name, currentSection);
    }
  }

  // Letzten Abschnitt schließen
  if (currentSection) {
    currentSection.end = lines.length - 1;
  }

  return sections;
}

/**
 * Parst Git-Diff-Hunks und extrahiert geänderte Zeilennummern.
 *
 * @param {string} diff - Git diff output
 * @returns {number[]} - Array von geänderten Zeilennummern (neue Datei)
 */
function parseDiffHunks(diff) {
  const changedLines = [];
  const hunkPattern = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

  let match;
  while ((match = hunkPattern.exec(diff)) !== null) {
    const start = parseInt(match[1], 10);
    const count = match[2] ? parseInt(match[2], 10) : 1;

    for (let i = 0; i < count; i++) {
      changedLines.push(start + i);
    }
  }

  return changedLines;
}

/**
 * Ermittelt geänderte Abschnitte via Git-Diff.
 *
 * @param {string} filePath - Pfad zur Datei
 * @returns {{sections: string[], isNewFile: boolean}}
 */
function getChangedSections(filePath) {
  try {
    // Git diff holen (unstaged + staged)
    let diff = '';
    try {
      diff = execSync(`git diff --unified=0 "${filePath}"`, { encoding: 'utf-8' });
    } catch {
      // Kein unstaged diff
    }

    if (!diff) {
      try {
        diff = execSync(`git diff --cached --unified=0 "${filePath}"`, { encoding: 'utf-8' });
      } catch {
        // Kein staged diff
      }
    }

    // Wenn kein Diff, könnte es eine neue Datei sein
    if (!diff) {
      // Prüfen ob Datei untracked ist
      try {
        const status = execSync(`git status --porcelain "${filePath}"`, { encoding: 'utf-8' });
        if (status.startsWith('??') || status.startsWith('A ')) {
          // Neue Datei - alle Abschnitte als geändert betrachten
          const content = readFileSync(filePath, 'utf-8');
          const sectionMap = buildSectionMap(content);
          return { sections: [...sectionMap.keys()], isNewFile: true };
        }
      } catch {
        // Git status fehlgeschlagen
      }
      return { sections: [], isNewFile: false };
    }

    // Geänderte Zeilen parsen
    const changedLines = parseDiffHunks(diff);
    if (changedLines.length === 0) {
      return { sections: [], isNewFile: false };
    }

    // Aktuelle Datei lesen und Abschnitts-Map erstellen
    const content = readFileSync(filePath, 'utf-8');
    const sectionMap = buildSectionMap(content);

    // Geänderte Zeilen → Abschnitte mappen
    const affectedSections = new Set();
    for (const lineNum of changedLines) {
      for (const [name, { start, end }] of sectionMap) {
        // 1-basierte Zeilennummern aus git diff
        if (lineNum >= start + 1 && lineNum <= end + 1) {
          affectedSections.add(name);
        }
      }
    }

    return { sections: [...affectedSections], isNewFile: false };
  } catch (e) {
    return { sections: [], isNewFile: false, error: e.message };
  }
}

// ============================================================================
// TASK MATCHING
// ============================================================================

/**
 * Findet Task für Schema-Datei (Modus 1).
 *
 * @param {string} filename - Schema-Dateiname (z.B. "creature.md")
 * @param {object[]} tasks - Alle Tasks
 * @returns {object|null}
 */
function findSchemaTask(filename, tasks) {
  const pattern = `implementiere ${filename}`.toLowerCase();
  return tasks.find(t =>
    t.beschreibung.toLowerCase().startsWith(pattern)
  ) || null;
}

/**
 * Findet Tasks mit Spec-Referenz auf Datei und Abschnitt (Modus 2).
 *
 * @param {string} filename - Dateiname (z.B. "Travel.md")
 * @param {string} section - Abschnittsname
 * @param {object[]} tasks - Alle Tasks
 * @returns {object[]}
 */
function findTasksBySpec(filename, section, tasks) {
  const pattern = `${filename}#${section}`.toLowerCase();
  return tasks.filter(t =>
    t.spec && t.spec.toLowerCase().includes(pattern)
  );
}

// ============================================================================
// MODE 1: docs/entities/* (Schema-Dateien)
// ============================================================================

/**
 * Prüft ob eine Datei ungespeicherte Änderungen hat.
 *
 * @param {string} filePath - Pfad zur Datei
 * @returns {boolean}
 */
function hasUncommittedChanges(filePath) {
  try {
    // Unstaged changes (--quiet exits with 1 if there are changes)
    execSync(`git diff --quiet "${filePath}" 2>/dev/null`, { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // Exit code != 0 bedeutet es gibt Änderungen
    return true;
  }

  try {
    // Staged changes
    execSync(`git diff --cached --quiet "${filePath}" 2>/dev/null`, { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    return true;
  }

  try {
    // Untracked file
    const status = execSync(`git status --porcelain "${filePath}" 2>/dev/null`, { encoding: 'utf-8' });
    if (status.startsWith('??') || status.startsWith('A ')) {
      return true;
    }
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Prüft Schema-Datei und markiert/erstellt Task.
 *
 * @param {string} filePath - Pfad zur Schema-Datei
 * @param {object} opts - Optionen
 * @param {object} adapter - Task-Adapter
 * @param {object} addService - Add-Service für Task-Erstellung
 * @returns {import('../core/result.mjs').Result}
 */
function checkDataSchema(filePath, opts, adapter, addService) {
  const { dryRun = false } = opts;
  const filename = basename(filePath);
  const name = filename.replace('.md', '');
  const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

  const result = {
    mode: 'data',
    file: filePath,
    task: null,
    action: null,
    hasChanges: false,
    propagation: [],
    dryRun
  };

  // Prüfen ob Datei tatsächlich geändert wurde
  const hasChanges = hasUncommittedChanges(filePath);
  result.hasChanges = hasChanges;

  if (!hasChanges) {
    result.action = 'no_changes';
    return ok(result);
  }

  // Roadmap laden
  const loadResult = adapter.load();
  if (!loadResult.ok) {
    return loadResult;
  }

  const { tasks, itemMap } = loadResult.value;

  // Task suchen
  const existingTask = findSchemaTask(filename, tasks);

  if (!existingTask) {
    // Task erstellen
    result.action = 'created';

    if (!dryRun) {
      const addResult = addService.addTask({
        domain: name,
        layer: 'data',
        beschreibung: `Implementiere ${filename} in src/data/${name}.ts`,
        deps: '-',
        specs: `${filename}#Felder`,
        impl: `data/${name}.ts.${pascalName}Schema() [neu]`,
        prio: 'hoch',
        mvp: 'Ja'
      }, { dryRun: false, init: true });

      if (!addResult.ok) {
        return addResult;
      }

      result.task = { id: addResult.value.taskId, beschreibung: `Implementiere ${filename}` };
    } else {
      result.task = { id: '(neu)', beschreibung: `Implementiere ${filename}` };
    }

    return ok(result);
  }

  // Task existiert
  result.task = { id: existingTask.number, beschreibung: existingTask.beschreibung };

  if (existingTask.status === TaskStatus.DONE) {
    result.action = 'marked_partial';

    if (!dryRun) {
      // Status auf 🔶 setzen
      const updateResult = adapter.updateTask(existingTask.number, {
        status: TaskStatus.PARTIAL
      }, { dryRun: false });

      if (!updateResult.ok) {
        return updateResult;
      }

      // Propagation berechnen
      const allItems = [...tasks];
      const propagation = calculateAllPropagation(
        existingTask.number,
        TaskStatus.PARTIAL,
        allItems,
        itemMap
      );

      // Propagation anwenden
      for (const effect of propagation) {
        const propResult = adapter.updateTask(effect.taskId, {
          status: effect.newStatus
        }, { dryRun: false });

        if (propResult.ok) {
          result.propagation.push({
            id: effect.taskId,
            oldStatus: effect.oldStatus,
            newStatus: effect.newStatus,
            reason: effect.reason
          });
        }
      }
    }
  } else {
    result.action = 'no_change';
  }

  return ok(result);
}

// ============================================================================
// MODE 2: Andere docs/* (Feature/Domain/etc.)
// ============================================================================

/**
 * Prüft Doc-Datei und markiert Tasks bei geänderten Abschnitten.
 *
 * @param {string} filePath - Pfad zur Doc-Datei
 * @param {object} opts - Optionen
 * @param {object} adapter - Task-Adapter
 * @returns {import('../core/result.mjs').Result}
 */
function checkDocSections(filePath, opts, adapter) {
  const { dryRun = false } = opts;
  const filename = basename(filePath);

  const result = {
    mode: 'sections',
    file: filePath,
    changedSections: [],
    affectedTasks: [],
    propagation: [],
    dryRun
  };

  // Geänderte Abschnitte ermitteln
  const { sections, isNewFile, error } = getChangedSections(filePath);

  if (error) {
    result.error = error;
  }

  result.changedSections = sections;
  result.isNewFile = isNewFile;

  if (sections.length === 0) {
    return ok(result);
  }

  // Roadmap laden
  const loadResult = adapter.load();
  if (!loadResult.ok) {
    return loadResult;
  }

  const { tasks, itemMap } = loadResult.value;
  const allItems = [...tasks];

  // Für jeden geänderten Abschnitt Tasks finden
  for (const section of sections) {
    const matchingTasks = findTasksBySpec(filename, section, tasks);

    for (const task of matchingTasks) {
      // Nur ✅ Tasks markieren
      if (task.status !== TaskStatus.DONE) {
        continue;
      }

      result.affectedTasks.push({
        id: task.number,
        beschreibung: task.beschreibung,
        section,
        oldStatus: task.status
      });

      if (!dryRun) {
        // Status auf 🔶 setzen
        const updateResult = adapter.updateTask(task.number, {
          status: TaskStatus.PARTIAL
        }, { dryRun: false });

        if (updateResult.ok) {
          // Propagation berechnen
          const propagation = calculateAllPropagation(
            task.number,
            TaskStatus.PARTIAL,
            allItems,
            itemMap
          );

          // Propagation anwenden
          for (const effect of propagation) {
            const propResult = adapter.updateTask(effect.taskId, {
              status: effect.newStatus
            }, { dryRun: false });

            if (propResult.ok) {
              result.propagation.push({
                id: effect.taskId,
                oldStatus: effect.oldStatus,
                newStatus: effect.newStatus,
                reason: effect.reason
              });
            }
          }
        }
      }
    }
  }

  return ok(result);
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Prüft Doc-Änderung und delegiert an entsprechenden Modus.
 *
 * @param {string} filePath - Pfad zur Datei
 * @param {object} opts - Optionen
 * @returns {import('../core/result.mjs').Result}
 */
function checkDocChange(filePath, opts = {}) {
  // Normalisiere Pfad (entferne führende ./)
  const normalizedPath = filePath.replace(/^\.\//, '');

  // Prüfe ob in docs/
  if (!normalizedPath.startsWith(DOCS_ROOT + '/')) {
    return ok({ skipped: true, reason: 'not_in_docs', file: normalizedPath });
  }

  // Prüfe ob .md Datei
  if (!normalizedPath.endsWith('.md')) {
    return ok({ skipped: true, reason: 'not_markdown', file: normalizedPath });
  }

  // Prüfe ob Datei existiert
  if (!existsSync(normalizedPath)) {
    return ok({ skipped: true, reason: 'file_not_found', file: normalizedPath });
  }

  const adapter = createFsTaskAdapter();
  const addService = createAddService({ taskAdapter: adapter });

  // Modus bestimmen
  if (normalizedPath.startsWith(DATA_DIR + '/')) {
    return checkDataSchema(normalizedPath, opts, adapter, addService);
  } else {
    return checkDocSections(normalizedPath, opts, adapter);
  }
}

/**
 * Prüft alle Schema-Dateien in docs/entities/.
 *
 * @param {object} opts - Optionen
 * @returns {import('../core/result.mjs').Result}
 */
function checkAllDataSchemas(opts = {}) {
  const results = {
    schemas: [],
    errors: [],
    dryRun: opts.dryRun
  };

  if (!existsSync(DATA_DIR)) {
    return err({
      code: TaskErrorCode.FILE_NOT_FOUND,
      message: `Verzeichnis nicht gefunden: ${DATA_DIR}`
    });
  }

  const files = readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => join(DATA_DIR, f));

  for (const file of files) {
    const result = checkDocChange(file, opts);
    if (result.ok) {
      results.schemas.push(result.value);
    } else {
      results.errors.push({ file, error: result.error });
    }
  }

  return ok(results);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Parst CLI-Argumente.
 */
export function parseArgs(argv) {
  const opts = {
    file: null,
    all: false,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--file' || arg === '-f') {
      opts.file = argv[++i];
    } else if (arg === '--all' || arg === '-a') {
      opts.all = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    }
  }

  return opts;
}

/**
 * Führt check-doc command aus.
 */
export function execute(opts) {
  if (opts.all) {
    return checkAllDataSchemas(opts);
  }

  if (!opts.file) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: '--file oder --all erforderlich'
    });
  }

  return checkDocChange(opts.file, opts);
}

/**
 * Zeigt Hilfe.
 */
export function showHelp() {
  return `
Check-Doc Command - Prüft Dokumentenänderungen und markiert Tasks

USAGE:
  node scripts/task.mjs check-doc --file <path>
  node scripts/task.mjs check-doc --all

OPTIONEN:
  -f, --file <path>     Einzelne Datei prüfen
  -a, --all             Alle docs/entities/*.md prüfen
  -n, --dry-run         Vorschau ohne Änderungen
  --json                JSON-Ausgabe
  -q, --quiet           Keine Ausgabe bei Erfolg
  -h, --help            Diese Hilfe anzeigen

MODI:
  docs/entities/*:          Jede Änderung → Task auf 🔶 (auto-create wenn nicht vorhanden)
  Andere docs/*:        Nur Tasks mit Spec-Referenz auf geänderten Abschnitt → 🔶

BEISPIELE:
  # Schema-Datei prüfen
  node scripts/task.mjs check-doc --file docs/entities/creature.md

  # Feature-Dok prüfen
  node scripts/task.mjs check-doc --file docs/features/Travel.md

  # Alle Schemas prüfen (dry-run)
  node scripts/task.mjs check-doc --all --dry-run

HINWEISE:
  - Nutzt Git-Diff um geänderte Abschnitte zu ermitteln
  - Propagation erfolgt automatisch (Dependants → ⛔)
  - Idempotent: Nur ✅ → 🔶, nie 🔶 → 🔶
`;
}
