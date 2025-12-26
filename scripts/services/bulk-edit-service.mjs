/**
 * Bulk-Edit Service
 *
 * Ermöglicht das gleichzeitige Bearbeiten mehrerer Tasks mit identischen Änderungen.
 * Unterstützt Partial-Success: Fehlerhafte Tasks verhindern nicht die Bearbeitung der anderen.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { resolveStatusAlias, VALID_STATUSES } from '../core/table/schema.mjs';
import { parseTaskId } from '../core/table/parser.mjs';
import { formatId } from '../core/table/parser.mjs';
import { createTaskService } from './edit-service.mjs';

/**
 * Parst CLI-Argumente für bulk-edit command
 */
export function parseArgs(argv) {
  const opts = {
    taskIds: [],
    keys: [],
    status: null,
    deps: null,
    beschreibung: null,
    domain: null,
    layer: null,
    prio: null,
    mvp: null,
    spec: null,
    imp: null,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--status' || arg === '-s') {
      opts.status = argv[++i];
    } else if (arg === '--deps' || arg === '-d') {
      opts.deps = argv[++i];
    } else if (arg === '--no-deps') {
      opts.deps = '-';
    } else if (arg === '--beschreibung' || arg === '-m') {
      opts.beschreibung = argv[++i];
    } else if (arg === '--domain' || arg === '-b') {
      opts.domain = argv[++i];
    } else if (arg === '--layer' || arg === '-l') {
      opts.layer = argv[++i];
    } else if (arg === '--prio' || arg === '-p') {
      opts.prio = argv[++i];
    } else if (arg === '--mvp') {
      opts.mvp = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '--imp') {
      opts.imp = argv[++i];
    } else if (arg === '--key' || arg === '-k') {
      opts.keys.push(argv[++i]);
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      // Task-IDs sammeln (Tasks und Bugs)
      if (arg.match(/^b\d+$/)) {
        opts.taskIds.push(arg);
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) opts.taskIds.push(parsed);
      }
    }
  }

  return opts;
}

/**
 * Führt den bulk-edit command aus
 */
export function execute(opts, service = null) {
  const editService = service ?? createTaskService();

  // Mindestens 2 Tasks erforderlich
  if (opts.taskIds.length < 2) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Mindestens 2 Task-IDs erforderlich für bulk-edit'
    });
  }

  // Updates-Objekt bauen
  const updates = {};
  if (opts.status) {
    const resolvedStatus = resolveStatusAlias(opts.status);
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      return err({
        code: TaskErrorCode.INVALID_STATUS,
        message: `Ungültiger Status: ${opts.status}. Gültig: ${VALID_STATUSES.join(', ')}`
      });
    }
    updates.status = resolvedStatus;
  }
  if (opts.deps !== null) updates.deps = opts.deps;
  if (opts.beschreibung) {
    updates.beschreibung = opts.beschreibung.replace(/[\r\n]+/g, ' ').trim();
  }
  if (opts.domain) updates.domain = opts.domain;
  if (opts.layer) updates.layer = opts.layer;
  if (opts.prio) updates.prio = opts.prio;
  if (opts.mvp) updates.mvp = opts.mvp;
  if (opts.spec) updates.spec = opts.spec;
  if (opts.imp) updates.imp = opts.imp;

  // Mindestens eine Änderung erforderlich
  const hasChanges = Object.keys(updates).length > 0;
  if (!hasChanges) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Mindestens eine Änderung erforderlich (--status, --deps, etc.)'
    });
  }

  // Keys kopieren (um shift() zu verwenden)
  const availableKeys = [...opts.keys];

  const results = {
    success: [],
    failed: [],
    propagation: [],
    dryRun: opts.dryRun
  };

  // Über alle Tasks iterieren
  for (const taskId of opts.taskIds) {
    // Nächsten verfügbaren Key nehmen (Reihenfolge: erster Key für erste Task)
    const key = availableKeys.shift() ?? null;

    const result = editService.updateTask(taskId, { ...updates }, {
      dryRun: opts.dryRun,
      key
    });

    if (result.ok) {
      results.success.push({
        taskId,
        statusChange: result.value.roadmap?.statusChange ?? null
      });
      // Propagation sammeln
      if (result.value.propagation?.length > 0) {
        results.propagation.push(...result.value.propagation);
      }
    } else {
      results.failed.push({
        taskId,
        error: result.error
      });
    }
  }

  return ok(results);
}

/**
 * Formatiert die Ausgabe für bulk-edit
 */
export function formatOutput(result, opts) {
  if (!result.ok) {
    return `Fehler: ${result.error.message}`;
  }

  const { success, failed, propagation, dryRun } = result.value;

  if (opts.json) {
    return JSON.stringify(result.value, null, 2);
  }

  const lines = [];

  if (dryRun) {
    lines.push('DRY-RUN (keine Änderungen gespeichert)\n');
  }

  // Erfolge
  for (const s of success) {
    const statusInfo = s.statusChange
      ? `: ${s.statusChange.from} -> ${s.statusChange.to}`
      : '';
    lines.push(`  ${formatId(s.taskId)}${statusInfo}`);
  }

  // Fehler
  for (const f of failed) {
    lines.push(`  ${formatId(f.taskId)}: ${f.error.message}`);
  }

  // Propagation
  if (propagation.length > 0) {
    lines.push('\nPropagation:');
    for (const p of propagation) {
      lines.push(`  ${formatId(p.id)}: ${p.oldStatus} -> ${p.newStatus} (${p.reason})`);
    }
  }

  // Summary
  const total = success.length + failed.length;
  lines.push(`\nErgebnis: ${success.length}/${total} Tasks aktualisiert`);

  if (failed.length > 0) {
    lines.push(`         ${failed.length} fehlgeschlagen`);
  }

  return lines.join('\n');
}

/**
 * Zeigt Hilfe für bulk-edit command
 */
export function showHelp() {
  return `
Bulk-Edit Command - Mehrere Tasks gleichzeitig bearbeiten

USAGE:
  node scripts/task.mjs bulk-edit <ID> <ID> [...] [OPTIONS]

ARGUMENTE:
  <ID> <ID> ...        Mindestens 2 Task-IDs (z.B. 100 101 102)

OPTIONEN:
  -s, --status <status>  Status ändern (${VALID_STATUSES.join(', ')})
  -d, --deps "<deps>"    Dependencies setzen (z.B. "#100, #202")
  --no-deps              Dependencies entfernen
  -m, --beschreibung "." Beschreibung ändern
  -b, --domain <name>    Domain ändern (z.B. Travel, Map)
  -l, --layer <layer>    Layer ändern (core, features, infra, apps)
  -p, --prio <prio>      Priorität ändern (hoch, mittel, niedrig)
  --mvp <Ja|Nein>        MVP-Status ändern
  --spec "File.md#..."   Spec-Referenz ändern
  --imp "file:func()"    Implementierungs-Details ändern

CLAIM-HANDLING:
  -k, --key <key>        Key für geclaime Tasks (kann mehrfach angegeben werden)
                         Keys werden in Reihenfolge den Task-IDs zugeordnet

ALLGEMEIN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

BEISPIELE:
  # Alle drei Tasks auf fertig setzen
  node scripts/task.mjs bulk-edit 100 101 102 --status done

  # Mit mehreren Keys für geclaime Tasks
  node scripts/task.mjs bulk-edit 100 101 --status ready --key a4x2 --key b5y3

  # Dry-run zum Testen
  node scripts/task.mjs bulk-edit 100 101 102 --prio hoch --dry-run

HINWEISE:
  - Fehlerhafte Tasks verhindern nicht die Bearbeitung der anderen (Partial Success)
  - Keys werden in der angegebenen Reihenfolge den Tasks zugeordnet
  - Propagation wird nach allen Updates durchgeführt
`;
}
