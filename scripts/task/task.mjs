#!/usr/bin/env node
// Ziel: CLI-Einstiegspunkt für Task-Management
// Siehe: docs/tools/taskTool.md

import { parseArgs } from 'node:util';
import { isOk, unwrap } from './core/result.mjs';
import { parseTasks, parseBugs, findTable } from './core/table/parser.mjs';
import { buildTasksTable, buildBugsTable } from './core/table/builder.mjs';
import { readRoadmap, writeRoadmap, readClaims, writeClaims } from './adapters/fs-task-adapter.mjs';
import { sortTasks, filterTasks, formatTaskList, sortBugs, filterBugs, formatBugList } from './services/sort-service.mjs';
import { findById, buildDependencyTree, formatDetails } from './services/lookup-service.mjs';
import { claimTask, releaseClaim, cleanupExpiredClaims } from './services/claim-service.mjs';
import { editTask } from './services/edit-service.mjs';
import { addTasks, addBugs } from './services/add-service.mjs';
import { removeTask, removeBug } from './services/remove-service.mjs';
import { propagateStatus, areDependenciesSatisfied } from './core/deps/propagation.mjs';
import { STATUS } from './core/table/schema.mjs';
import { syncTask, syncTasks } from './services/sync-service.mjs';

// TODO: handleSort(args) - sort Befehl
// TODO: handleShow(args) - show Befehl
// TODO: handleClaim(args) - claim/release Befehl
// TODO: handleEdit(args) - edit Befehl
// TODO: handleAdd(args) - add Befehl
// TODO: handleRemove(args) - remove Befehl
// TODO: printUsage() - Hilfe ausgeben
// TODO: formatError(error) - Fehler formatieren

const COMMANDS = {
  sort: handleSort,
  show: handleShow,
  claim: handleClaim,
  edit: handleEdit,
  add: handleAdd,
  remove: handleRemove,
  'fix-deps': handleFixDeps,
  help: printUsage,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unbekannter Befehl: ${command}`);
    console.error('Verwende "node scripts/task.mjs help" für Hilfe.');
    process.exit(1);
  }

  try {
    await handler(args.slice(1));
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
    process.exit(1);
  }
}

/**
 * sort [keyword] [options]
 */
async function handleSort(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      status: { type: 'string', short: 's' },
      domain: { type: 'string', short: 'd' },
      layer: { type: 'string', short: 'l' },
      mvp: { type: 'boolean' },
      'no-mvp': { type: 'boolean' },
      prio: { type: 'string', short: 'p' },
      bugs: { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden:', roadmapResult.error);
    process.exit(1);
  }

  const content = unwrap(roadmapResult);

  if (values.bugs) {
    const bugsResult = parseBugs(content);
    if (!isOk(bugsResult)) {
      console.error('Bugs konnten nicht geparst werden:', bugsResult.error);
      process.exit(1);
    }

    let bugs = unwrap(bugsResult);

    const filterOptions = {
      keyword: positionals[0],
      status: values.status,
      prio: values.prio,
    };

    bugs = filterBugs(bugs, filterOptions);
    bugs = sortBugs(bugs);

    console.log(formatBugList(bugs));
    return;
  }

  const tasksResult = parseTasks(content);
  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden:', tasksResult.error);
    process.exit(1);
  }

  let tasks = unwrap(tasksResult);

  // Filter anwenden
  const filterOptions = {
    keyword: positionals[0],
    status: values.status,
    domain: values.domain,
    layer: values.layer,
    mvp: values.mvp ? true : (values['no-mvp'] ? false : undefined),
    prio: values.prio,
  };

  tasks = filterTasks(tasks, filterOptions);
  tasks = sortTasks(tasks);

  console.log(formatTaskList(tasks));
}

/**
 * show <ID>
 */
async function handleShow(args) {
  const taskId = args[0];
  if (!taskId) {
    console.error('Task-ID erforderlich: node scripts/task.mjs show <ID>');
    process.exit(1);
  }

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);

  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];
  const claims = await readClaims();

  const item = findById(taskId, tasks, bugs);
  if (!item) {
    console.error(`Task oder Bug mit ID ${taskId} nicht gefunden`);
    process.exit(1);
  }

  const depTree = buildDependencyTree(item, tasks, bugs);
  console.log(formatDetails(item, depTree, claims, tasks));
}

/**
 * claim <ID> oder claim <key> (release)
 */
async function handleClaim(args) {
  const idOrKey = args[0];
  if (!idOrKey) {
    console.error('ID oder Key erforderlich');
    process.exit(1);
  }

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);
  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];
  const claims = await readClaims();

  // Cleanup abgelaufener Claims
  const { restoredTasks } = cleanupExpiredClaims(claims, tasks);

  // Prüfen ob ID oder Key
  const isKey = /^[a-z0-9]{4}$/.test(idOrKey);

  if (isKey) {
    // Release
    const result = releaseClaim(idOrKey, claims, tasks);
    if (!isOk(result)) {
      console.error(`Release fehlgeschlagen: ${result.error.code}`);
      process.exit(1);
    }

    await writeClaims(claims);

    // Roadmap mit aktualisiertem Status schreiben
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    console.log(`Claim freigegeben. Status wiederhergestellt: ${result.value.previousStatus}`);
  } else {
    // Claim
    const result = claimTask(idOrKey, tasks, claims);
    if (!isOk(result)) {
      console.error(`Claim fehlgeschlagen: ${result.error.code}`);
      if (result.error.key) {
        console.error(`Bereits geclaimed mit Key: ${result.error.key}`);
      }
      process.exit(1);
    }

    await writeClaims(claims);

    // Roadmap mit aktualisiertem Status schreiben
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    console.log(`Key: ${result.value.key} (2h gültig)`);
  }
}

/**
 * edit <ID> --key <key> [options]
 */
async function handleEdit(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      key: { type: 'string' },
      status: { type: 'string' },
      deps: { type: 'string' },
      beschreibung: { type: 'string' },
      prio: { type: 'string' },
      mvp: { type: 'boolean' },
      'no-mvp': { type: 'boolean' },
      spec: { type: 'string' },
      impl: { type: 'string' },
    },
    allowPositionals: true,
  });

  const taskIds = positionals;
  if (taskIds.length === 0) {
    console.error('Task-ID(s) erforderlich: node scripts/task/task.mjs edit <ID> [ID2 ID3...] [--key <key>] [options]');
    process.exit(1);
  }

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);

  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];
  const claims = await readClaims();

  const changes = {};
  if (values.status) changes.status = values.status;
  if (values.deps) changes.deps = values.deps;
  if (values.beschreibung) changes.beschreibung = values.beschreibung;
  if (values.prio) changes.prio = values.prio;
  if (values.mvp) changes.mvp = true;
  if (values['no-mvp']) changes.mvp = false;
  if (values.spec) changes.spec = values.spec;
  if (values.impl) changes.impl = values.impl;

  // Bulk edit: Sammle Erfolge und Fehler
  const successes = [];
  const errors = [];

  for (const taskId of taskIds) {
    const result = await editTask(taskId, changes, values.key || null, tasks, bugs, claims);
    if (!isOk(result)) {
      errors.push({ id: taskId, code: result.error.code });
      continue;
    }

    // Propagation bei Status-Änderung
    if (changes.status) {
      propagateStatus(`#${taskId}`, changes.status, tasks, bugs);
    }

    successes.push({ id: taskId, claimReleased: result.value.claimReleased });
  }

  // Nur schreiben wenn mindestens ein Erfolg
  if (successes.length > 0) {
    await writeClaims(claims);

    // Roadmap mit aktualisierten Tasks schreiben
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    // Sync zu Spec/Impl-Dateien
    for (const { id } of successes) {
      const task = tasks.find(t => String(t.id) === String(id).replace('#', ''));
      if (task) {
        await syncTask(task, 'update');
      }
    }
  }

  // Output
  if (successes.length === 1) {
    console.log(`Task #${successes[0].id} aktualisiert`);
    if (successes[0].claimReleased) {
      console.log('Claim automatisch freigegeben');
    }
  } else if (successes.length > 1) {
    console.log(`${successes.length} Tasks aktualisiert: ${successes.map(s => '#' + s.id).join(', ')}`);
  }

  if (errors.length > 0) {
    for (const { id, code } of errors) {
      console.error(`#${id}: ${code}`);
    }
    if (successes.length === 0) {
      process.exit(1);
    }
  }
}

/**
 * add --tasks '<JSON>' oder add --bugs '<JSON>'
 */
async function handleAdd(args) {
  const { values } = parseArgs({
    args,
    options: {
      tasks: { type: 'string' },
      bugs: { type: 'string' },
    },
  });

  if (!values.tasks && !values.bugs) {
    console.error('--tasks oder --bugs erforderlich');
    process.exit(1);
  }

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);

  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];

  if (values.tasks) {
    let taskInputs;
    try {
      taskInputs = JSON.parse(values.tasks);
    } catch {
      console.error('Ungültiges JSON für --tasks');
      process.exit(1);
    }

    const result = await addTasks(taskInputs, tasks);
    if (!isOk(result)) {
      const e = result.error;
      const taskInfo = e.taskIndex !== undefined
        ? ` (Task ${e.taskIndex + 1}: "${e.taskPreview}")`
        : '';
      console.error(`Add fehlgeschlagen${taskInfo}: ${e.code}`);
      // Zusätzliche Details je nach Fehlertyp
      if (e.field) console.error(`  Feld: ${e.field}`);
      if (e.impl) console.error(`  Impl: ${e.impl}`);
      if (e.spec) console.error(`  Spec: ${e.spec}`);
      if (e.filename) console.error(`  Datei: ${e.filename}`);
      if (e.matches) console.error(`  Gefunden: ${e.matches.join(', ')}`);
      process.exit(1);
    }

    const newTasks = unwrap(result);
    tasks.push(...newTasks);

    // Roadmap mit neuen Tasks schreiben
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    // Sync zu Spec/Impl-Dateien
    const syncedFiles = await syncTasks(newTasks, 'add');
    if (syncedFiles.length > 0) {
      console.log(`Synchronisiert: ${syncedFiles.length} Datei(en)`);
    }

    console.log(`${newTasks.length} Task(s) erstellt:`);
    for (const t of newTasks) {
      console.log(`  #${t.id}: ${t.beschreibung}`);
    }
  }

  if (values.bugs) {
    let bugInputs;
    try {
      bugInputs = JSON.parse(values.bugs);
    } catch {
      console.error('Ungültiges JSON für --bugs');
      process.exit(1);
    }

    const result = addBugs(bugInputs, tasks, bugs);
    if (!isOk(result)) {
      console.error(`Add fehlgeschlagen: ${result.error.code}`);
      process.exit(1);
    }

    const { bugs: newBugs, affectedTasks } = unwrap(result);
    bugs.push(...newBugs);

    // Roadmap mit neuen Bugs schreiben
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    console.log(`${newBugs.length} Bug(s) erstellt:`);
    for (const b of newBugs) {
      console.log(`  ${b.id}: ${b.beschreibung}`);
    }

    if (affectedTasks.length > 0) {
      console.log(`${affectedTasks.length} Task(s) auf ⚠️ gesetzt`);
    }
  }
}

/**
 * remove <ID> [ID2 ID3...] [--resolve]
 */
async function handleRemove(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      resolve: { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const ids = positionals;
  if (ids.length === 0) {
    console.error('ID(s) erforderlich: node scripts/task/task.mjs remove <ID> [ID2 ID3...] [--resolve]');
    process.exit(1);
  }

  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);

  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];
  const claims = await readClaims();

  // Bulk remove: Sammle Erfolge und Fehler
  const removedTasks = [];
  const removedBugs = [];
  const errors = [];

  for (const id of ids) {
    if (id.startsWith('b')) {
      // Bug entfernen
      const result = removeBug(id, values.resolve, tasks, bugs, claims);
      if (!isOk(result)) {
        errors.push({ id, code: result.error.code });
        continue;
      }
      removedBugs.push({ id, ...result.value });
    } else {
      // Task entfernen
      const result = removeTask(id, tasks, bugs, claims);
      if (!isOk(result)) {
        errors.push({ id, code: result.error.code });
        continue;
      }
      removedTasks.push({ id, ...result.value });
    }
  }

  // Nur schreiben wenn mindestens ein Erfolg
  if (removedTasks.length > 0 || removedBugs.length > 0) {
    await writeClaims(claims);
    const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
    await writeRoadmap(updatedRoadmap);

    // Sync (remove) für Tasks
    for (const { removedTask } of removedTasks) {
      if (removedTask) {
        await syncTask(removedTask, 'remove');
      }
    }
  }

  // Output
  if (removedTasks.length === 1) {
    console.log(`Task #${removedTasks[0].id} entfernt`);
  } else if (removedTasks.length > 1) {
    console.log(`${removedTasks.length} Tasks entfernt: ${removedTasks.map(t => '#' + t.id).join(', ')}`);
  }

  if (removedBugs.length === 1) {
    console.log(`Bug ${removedBugs[0].id} entfernt`);
  } else if (removedBugs.length > 1) {
    console.log(`${removedBugs.length} Bugs entfernt: ${removedBugs.map(b => b.id).join(', ')}`);
  }

  if (errors.length > 0) {
    for (const { id, code } of errors) {
      console.error(`${id}: ${code}`);
    }
    if (removedTasks.length === 0 && removedBugs.length === 0) {
      process.exit(1);
    }
  }
}

/**
 * fix-deps - Korrigiert alle Tasks mit unerfüllten Dependencies auf ⛔
 */
async function handleFixDeps() {
  const roadmapResult = await readRoadmap();
  if (!isOk(roadmapResult)) {
    console.error('Roadmap konnte nicht gelesen werden');
    process.exit(1);
  }

  const content = unwrap(roadmapResult);
  const tasksResult = parseTasks(content);
  const bugsResult = parseBugs(content);

  if (!isOk(tasksResult)) {
    console.error('Tasks konnten nicht geparst werden');
    process.exit(1);
  }

  const tasks = unwrap(tasksResult);
  const bugs = isOk(bugsResult) ? unwrap(bugsResult) : [];

  const fixed = [];

  for (const task of tasks) {
    // Überspringe bereits erledigte, blockierte oder geclaimte Tasks
    if (task.status === STATUS.done.symbol ||
        task.status === STATUS.blocked.symbol ||
        task.status === STATUS.claimed.symbol) {
      continue;
    }

    // Prüfe ob Dependencies unerfüllt sind
    if (task.deps.length > 0 && !areDependenciesSatisfied(task, tasks, bugs)) {
      task.status = STATUS.blocked.symbol;
      fixed.push(task);
    }
  }

  if (fixed.length === 0) {
    console.log('Keine Tasks mit unerfüllten Dependencies gefunden.');
    return;
  }

  // Roadmap mit korrigierten Tasks schreiben
  const updatedRoadmap = rebuildRoadmap(content, tasks, bugs);
  await writeRoadmap(updatedRoadmap);

  // Sync zu Spec/Impl-Dateien
  for (const t of fixed) {
    await syncTask(t, 'update');
  }

  console.log(`${fixed.length} Task(s) auf ⛔ gesetzt:`);
  for (const t of fixed) {
    console.log(`  #${t.id}: ${t.beschreibung}`);
  }
}

/**
 * Rebuilds the roadmap content with updated tasks/bugs tables.
 * @param {string} originalContent
 * @param {import('./core/table/parser.mjs').Task[]} tasks
 * @param {import('./core/table/parser.mjs').Bug[]} bugs
 * @returns {string}
 */
function rebuildRoadmap(originalContent, tasks, bugs) {
  let content = originalContent;

  // Replace Tasks table
  const tasksTable = findTable(content, '## 📋 Tasks');
  if (tasksTable) {
    const lines = content.split('\n');
    const newTasksTable = buildTasksTable(tasks);
    const newTableLines = newTasksTable.split('\n');
    lines.splice(
      tasksTable.startLine,
      tasksTable.endLine - tasksTable.startLine + 1,
      ...newTableLines
    );
    content = lines.join('\n');
  }

  // Replace Bugs table
  const bugsTable = findTable(content, '## 🐛 Bugs');
  if (bugsTable && bugs.length > 0) {
    const lines = content.split('\n');
    const newBugsTable = buildBugsTable(bugs);
    const newTableLines = newBugsTable.split('\n');
    lines.splice(
      bugsTable.startLine,
      bugsTable.endLine - bugsTable.startLine + 1,
      ...newTableLines
    );
    content = lines.join('\n');
  }

  return content;
}

function printUsage() {
  console.log(`
Task-Tool CLI - Task-Management für Development-Roadmap

BEFEHLE:
  sort [keyword] [options]     Tasks sortiert ausgeben
    -s, --status <X>           Nur Tasks mit Status X
    -d, --domain <X>           Nur Tasks mit Domain X
    -l, --layer <X>            Nur Tasks mit Layer X
    --mvp / --no-mvp           Nur MVP / Nur Nicht-MVP
    -p, --prio <X>             Nur Tasks mit Priorität X
    --bugs                     Bugs statt Tasks anzeigen

  show <ID>                    Task-Details anzeigen

  claim <ID>                   Task claimen (gibt Key zurück)
  claim <key>                  Claim freigeben

  edit <ID> [ID2...] [--key <key>] [options]  Task(s) bearbeiten
    --key <key>                Nur erforderlich bei geclaimten Tasks (🔒)
    --status <X>               Neuer Status
    --deps <X>                 Neue Dependencies (komma-separiert)
    --beschreibung <X>         Neue Beschreibung
    --prio <X>                 Neue Priorität
    --mvp / --no-mvp           MVP-Flag setzen

  add --tasks '<JSON>'         Neue Tasks erstellen
  add --bugs '<JSON>'          Neue Bugs erstellen

  remove <ID> [ID2...]         Task(s) oder Bug(s) löschen
    --resolve                  Bei Bug: Aus Task-Dependencies entfernen

  fix-deps                     Tasks mit unerfüllten Dependencies auf ⛔ setzen

  help                         Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task/task.mjs sort encounter --mvp
  node scripts/task/task.mjs sort NPCs                     # Sucht in Domain
  node scripts/task/task.mjs show 14
  node scripts/task/task.mjs claim 14
  node scripts/task/task.mjs edit 14 --status 🔶          # Ohne Claim
  node scripts/task/task.mjs edit 14 --status ✅ --key a4x2  # Mit Claim
  node scripts/task/task.mjs edit 53 54 55 --status 🔶    # Bulk Edit
  node scripts/task/task.mjs add --tasks '[{"domain":"Travel","layer":"features","beschreibung":"Test","deps":"-","specs":"Travel.md","impl":"test.ts [neu]"}]'
  node scripts/task/task.mjs remove 53 54 55              # Bulk Remove
  node scripts/task/task.mjs remove b2 --resolve
`);
}

main();
