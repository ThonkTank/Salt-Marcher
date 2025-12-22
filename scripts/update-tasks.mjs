#!/usr/bin/env node
/**
 * Task-Update-Skript
 *
 * Aktualisiert Task-Status und Dependencies in Roadmap + Doc-Files.
 * Unterstützt Claiming, Bug-Management und Task-Splitting.
 *
 * Ausführung:
 *   node scripts/update-tasks.mjs 428 --status ✅
 *   node scripts/update-tasks.mjs 428 --claim
 *   node scripts/update-tasks.mjs 428 --deps "#100, #202"
 *   node scripts/update-tasks.mjs --add-bug "Beschreibung" --prio hoch
 *   node scripts/update-tasks.mjs 428 --split "Teil A" "Teil B"
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

import {
  ROADMAP_PATH, DOCS_PATH, CLAIMS_PATH, CLAIM_EXPIRY_MS, VALID_STATUSES,
  parseTaskId, parseDeps, formatId, formatDeps,
  getAgentId, loadClaims, saveClaims, checkClaimExpiry, formatTimeRemaining,
  parseRoadmap, findMarkdownFiles
} from './task-utils.mjs';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv) {
  const opts = {
    taskId: null,
    status: null,
    deps: null,
    claim: false,
    unclaim: false,
    checkClaim: false,
    whoami: false,
    agentId: null,  // CLI-Flag für Agent-ID
    addBug: null,
    deleteBug: null,
    resolveBug: null,
    deleteTask: null,
    beschreibung: null,
    bereich: null,
    prio: null,
    mvp: null,
    spec: null,
    imp: null,
    split: null,
    add: false,
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
    } else if (arg === '--claim') {
      opts.claim = true;
    } else if (arg === '--unclaim') {
      opts.unclaim = true;
    } else if (arg === '--check-claim') {
      opts.checkClaim = true;
    } else if (arg === '--whoami') {
      opts.whoami = true;
    } else if (arg === '--agent-id') {
      opts.agentId = argv[++i];
    } else if (arg === '--add-bug') {
      opts.addBug = argv[++i];
    } else if (arg === '--delete-bug') {
      opts.deleteBug = argv[++i];
    } else if (arg === '--resolve-bug') {
      opts.resolveBug = argv[++i];
    } else if (arg === '--delete-task') {
      opts.deleteTask = argv[++i];
    } else if (arg === '--beschreibung') {
      opts.beschreibung = argv[++i];
    } else if (arg === '--bereich') {
      opts.bereich = argv[++i];
    } else if (arg === '--prio') {
      opts.prio = argv[++i];
    } else if (arg === '--mvp') {
      opts.mvp = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '--imp') {
      opts.imp = argv[++i];
    } else if (arg === '--split') {
      opts.split = [argv[++i], argv[++i]];
    } else if (arg === '--add') {
      opts.add = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      const parsed = parseTaskId(arg);
      if (parsed !== null) opts.taskId = parsed;
    }
  }

  return opts;
}

/**
 * Zeigt Hilfe an
 */
function showHelp() {
  console.log(`
Task-Update-Skript

USAGE:
  node scripts/update-tasks.mjs <ID> [OPTIONS]
  node scripts/update-tasks.mjs --add-bug "Beschreibung" [OPTIONS]
  node scripts/update-tasks.mjs --whoami

TASK-UPDATES:
  <ID> --status <symbol>     Status ändern (⬜, ✅, ⚠️, 🔶, 🔒)
  <ID> --deps "<deps>"       Dependencies setzen (z.B. "#100, #202, b4")
  <ID> --no-deps             Dependencies entfernen (setzt auf "-")
  <ID> --beschreibung "..."  Beschreibung ändern
  <ID> --bereich <bereich>   Bereich ändern (z.B. Travel, Map)
  <ID> --prio <prio>         Priorität ändern (hoch, mittel, niedrig)
  <ID> --mvp <Ja|Nein>       MVP-Status ändern
  <ID> --spec "File.md#..."  Spec-Referenz ändern
  <ID> --imp "file:func()"   Implementierungs-Details ändern
  <ID> --claim               Task claimen (generiert automatisch ID)
  <ID> --unclaim             Claim freigeben
  <ID> --check-claim         Claim-Status prüfen
  <ID> --split "A" "B"       Task in #Xa und #Xb splitten
                             ⚠️  Zeigt Warnung wenn andere Tasks diese referenzieren
  --delete-task <ID>         Task unwiderruflich löschen (mit Dep-Bereinigung)

BUG-MANAGEMENT:
  --add-bug "Beschreibung"   Neuen Bug hinzufügen
    --prio <prio>            Priorität (hoch, mittel, niedrig)
    --deps "<deps>"          Dependencies
  <bugId> --beschreibung     Bug-Beschreibung ändern
  --resolve-bug <bugId>      Bug als gelöst markieren (✅) - empfohlen
  --delete-bug <bugId>       Bug unwiderruflich löschen (Warnung)

NEUE TASK:
  --add                      Neue Task hinzufügen
    --bereich <bereich>      Bereich (z.B. Travel, Map)
    --beschreibung "..."     Beschreibung
    --prio <prio>            Priorität
    --mvp <Ja|Nein>          MVP-relevant?
    --deps "<deps>"          Dependencies
    --spec "File.md#anchor"  Spec-Referenz

SONSTIGES:
  --whoami                   Eigene Agent-ID anzeigen
  --agent-id <id>            Agent-ID explizit setzen (überschreibt .my-agent-id)
  --dry-run, -n              Nur Vorschau, keine Änderungen
  --json                     JSON-Ausgabe
  --quiet, -q                Minimale Ausgabe
  -h, --help                 Diese Hilfe anzeigen

AGENT-ID (PFLICHT für Claims):
  1. CLAUDE_AGENT_ID Umgebungsvariable (höchste Priorität)
  2. --agent-id CLI-Flag

  WICHTIG: Ohne Agent-ID schlagen --claim und --unclaim fehl!
  Beispiel: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"

BEISPIELE:
  node scripts/update-tasks.mjs 428 --status ✅
  node scripts/update-tasks.mjs 428 --claim
  node scripts/update-tasks.mjs 428 --deps "#100, #202"
  node scripts/update-tasks.mjs 428 --no-deps
  node scripts/update-tasks.mjs 428 --beschreibung "Neue Beschreibung"
  node scripts/update-tasks.mjs 428 --prio hoch --mvp Ja
  node scripts/update-tasks.mjs 428 --imp "travel.ts:startTravel()"
  node scripts/update-tasks.mjs --add-bug "Crash beim Laden" --prio hoch
  node scripts/update-tasks.mjs --resolve-bug b1
  node scripts/update-tasks.mjs --add --bereich Travel --beschreibung "Neue Feature" --prio hoch
  node scripts/update-tasks.mjs 428 --split "UI fertig" "Backend TODO"
  node scripts/update-tasks.mjs --delete-task 428
`);
}

// ============================================================================
// Multi-File Sync
// ============================================================================

/**
 * Findet alle Doc-Files die eine bestimmte Task enthalten
 */
function findDocsContainingTask(taskId) {
  const matchingDocs = [];
  const allDocs = findMarkdownFiles(DOCS_PATH);
  const idStr = String(taskId);

  for (const filePath of allDocs) {
    if (filePath.endsWith('Development-Roadmap.md')) continue;

    const content = readFileSync(filePath, 'utf-8');
    // Pattern: | 428 | oder | 428b |
    const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`, 'm');

    if (pattern.test(content)) {
      matchingDocs.push({
        path: filePath,
        name: basename(filePath),
        content
      });
    }
  }

  return matchingDocs;
}

/**
 * Aktualisiert eine Doc-File Task-Zeile
 * @param {string} line - Die Zeile
 * @param {Object|string} updates - Updates-Objekt oder (legacy) nur newDeps string
 */
function updateDocTaskLine(line, updates) {
  // Doc-Format: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
  // cells[0]='' [1]=# [2]=Beschreibung [3]=Prio [4]=MVP [5]=Deps [6]=Referenzen [7]=''
  const cells = line.split('|');
  if (cells.length < 7) return line;

  // Legacy-Support: wenn updates ein String ist, ist es nur die Deps
  if (typeof updates === 'string') {
    cells[5] = ` ${updates} `;
    return cells.join('|');
  }

  // Neue Felder updaten
  if (updates.beschreibung !== undefined) cells[2] = ` ${updates.beschreibung} `;
  if (updates.prio !== undefined) cells[3] = ` ${updates.prio} `;
  if (updates.mvp !== undefined) cells[4] = ` ${updates.mvp} `;
  if (updates.deps !== undefined) cells[5] = ` ${updates.deps} `;

  return cells.join('|');
}

/**
 * Aktualisiert alle Doc-Files die eine Task enthalten
 */
function updateDocsForTask(taskId, newDeps, dryRun) {
  const docs = findDocsContainingTask(taskId);
  const results = [];
  const idStr = String(taskId);

  for (const doc of docs) {
    const lines = doc.content.split('\n');
    let modified = false;
    let beforeLine = null;
    let afterLine = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

      if (pattern.test(line)) {
        beforeLine = line;
        afterLine = updateDocTaskLine(line, newDeps);

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

    if (modified) {
      results.push({
        file: doc.name,
        path: doc.path,
        modified,
        before: beforeLine,
        after: afterLine
      });
    }
  }

  return results;
}

// ============================================================================
// Roadmap Update Functions
// ============================================================================

/**
 * Aktualisiert eine Task-Zeile in der Roadmap
 */
function updateRoadmapTaskLine(line, updates) {
  // Roadmap-Format: | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
  // cells[0]='' [1]=# [2]=Status [3]=Bereich [4]=Beschreibung [5]=Prio [6]=MVP [7]=Deps [8]=Spec [9]=Imp [10]=''
  const cells = line.split('|');
  if (cells.length < 10) return line;

  if (updates.status !== undefined) cells[2] = ` ${updates.status} `;
  if (updates.bereich !== undefined) cells[3] = ` ${updates.bereich} `;
  if (updates.beschreibung !== undefined) cells[4] = ` ${updates.beschreibung} `;
  if (updates.prio !== undefined) cells[5] = ` ${updates.prio} `;
  if (updates.mvp !== undefined) cells[6] = ` ${updates.mvp} `;
  if (updates.deps !== undefined) cells[7] = ` ${updates.deps} `;
  if (updates.spec !== undefined) cells[8] = ` ${updates.spec} `;
  if (updates.imp !== undefined) cells[9] = ` ${updates.imp} `;

  return cells.join('|');
}

/**
 * Aktualisiert eine Bug-Zeile in der Roadmap
 */
function updateRoadmapBugLine(line, updates) {
  // Bug-Format: | b# | Status | Beschreibung | Prio | Deps |
  const cells = line.split('|');
  if (cells.length < 6) return line;

  if (updates.status !== undefined) {
    cells[2] = ` ${updates.status} `;
  }
  if (updates.beschreibung !== undefined) {
    cells[3] = ` ${updates.beschreibung} `;
  }
  if (updates.prio !== undefined) {
    cells[4] = ` ${updates.prio} `;
  }
  if (updates.deps !== undefined) {
    cells[5] = ` ${updates.deps} `;
  }

  return cells.join('|');
}

// ============================================================================
// Main Update Logic
// ============================================================================

/**
 * Hauptfunktion: Task/Bug aktualisieren
 */
function updateTask(taskId, updates, options) {
  const results = {
    success: false,
    roadmap: { modified: false, before: null, after: null, statusChange: null },
    docs: [],
    claim: null,
    errors: []
  };

  // Roadmap laden
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true,
    returnItemMap: true
  });

  // Task/Bug finden
  const item = roadmapData.itemMap.get(taskId);
  if (!item) {
    results.errors.push(`Task ${formatId(taskId)} nicht in Roadmap gefunden`);
    return results;
  }

  // Status validieren
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    results.errors.push(`Ungültiger Status: ${updates.status}. Gültig: ${VALID_STATUSES.join(', ')}`);
    return results;
  }

  // Deps validieren
  if (updates.deps) {
    const depIds = parseDeps(updates.deps);
    for (const depId of depIds) {
      if (depId === taskId || String(depId) === String(taskId)) {
        results.errors.push(`Task kann nicht von sich selbst abhängen`);
        return results;
      }
      if (!roadmapData.itemMap.has(depId)) {
        results.errors.push(`Dependency ${formatId(depId)} nicht gefunden`);
      }
    }
  }

  if (results.errors.length > 0) return results;

  // Claims laden und prüfen
  const claims = loadClaims();
  const myId = getAgentId(options.agentId);
  const expired = checkClaimExpiry(claims);

  // Claim-Management
  if (updates.claim) {
    // Agent-ID ist PFLICHT für Claims
    if (!myId) {
      results.errors.push(
        'Claim erfordert Agent-ID. Setze CLAUDE_AGENT_ID oder nutze --agent-id.\n' +
        'Beispiel: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"'
      );
      return results;
    }

    const existingClaim = claims[taskId];
    if (existingClaim) {
      if (existingClaim.owner === myId) {
        results.claim = { action: 'already_mine', owner: myId };
      } else {
        const remaining = formatTimeRemaining(existingClaim.timestamp);
        results.errors.push(`Task ${formatId(taskId)} bereits geclaimed von ${existingClaim.owner} (noch ${remaining})`);
        return results;
      }
    } else {
      claims[taskId] = { owner: myId, timestamp: new Date().toISOString() };
      results.claim = { action: 'claimed', owner: myId };
      updates.status = '🔒';
    }
  }

  if (updates.unclaim) {
    // Agent-ID ist PFLICHT für Unclaim
    if (!myId) {
      results.errors.push(
        'Unclaim erfordert Agent-ID. Setze CLAUDE_AGENT_ID oder nutze --agent-id.\n' +
        'Beispiel: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"'
      );
      return results;
    }

    const existingClaim = claims[taskId];
    if (existingClaim) {
      if (existingClaim.owner === myId) {
        delete claims[taskId];
        results.claim = { action: 'unclaimed', owner: myId };
        if (!updates.status) {
          updates.status = '⬜';
        }
      } else {
        results.errors.push(`Nur der Owner (${existingClaim.owner}) kann den Claim freigeben`);
        return results;
      }
    }
  }

  // Status-Änderung entfernt Claim (außer auf 🔒)
  if (updates.status && updates.status !== '🔒' && claims[taskId]) {
    const oldClaim = claims[taskId];
    delete claims[taskId];
    results.claim = { action: 'removed_by_status', owner: oldClaim.owner };
  }

  // Roadmap-Zeile aktualisieren
  const lines = [...roadmapData.lines];
  results.roadmap.before = item.originalLine;

  const updatePayload = {};
  if (updates.status) {
    updatePayload.status = updates.status;
    results.roadmap.statusChange = { from: item.status, to: updates.status };
  }
  if (updates.deps) {
    updatePayload.deps = updates.deps;
  }
  if (updates.beschreibung) {
    updatePayload.beschreibung = updates.beschreibung;
  }
  if (updates.bereich) {
    updatePayload.bereich = updates.bereich;
  }
  if (updates.prio) {
    updatePayload.prio = updates.prio;
  }
  if (updates.mvp) {
    updatePayload.mvp = updates.mvp;
  }
  if (updates.spec) {
    updatePayload.spec = updates.spec;
  }
  if (updates.imp) {
    updatePayload.imp = updates.imp;
  }

  let newLine;
  if (item.isBug) {
    newLine = updateRoadmapBugLine(item.originalLine, updatePayload);
  } else {
    newLine = updateRoadmapTaskLine(item.originalLine, updatePayload);
  }

  if (newLine !== item.originalLine) {
    results.roadmap.modified = true;
    results.roadmap.after = newLine;

    if (!options.dryRun) {
      lines[item.lineIndex] = newLine;
      writeFileSync(ROADMAP_PATH, lines.join('\n'));
    }
  }

  // Claims speichern
  if (!options.dryRun && (updates.claim || updates.unclaim || results.claim)) {
    saveClaims(claims);
  }

  // Doc-Files aktualisieren (bei Änderung von Beschreibung, Prio, MVP oder Deps)
  const docUpdates = {};
  if (updates.beschreibung) docUpdates.beschreibung = updates.beschreibung;
  if (updates.prio) docUpdates.prio = updates.prio;
  if (updates.mvp) docUpdates.mvp = updates.mvp;
  if (updates.deps) docUpdates.deps = updates.deps;

  if (Object.keys(docUpdates).length > 0 && !item.isBug) {
    results.docs = updateDocsForTask(taskId, docUpdates, options.dryRun);
  }

  results.success = true;
  return results;
}

/**
 * Prüft Claim-Status einer Task
 */
function checkClaimStatusFn(taskId, agentId = null) {
  const claims = loadClaims();
  const myId = getAgentId(agentId);
  checkClaimExpiry(claims);
  saveClaims(claims);

  const claim = claims[taskId];
  if (!claim) {
    return { claimed: false };
  }

  return {
    claimed: true,
    owner: claim.owner,
    isMe: claim.owner === myId,
    timestamp: claim.timestamp,
    remaining: formatTimeRemaining(claim.timestamp)
  };
}

/**
 * Fügt einen neuen Bug hinzu
 * Propagiert den Bug automatisch zu referenzierten Tasks:
 * - Fügt Bug-ID zu Task-Deps hinzu
 * - Setzt Task-Status auf ⚠️
 * - Synchronisiert Änderungen in allen Docs
 */
function addBug(beschreibung, prio, deps, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true
  });

  // Nächste Bug-ID finden
  const maxId = Math.max(0, ...roadmapData.bugs.map(b => parseInt(b.number.slice(1), 10)));
  const newId = `b${maxId + 1}`;

  // Neue Bug-Zeile erstellen
  const depsStr = deps || '-';
  const prioStr = prio || 'hoch';
  const newLine = `| ${newId} | ${beschreibung} | ${prioStr} | ${depsStr} |`;

  const lines = [...roadmapData.lines];
  let insertIndex = -1;

  // Bug-Tabelle finden und Zeile einfügen (nach dem letzten Bug)
  const lastBug = roadmapData.bugs[roadmapData.bugs.length - 1];
  if (lastBug) {
    insertIndex = lastBug.lineIndex + 1;
    lines.splice(insertIndex, 0, newLine);
  }

  // Referenzierte Tasks updaten (Bug-Propagation)
  const affectedTasks = [];
  if (deps && deps !== '-') {
    const taskRefs = parseDeps(deps);

    for (const ref of taskRefs) {
      // Nur numerische Task-IDs, keine Bugs
      if (typeof ref === 'number') {
        const task = roadmapData.tasks.find(t => t.number === ref);
        if (task) {
          // Bug zu Task-Deps hinzufügen
          const newDeps = task.depsRaw === '-'
            ? newId
            : `${task.depsRaw}, ${newId}`;

          // Status auf ⚠️ setzen
          const updatedLine = updateRoadmapTaskLine(task.originalLine, {
            status: '⚠️',
            deps: newDeps
          });

          // Zeile in lines aktualisieren (Offset beachten wegen eingefügter Bug-Zeile)
          const lineIndex = task.lineIndex + (insertIndex >= 0 && insertIndex <= task.lineIndex ? 1 : 0);
          lines[lineIndex] = updatedLine;

          affectedTasks.push({
            taskId: ref,
            oldDeps: task.depsRaw,
            newDeps,
            oldStatus: task.status,
            newStatus: '⚠️'
          });
        }
      }
    }
  }

  if (!dryRun) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'));

    // Multi-File-Sync für betroffene Tasks
    for (const affected of affectedTasks) {
      updateDocsForTask(affected.taskId, affected.newDeps, false);
    }
  }

  return {
    success: true,
    bugId: newId,
    line: newLine,
    affectedTasks,
    dryRun
  };
}

/**
 * Fügt eine neue Task hinzu
 */
function addTask(options, dryRun = false) {
  const { bereich, beschreibung, prio, mvp, deps, spec } = options;

  // Validierung
  if (!bereich || !beschreibung) {
    return { success: false, error: '--bereich und --beschreibung erforderlich' };
  }

  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    returnLines: true
  });

  // Höchste Task-Nummer finden (nur numerische IDs, keine alphanumerischen wie "428b")
  const numericIds = roadmapData.tasks
    .map(t => t.number)
    .filter(n => typeof n === 'number');
  const maxTaskId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  const newId = maxTaskId + 1;

  // Neue Zeile erstellen
  const prioStr = prio || 'mittel';
  const mvpStr = mvp || 'Nein';
  const depsStr = deps || '-';
  const specStr = spec || '-';
  const newLine = `| ${newId} | ⬜ | ${bereich} | ${beschreibung} | ${prioStr} | ${mvpStr} | ${depsStr} | ${specStr} | - |`;

  // Nach der letzten Task-Zeile einfügen
  const lines = [...roadmapData.lines];
  const lastTask = roadmapData.tasks[roadmapData.tasks.length - 1];

  if (lastTask) {
    const insertIndex = lastTask.lineIndex + 1;
    if (!dryRun) {
      lines.splice(insertIndex, 0, newLine);
      writeFileSync(ROADMAP_PATH, lines.join('\n'));
    }
  }

  return {
    success: true,
    taskId: newId,
    line: newLine,
    dryRun
  };
}

/**
 * Reverse-Lookup: Findet alle Tasks und Bugs, die eine ID in ihren Deps haben
 * @param {string|number} targetId - Die gesuchte ID (z.B. "428", "b4")
 * @param {Object} roadmapData - Geparstes Roadmap-Objekt
 * @returns {Array<{id: string|number, type: 'task'|'bug', depsRaw: string}>}
 */
function findTasksReferencingId(targetId, roadmapData) {
  const results = [];
  const targetStr = String(targetId);

  // Tasks durchsuchen
  for (const task of roadmapData.tasks) {
    const refs = parseDeps(task.depsRaw);
    if (refs.some(r => String(r) === targetStr)) {
      results.push({
        id: task.number,
        type: 'task',
        depsRaw: task.depsRaw,
        beschreibung: task.beschreibung,
        lineIndex: task.lineIndex
      });
    }
  }

  // Bugs durchsuchen
  for (const bug of roadmapData.bugs) {
    const refs = parseDeps(bug.depsRaw);
    if (refs.some(r => String(r) === targetStr)) {
      results.push({
        id: bug.number,
        type: 'bug',
        depsRaw: bug.depsRaw,
        beschreibung: bug.beschreibung,
        lineIndex: bug.lineIndex
      });
    }
  }

  return results;
}

/**
 * Löscht einen Bug
 * Entfernt den Bug automatisch aus den Deps aller referenzierenden Tasks:
 * - Bug-ID aus Task-Deps entfernen
 * - Status wird NICHT automatisch geändert (Agent prüft manuell)
 * - Synchronisiert Deps-Änderungen in allen Docs
 */
function deleteBug(bugId, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true
  });

  const bug = roadmapData.bugs.find(b => b.number === bugId);
  if (!bug) {
    return { success: false, error: `Bug ${bugId} nicht gefunden` };
  }

  const lines = [...roadmapData.lines];

  // Tasks finden, die diesen Bug in ihren Deps haben (Reverse-Lookup)
  const affectedTasks = [];
  for (const task of roadmapData.tasks) {
    const refs = parseDeps(task.depsRaw);
    if (refs.includes(bugId)) {
      // Bug aus Deps entfernen
      const newRefs = refs.filter(r => r !== bugId);
      const newDeps = formatDeps(newRefs);

      // Nur Deps ändern, Status bleibt unverändert (Agent prüft manuell)
      const updatedLine = updateRoadmapTaskLine(task.originalLine, {
        deps: newDeps
      });

      lines[task.lineIndex] = updatedLine;

      affectedTasks.push({
        taskId: task.number,
        oldDeps: task.depsRaw,
        newDeps,
        status: task.status
      });
    }
  }

  // Bug-Zeile löschen (NACH Task-Updates wegen Index-Stabilität)
  lines.splice(bug.lineIndex, 1);

  if (!dryRun) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'));

    // Multi-File-Sync für betroffene Tasks
    for (const affected of affectedTasks) {
      updateDocsForTask(affected.taskId, affected.newDeps, false);
    }
  }

  return {
    success: true,
    bugId,
    deletedLine: bug.originalLine,
    affectedTasks,
    dryRun
  };
}

/**
 * Markiert einen Bug als gelöst (✅)
 * - Setzt Bug-Status auf ✅
 * - Entfernt Bug aus Task-Dependencies
 * - Task-Status bleibt unverändert (Agent prüft manuell)
 * - Synchronisiert Deps-Änderungen in allen Docs
 */
function resolveBug(bugId, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true
  });

  const bug = roadmapData.bugs.find(b => b.number === bugId);
  if (!bug) {
    return { success: false, error: `Bug ${bugId} nicht gefunden` };
  }

  if (bug.status === '✅') {
    return { success: false, error: `Bug ${bugId} ist bereits gelöst` };
  }

  const lines = [...roadmapData.lines];

  // Bug-Status auf ✅ setzen
  const updatedBugLine = updateRoadmapBugLine(bug.originalLine, { status: '✅' });
  lines[bug.lineIndex] = updatedBugLine;

  // Tasks finden, die diesen Bug in ihren Deps haben (Reverse-Lookup)
  const affectedTasks = [];
  for (const task of roadmapData.tasks) {
    const refs = parseDeps(task.depsRaw);
    if (refs.includes(bugId)) {
      // Bug aus Deps entfernen
      const newRefs = refs.filter(r => r !== bugId);
      const newDeps = formatDeps(newRefs);

      // Nur Deps ändern, Status bleibt unverändert (Agent prüft manuell)
      const updatedLine = updateRoadmapTaskLine(task.originalLine, {
        deps: newDeps
      });

      lines[task.lineIndex] = updatedLine;

      affectedTasks.push({
        taskId: task.number,
        oldDeps: task.depsRaw,
        newDeps,
        status: task.status
      });
    }
  }

  if (!dryRun) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'));

    // Multi-File-Sync für betroffene Tasks
    for (const affected of affectedTasks) {
      updateDocsForTask(affected.taskId, affected.newDeps, false);
    }
  }

  return {
    success: true,
    bugId,
    oldStatus: bug.status,
    newStatus: '✅',
    affectedTasks,
    dryRun
  };
}

/**
 * Löscht eine Task
 * Entfernt die Task automatisch aus den Deps aller referenzierenden Tasks/Bugs:
 * - Task-ID aus Deps entfernen
 * - Synchronisiert Deps-Änderungen in allen Docs
 * - Löscht Task-Zeilen aus Doc-Dateien
 */
function deleteTask(taskId, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true,
    returnItemMap: true
  });

  const task = roadmapData.itemMap.get(taskId);
  if (!task || task.isBug) {
    return { success: false, error: `Task ${formatId(taskId)} nicht gefunden` };
  }

  const lines = [...roadmapData.lines];
  const taskIdStr = String(taskId);

  // Reverse-Lookup: Alle Items finden, die diese Task referenzieren
  const referencingItems = findTasksReferencingId(taskId, roadmapData);

  // Deps in referenzierenden Items bereinigen
  const affectedItems = [];
  for (const item of referencingItems) {
    const refs = parseDeps(item.depsRaw);
    const newRefs = refs.filter(r => String(r) !== taskIdStr);
    const newDeps = formatDeps(newRefs);

    // Zeile updaten
    const originalItem = item.type === 'bug'
      ? roadmapData.bugs.find(b => b.number === item.id)
      : roadmapData.tasks.find(t => t.number === item.id);

    if (originalItem) {
      const updatedLine = item.type === 'bug'
        ? updateRoadmapBugLine(originalItem.originalLine, { deps: newDeps })
        : updateRoadmapTaskLine(originalItem.originalLine, { deps: newDeps });

      lines[item.lineIndex] = updatedLine;

      affectedItems.push({
        id: item.id,
        type: item.type,
        oldDeps: item.depsRaw,
        newDeps
      });
    }
  }

  // Task-Zeile löschen (NACH Deps-Updates wegen Index-Stabilität)
  lines.splice(task.lineIndex, 1);

  // Doc-Files: Task-Zeilen finden und löschen
  const docs = findDocsContainingTask(taskId);
  const docResults = [];

  if (!dryRun) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'));

    // Multi-File-Sync für betroffene Items
    for (const affected of affectedItems) {
      if (affected.type === 'task') {
        updateDocsForTask(affected.id, affected.newDeps, false);
      }
    }

    // Task-Zeilen aus Doc-Files löschen
    for (const doc of docs) {
      const docLines = doc.content.split('\n');
      const idStr = String(taskId);
      let modified = false;

      for (let i = docLines.length - 1; i >= 0; i--) {
        const line = docLines[i];
        const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

        if (pattern.test(line)) {
          docLines.splice(i, 1);
          modified = true;
        }
      }

      if (modified) {
        writeFileSync(doc.path, docLines.join('\n'));
        docResults.push({ file: doc.name, action: 'deleted' });
      }
    }
  } else {
    docResults.push(...docs.map(d => ({ file: d.name, action: 'would delete' })));
  }

  return {
    success: true,
    taskId,
    deletedLine: task.originalLine,
    affectedItems,
    docs: docResults,
    dryRun
  };
}

/**
 * Splittet eine Task in zwei Teile
 */
function splitTask(taskId, partADesc, partBDesc, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmap(content, {
    separateBugs: true,
    includeLineIndex: true,
    includeOriginalLine: true,
    returnLines: true,
    returnItemMap: true
  });

  const task = roadmapData.itemMap.get(taskId);
  if (!task || task.isBug) {
    return { success: false, error: `Task ${formatId(taskId)} nicht gefunden` };
  }

  // Neue IDs
  const idA = `${taskId}a`;
  const idB = `${taskId}b`;

  // Neue Zeilen erstellen
  // | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
  const lineA = [
    '',
    ` ${idA} `,
    ' ✅ ',
    ` ${task.bereich} `,
    ` ${partADesc} `,
    ` ${task.prio} `,
    ` ${task.mvp} `,
    ` ${task.depsRaw} `,
    ` ${task.spec} `,
    ` ${task.imp} `,
    ''
  ].join('|');

  const lineB = [
    '',
    ` ${idB} `,
    ' ⬜ ',
    ` ${task.bereich} `,
    ` ${partBDesc} `,
    ` ${task.prio} `,
    ` ${task.mvp} `,
    ` #${idA} `,
    ` ${task.spec} `,
    ` ${task.imp.replace(/\)$/, ') [neu]').replace(/\)(\s*\[ändern\])$/, ') [neu]')} `,
    ''
  ].join('|');

  const lines = [...roadmapData.lines];

  if (!dryRun) {
    // Original-Zeile durch zwei neue ersetzen
    lines.splice(task.lineIndex, 1, lineA, lineB);
    writeFileSync(ROADMAP_PATH, lines.join('\n'));
  }

  // Auch Doc-Files updaten
  const docs = findDocsContainingTask(taskId);
  const docResults = [];

  for (const doc of docs) {
    const docLines = doc.content.split('\n');
    const idStr = String(taskId);
    let modified = false;

    for (let i = 0; i < docLines.length; i++) {
      const line = docLines[i];
      const pattern = new RegExp(`^\\|\\s*${idStr}\\s*\\|`);

      if (pattern.test(line)) {
        // Doc-Format: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
        const docCells = line.split('|');
        const refs = docCells[6] || '';

        const docLineA = [
          '',
          ` ${idA} `,
          ` ${partADesc} `,
          docCells[3],
          docCells[4],
          docCells[5],
          refs,
          ''
        ].join('|');

        const docLineB = [
          '',
          ` ${idB} `,
          ` ${partBDesc} `,
          docCells[3],
          docCells[4],
          ` #${idA} `,
          refs,
          ''
        ].join('|');

        if (!dryRun) {
          docLines.splice(i, 1, docLineA, docLineB);
          writeFileSync(doc.path, docLines.join('\n'));
        }
        modified = true;
        docResults.push({ file: doc.name, modified: true });
        break;
      }
    }
  }

  // Reverse-Lookup: Finde alle Tasks/Bugs die diese Task referenzieren
  // (für Warnung - Agent muss diese manuell auf #Xa oder #Xb umstellen)
  const referencingItems = findTasksReferencingId(taskId, roadmapData);

  return {
    success: true,
    original: taskId,
    partA: { id: idA, line: lineA },
    partB: { id: idB, line: lineB },
    docs: docResults,
    referencingItems: referencingItems.map(item => ({
      id: item.id,
      type: item.type,
      beschreibung: item.beschreibung,
      depsRaw: item.depsRaw
    }))
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatOutput(results, opts) {
  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.errors && results.errors.length > 0) {
    for (const error of results.errors) {
      console.error(`❌ Fehler: ${error}`);
    }
    return;
  }

  if (opts.quiet) {
    if (results.success) console.log('✅');
    return;
  }

  // Claim-Info
  if (results.claim) {
    if (results.claim.action === 'claimed') {
      console.log(`\n✅ Task geclaimed.`);
      console.log(`   Owner: ${results.claim.owner} (deine ID)`);
      const expiry = new Date(Date.now() + CLAIM_EXPIRY_MS).toISOString();
      console.log(`   Expires: ${expiry} (in 2h)`);
    } else if (results.claim.action === 'already_mine') {
      console.log(`\nℹ️  Task ist bereits von dir geclaimed.`);
    } else if (results.claim.action === 'unclaimed') {
      console.log(`\n✅ Claim freigegeben.`);
    } else if (results.claim.action === 'removed_by_status') {
      console.log(`\nℹ️  Claim entfernt (war: ${results.claim.owner})`);
    }
  }

  // Roadmap-Änderungen
  if (results.roadmap && results.roadmap.modified) {
    console.log(`\nDevelopment-Roadmap.md:`);
    if (results.roadmap.statusChange) {
      console.log(`  Status: ${results.roadmap.statusChange.from} -> ${results.roadmap.statusChange.to}`);
    }
  }

  // Doc-Änderungen
  if (results.docs && results.docs.length > 0) {
    console.log(`\nUpdated ${results.docs.length} doc file(s):`);
    for (const doc of results.docs) {
      console.log(`  - ${doc.file}`);
    }
  }

  if (results.success) {
    console.log(`\n✅ Erfolgreich.`);
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    showHelp();
    return;
  }

  // Whoami
  if (opts.whoami) {
    const id = getAgentId(opts.agentId);
    if (!id) {
      console.error('❌ Keine Agent-ID gesetzt.\n');
      console.error('Setze CLAUDE_AGENT_ID oder nutze --agent-id.');
      console.error('Beispiel: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"');
      process.exit(1);
    }
    console.log(`\nDeine Agent-ID: ${id}`);
    if (process.env.CLAUDE_AGENT_ID) {
      console.log(`   (Quelle: Umgebungsvariable CLAUDE_AGENT_ID)`);
    } else if (opts.agentId) {
      console.log(`   (Quelle: CLI-Flag --agent-id)`);
    }
    console.log('');
    return;
  }

  // Dry-Run Hinweis
  if (opts.dryRun && !opts.quiet) {
    console.log('\n🔍 DRY-RUN Modus - keine Änderungen werden gespeichert\n');
  }

  // Bug hinzufügen
  if (opts.addBug) {
    const result = addBug(opts.addBug, opts.prio, opts.deps, opts.dryRun);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!opts.quiet) {
      console.log(`\n✅ Bug ${result.bugId} hinzugefügt.`);
      console.log(`   ${result.line}`);
      if (result.affectedTasks && result.affectedTasks.length > 0) {
        console.log('\n📋 Betroffene Tasks (Status → ⚠️, Bug zu Deps hinzugefügt):');
        for (const t of result.affectedTasks) {
          console.log(`   #${t.taskId}: ${t.oldDeps} → ${t.newDeps}`);
        }
      }
      console.log('');
    }
    return;
  }

  // Bug als gelöst markieren (empfohlen)
  if (opts.resolveBug) {
    const result = resolveBug(opts.resolveBug, opts.dryRun);
    if (result.success) {
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`\n✅ Bug ${result.bugId} als gelöst markiert.`);
        console.log(`   Status: ${result.oldStatus} → ${result.newStatus}`);
        if (result.affectedTasks && result.affectedTasks.length > 0) {
          console.log('\n📋 Betroffene Tasks (Bug aus Deps entfernt):');
          for (const t of result.affectedTasks) {
            console.log(`   #${t.taskId}: ${t.oldDeps} → ${t.newDeps}`);
            console.log(`      ⚠️  Status ist noch ${t.status} - bitte manuell prüfen!`);
          }
        }
        console.log('');
      }
    } else {
      console.error(`\n❌ Fehler: ${result.error}\n`);
    }
    return;
  }

  // Bug löschen (mit Warnung)
  if (opts.deleteBug) {
    if (!opts.quiet && !opts.json) {
      console.warn('\n⚠️  WARNUNG: Bug wird unwiderruflich gelöscht!');
      console.warn('   Für Nachvollziehbarkeit besser --resolve-bug verwenden.\n');
    }
    const result = deleteBug(opts.deleteBug, opts.dryRun);
    if (result.success) {
      if (opts.json) {
        result.warning = 'Bug unwiderruflich gelöscht. Für Nachvollziehbarkeit --resolve-bug verwenden.';
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`✅ Bug ${result.bugId} gelöscht.`);
        if (result.affectedTasks && result.affectedTasks.length > 0) {
          console.log('\n📋 Betroffene Tasks (Bug aus Deps entfernt):');
          for (const t of result.affectedTasks) {
            console.log(`   #${t.taskId}: ${t.oldDeps} → ${t.newDeps}`);
            console.log(`      ⚠️  Status ist noch ${t.status} - bitte manuell prüfen!`);
          }
        }
        console.log('');
      }
    } else {
      console.error(`\n❌ Fehler: ${result.error}\n`);
    }
    return;
  }

  // Task löschen (mit Warnung und automatischer Dep-Bereinigung)
  if (opts.deleteTask) {
    const taskId = parseTaskId(opts.deleteTask);
    if (taskId === null) {
      console.error(`\n❌ Ungültige Task-ID: ${opts.deleteTask}\n`);
      process.exit(1);
    }

    if (!opts.quiet && !opts.json) {
      console.warn('\n⚠️  WARNUNG: Task wird unwiderruflich gelöscht!');
      console.warn('   Alle Referenzen auf diese Task werden automatisch bereinigt.\n');
    }

    const result = deleteTask(taskId, opts.dryRun);
    if (result.success) {
      if (opts.json) {
        result.warning = 'Task unwiderruflich gelöscht. Deps automatisch bereinigt.';
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`✅ Task ${formatId(result.taskId)} gelöscht.`);
        if (result.affectedItems && result.affectedItems.length > 0) {
          console.log('\n📋 Betroffene Items (Task aus Deps entfernt):');
          for (const item of result.affectedItems) {
            const prefix = item.type === 'bug' ? '' : '#';
            console.log(`   ${prefix}${item.id}: ${item.oldDeps} → ${item.newDeps}`);
          }
        }
        if (result.docs && result.docs.length > 0) {
          console.log(`\n📄 Doc-Dateien aktualisiert: ${result.docs.length}`);
          for (const doc of result.docs) {
            console.log(`   - ${doc.file} (${doc.action})`);
          }
        }
        console.log('');
      }
    } else {
      console.error(`\n❌ Fehler: ${result.error}\n`);
    }
    return;
  }

  // Task hinzufügen
  if (opts.add) {
    const result = addTask({
      bereich: opts.bereich,
      beschreibung: opts.beschreibung,
      prio: opts.prio,
      mvp: opts.mvp,
      deps: opts.deps,
      spec: opts.spec
    }, opts.dryRun);

    if (result.success) {
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`\n✅ Task #${result.taskId} hinzugefügt.`);
        console.log(`   ${result.line}\n`);
      }
    } else {
      console.error(`\n❌ Fehler: ${result.error}\n`);
      process.exit(1);
    }
    return;
  }

  // Check Claim
  if (opts.checkClaim && opts.taskId) {
    const status = checkClaimStatusFn(opts.taskId, opts.agentId);
    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      if (status.claimed) {
        if (status.isMe) {
          console.log(`\n✅ Task ${formatId(opts.taskId)} ist von DIR geclaimed.`);
        } else {
          console.log(`\n⚠️  Task ${formatId(opts.taskId)} ist geclaimed von: ${status.owner}`);
        }
        console.log(`   Verbleibend: ${status.remaining}\n`);
      } else {
        console.log(`\nTask ${formatId(opts.taskId)} ist nicht geclaimed.\n`);
      }
    }
    return;
  }

  // Task splitten
  if (opts.split && opts.taskId) {
    const result = splitTask(opts.taskId, opts.split[0], opts.split[1], opts.dryRun);
    if (result.success) {
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`\n✅ Task ${formatId(opts.taskId)} gesplittet:`);
        console.log(`   #${result.partA.id} [✅] ${opts.split[0]}`);
        console.log(`   #${result.partB.id} [⬜] ${opts.split[1]} (Deps: #${result.partA.id})`);
        if (result.docs.length > 0) {
          console.log(`\n   Updated ${result.docs.length} doc file(s)`);
        }

        // Warnung wenn andere Tasks diese referenzieren
        if (result.referencingItems && result.referencingItems.length > 0) {
          console.log(`\n⚠️  Folgende Tasks/Bugs referenzieren ${formatId(opts.taskId)}:`);
          for (const item of result.referencingItems) {
            const prefix = item.type === 'bug' ? '' : '#';
            console.log(`   ${prefix}${item.id}: "${item.beschreibung}" → Deps: ${item.depsRaw}`);
          }
          console.log(`\n   Bitte manuell prüfen ob diese auf #${result.partA.id} oder #${result.partB.id} zeigen sollten.`);
          console.log(`   Nutze: node scripts/update-tasks.mjs <ID> --deps "<neue deps>"`);
        }
        console.log('');
      }
    } else {
      console.error(`\n❌ Fehler: ${result.error}\n`);
    }
    return;
  }

  // Task-ID erforderlich für andere Operationen
  if (!opts.taskId && !opts.add) {
    console.error('\n❌ Fehler: Task-ID erforderlich.\n');
    console.error('Usage: node scripts/update-tasks.mjs <ID> [OPTIONS]');
    console.error('       node scripts/update-tasks.mjs --help');
    process.exit(1);
  }

  // Task aktualisieren
  const updates = {};
  if (opts.status) updates.status = opts.status;
  if (opts.deps !== null && opts.deps !== undefined) updates.deps = opts.deps || '-';
  if (opts.claim) updates.claim = true;
  if (opts.unclaim) updates.unclaim = true;
  if (opts.beschreibung) updates.beschreibung = opts.beschreibung;
  if (opts.bereich) updates.bereich = opts.bereich;
  if (opts.prio) updates.prio = opts.prio;
  if (opts.mvp) updates.mvp = opts.mvp;
  if (opts.spec) updates.spec = opts.spec;
  if (opts.imp) updates.imp = opts.imp;

  if (Object.keys(updates).length === 0) {
    console.error('\n❌ Fehler: Keine Änderung angegeben.\n');
    console.error('Nutze --status, --deps, --beschreibung, --bereich, --prio, --mvp, --spec, --imp, --claim, --unclaim, etc.');
    process.exit(1);
  }

  const results = updateTask(opts.taskId, updates, { dryRun: opts.dryRun, agentId: opts.agentId });
  formatOutput(results, opts);

  if (!results.success) {
    process.exit(1);
  }
}

main();
