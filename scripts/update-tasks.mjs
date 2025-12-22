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

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = join(__dirname, '..', 'docs', 'architecture', 'Development-Roadmap.md');
const DOCS_PATH = join(__dirname, '..', 'docs');
const CLAIMS_PATH = join(__dirname, '..', 'docs', 'architecture', '.task-claims.json');
const AGENT_ID_PATH = join(__dirname, '..', '.my-agent-id');

const VALID_STATUSES = ['⬜', '✅', '⚠️', '🔶', '🔒'];
const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Stunden

// ============================================================================
// Agent-ID Management
// ============================================================================

/**
 * Holt Agent-ID aus Datei oder generiert neue
 */
function getOrCreateAgentIdFromFile() {
  if (existsSync(AGENT_ID_PATH)) {
    return readFileSync(AGENT_ID_PATH, 'utf-8').trim();
  }

  // Neue ID generieren: agent-XXXXXXXX (8 hex chars)
  const id = 'agent-' + randomBytes(4).toString('hex');
  writeFileSync(AGENT_ID_PATH, id);
  return id;
}

/**
 * Holt Agent-ID mit Fallback-Kette:
 * 1. Umgebungsvariable CLAUDE_AGENT_ID (höchste Priorität)
 * 2. CLI-Flag --agent-id
 * 3. Datei .my-agent-id (generiert bei Bedarf)
 */
function getAgentId(cliAgentId = null) {
  // 1. Umgebungsvariable (höchste Priorität)
  if (process.env.CLAUDE_AGENT_ID) {
    return process.env.CLAUDE_AGENT_ID;
  }

  // 2. CLI-Flag
  if (cliAgentId) {
    return cliAgentId;
  }

  // 3. Datei (Fallback, generiert bei Bedarf)
  return getOrCreateAgentIdFromFile();
}

// ============================================================================
// Claims Management
// ============================================================================

/**
 * Lädt Claims aus der JSON-Datei
 */
function loadClaims() {
  if (!existsSync(CLAIMS_PATH)) {
    return {};
  }
  try {
    const content = readFileSync(CLAIMS_PATH, 'utf-8');
    const data = JSON.parse(content);
    return data.claims || {};
  } catch {
    return {};
  }
}

/**
 * Speichert Claims in die JSON-Datei
 */
function saveClaims(claims) {
  writeFileSync(CLAIMS_PATH, JSON.stringify({ claims }, null, 2));
}

/**
 * Prüft und entfernt abgelaufene Claims (>2h)
 */
function checkClaimExpiry(claims) {
  const now = Date.now();
  const expired = [];

  for (const [taskId, claim] of Object.entries(claims)) {
    const claimTime = new Date(claim.timestamp).getTime();
    if (now - claimTime > CLAIM_EXPIRY_MS) {
      expired.push({ taskId, owner: claim.owner });
      delete claims[taskId];
    }
  }

  return expired;
}

/**
 * Formatiert verbleibende Zeit bis Claim-Ablauf
 */
function formatTimeRemaining(timestamp) {
  const claimTime = new Date(timestamp).getTime();
  const expiresAt = claimTime + CLAIM_EXPIRY_MS;
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) return 'abgelaufen';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================================
// Task-ID Parsing (wiederverwendbar)
// ============================================================================

/**
 * Parst eine Task-ID (z.B. "428", "428b", "2917a")
 */
function parseTaskId(raw) {
  const trimmed = String(raw).trim();
  // Bug-ID (z.B. "b4")
  if (/^b\d+$/.test(trimmed)) return trimmed;
  // Alphanumerische ID (z.B. "428b")
  if (/^\d+[a-z]$/i.test(trimmed)) return trimmed.toLowerCase();
  // Reine Zahl
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parst Dependencies aus einem String
 */
function parseDeps(depsRaw) {
  if (!depsRaw || depsRaw === '-') return [];

  const deps = [];
  const matches = depsRaw.matchAll(/#(\d+[a-z]?)|b(\d+)/gi);

  for (const match of matches) {
    if (match[1]) {
      deps.push(parseTaskId(match[1]));
    } else if (match[2]) {
      deps.push(`b${match[2]}`);
    }
  }

  return deps.filter(d => d !== null);
}

/**
 * Formatiert Dependencies für Ausgabe
 */
function formatDeps(deps) {
  if (!deps || deps.length === 0) return '-';
  return deps.map(d => formatId(d)).join(', ');
}

/**
 * Formatiert eine Task-/Bug-ID für Ausgabe
 */
function formatId(id) {
  if (typeof id === 'number') return `#${id}`;
  if (typeof id === 'string' && id.startsWith('b')) return id;
  return `#${id}`;
}

// ============================================================================
// Roadmap Parsing
// ============================================================================

/**
 * Parst eine Task-Zeile aus der Markdown-Tabelle
 */
function parseTaskLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 9) return null;

  const number = parseTaskId(cells[0]);
  if (number === null) return null;
  // Bug-IDs werden in parseBugLine behandelt
  if (typeof number === 'string' && number.startsWith('b')) return null;

  return {
    number,
    status: cells[1],
    bereich: cells[2],
    beschreibung: cells[3],
    prio: cells[4],
    mvp: cells[5],
    depsRaw: cells[6],
    deps: parseDeps(cells[6]),
    spec: cells[7],
    imp: cells[8],
    isBug: false
  };
}

/**
 * Parst eine Bug-Zeile aus der Markdown-Tabelle
 */
function parseBugLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 4) return null;

  const match = cells[0].match(/^b(\d+)$/);
  if (!match) return null;

  return {
    number: cells[0],
    beschreibung: cells[1],
    prio: cells[2],
    depsRaw: cells[3],
    deps: parseDeps(cells[3]),
    isBug: true
  };
}

/**
 * Parst die Roadmap mit Zeilen-Tracking
 */
function parseRoadmapWithLineInfo(content) {
  const lines = content.split('\n');
  const tasks = [];
  const bugs = [];
  let inTaskTable = false;
  let inBugTable = false;
  let taskTableStart = -1;
  let bugTableStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('| # | Status |')) {
      inTaskTable = true;
      inBugTable = false;
      taskTableStart = i;
      continue;
    }
    if (line.includes('| b# |')) {
      inBugTable = true;
      inTaskTable = false;
      bugTableStart = i;
      continue;
    }
    if (line.match(/^\|[\s:-]+\|/)) continue;
    if (!line.startsWith('|')) {
      inTaskTable = false;
      inBugTable = false;
      continue;
    }

    if (inTaskTable) {
      const task = parseTaskLine(line);
      if (task) {
        task.lineIndex = i;
        task.originalLine = line;
        tasks.push(task);
      }
    }
    if (inBugTable) {
      const bug = parseBugLine(line);
      if (bug) {
        bug.lineIndex = i;
        bug.originalLine = line;
        bugs.push(bug);
      }
    }
  }

  const itemMap = new Map([
    ...tasks.map(t => [t.number, t]),
    ...bugs.map(b => [b.number, b])
  ]);

  return { tasks, bugs, lines, itemMap, taskTableStart, bugTableStart };
}

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
    beschreibung: null,
    bereich: null,
    prio: null,
    mvp: null,
    spec: null,
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
    } else if (arg === '--split') {
      opts.split = [argv[++i], argv[++i]];
    } else if (arg === '--add') {
      opts.add = true;
    } else if (arg === '--bereich') {
      opts.bereich = argv[++i];
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
  <ID> --claim               Task claimen (generiert automatisch ID)
  <ID> --unclaim             Claim freigeben
  <ID> --check-claim         Claim-Status prüfen
  <ID> --split "A" "B"       Task in #Xa und #Xb splitten

BUG-MANAGEMENT:
  --add-bug "Beschreibung"   Neuen Bug hinzufügen
    --prio <prio>            Priorität (hoch, mittel, niedrig)
    --deps "<deps>"          Dependencies
  <bugId> --beschreibung     Bug-Beschreibung ändern
  --delete-bug <bugId>       Bug löschen

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

AGENT-ID PRIORITÄT:
  1. CLAUDE_AGENT_ID Umgebungsvariable (höchste)
  2. --agent-id CLI-Flag
  3. .my-agent-id Datei (niedrigste)

BEISPIELE:
  node scripts/update-tasks.mjs 428 --status ✅
  node scripts/update-tasks.mjs 428 --claim
  node scripts/update-tasks.mjs 428 --deps "#100, #202"
  node scripts/update-tasks.mjs 428 --no-deps
  node scripts/update-tasks.mjs --add-bug "Crash beim Laden" --prio hoch
  node scripts/update-tasks.mjs --add --bereich Travel --beschreibung "Neue Feature" --prio hoch
  node scripts/update-tasks.mjs 428 --split "UI fertig" "Backend TODO"
`);
}

// ============================================================================
// Multi-File Sync
// ============================================================================

/**
 * Findet alle Markdown-Dateien rekursiv
 */
function findMarkdownFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

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
 * Aktualisiert eine Doc-File Task-Zeile (nur Deps)
 */
function updateDocTaskLine(line, newDeps) {
  // Doc-Format: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
  const cells = line.split('|');
  if (cells.length < 7) return line;

  // cells[5] = Deps (1-indexed wegen führendem |)
  cells[5] = ` ${newDeps} `;

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
  const cells = line.split('|');
  if (cells.length < 10) return line;

  // cells[2] = Status, cells[7] = Deps
  if (updates.status !== undefined) {
    cells[2] = ` ${updates.status} `;
  }
  if (updates.deps !== undefined) {
    cells[7] = ` ${updates.deps} `;
  }

  return cells.join('|');
}

/**
 * Aktualisiert eine Bug-Zeile in der Roadmap
 */
function updateRoadmapBugLine(line, updates) {
  // Bug-Format: | b# | Beschreibung | Prio | Deps |
  const cells = line.split('|');
  if (cells.length < 5) return line;

  if (updates.beschreibung !== undefined) {
    cells[2] = ` ${updates.beschreibung} `;
  }
  if (updates.prio !== undefined) {
    cells[3] = ` ${updates.prio} `;
  }
  if (updates.deps !== undefined) {
    cells[4] = ` ${updates.deps} `;
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
  const roadmapData = parseRoadmapWithLineInfo(content);

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
  if (updates.prio) {
    updatePayload.prio = updates.prio;
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

  // Doc-Files aktualisieren (nur bei Deps-Änderung)
  if (updates.deps && !item.isBug) {
    results.docs = updateDocsForTask(taskId, updates.deps, options.dryRun);
  }

  results.success = true;
  return results;
}

/**
 * Prüft Claim-Status einer Task
 */
function checkClaimStatus(taskId, agentId = null) {
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
  const roadmapData = parseRoadmapWithLineInfo(content);

  // Nächste Bug-ID finden
  const maxId = Math.max(0, ...roadmapData.bugs.map(b => parseInt(b.number.slice(1), 10)));
  const newId = `b${maxId + 1}`;

  // Neue Bug-Zeile erstellen
  const depsStr = deps || '-';
  const prioStr = prio || 'hoch';
  const newLine = `| ${newId} | ${beschreibung} | ${prioStr} | ${depsStr} |`;

  const lines = [...roadmapData.lines];
  let insertIndex = -1;

  // Bug-Tabelle finden und Zeile einfügen
  if (roadmapData.bugTableStart >= 0) {
    const lastBug = roadmapData.bugs[roadmapData.bugs.length - 1];
    if (lastBug) {
      insertIndex = lastBug.lineIndex + 1;
      lines.splice(insertIndex, 0, newLine);
    }
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
  const roadmapData = parseRoadmapWithLineInfo(content);

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
 * Löscht einen Bug
 * Entfernt den Bug automatisch aus den Deps aller referenzierenden Tasks:
 * - Bug-ID aus Task-Deps entfernen
 * - Status wird NICHT automatisch geändert (Agent prüft manuell)
 * - Synchronisiert Deps-Änderungen in allen Docs
 */
function deleteBug(bugId, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmapWithLineInfo(content);

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
 * Splittet eine Task in zwei Teile
 */
function splitTask(taskId, partADesc, partBDesc, dryRun) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const roadmapData = parseRoadmapWithLineInfo(content);

  const task = roadmapData.itemMap.get(taskId);
  if (!task || task.isBug) {
    return { success: false, error: `Task ${formatId(taskId)} nicht gefunden` };
  }

  // Neue IDs
  const idA = `${taskId}a`;
  const idB = `${taskId}b`;

  // Neue Zeilen erstellen
  // | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
  const cells = task.originalLine.split('|');

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

  return {
    success: true,
    original: taskId,
    partA: { id: idA, line: lineA },
    partB: { id: idB, line: lineB },
    docs: docResults
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
    console.log(`\nDeine Agent-ID: ${id}`);
    if (process.env.CLAUDE_AGENT_ID) {
      console.log(`   (Quelle: Umgebungsvariable CLAUDE_AGENT_ID)`);
    } else if (opts.agentId) {
      console.log(`   (Quelle: CLI-Flag --agent-id)`);
    } else {
      console.log(`   (Quelle: Datei .my-agent-id)`);
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

  // Bug löschen
  if (opts.deleteBug) {
    const result = deleteBug(opts.deleteBug, opts.dryRun);
    if (result.success) {
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!opts.quiet) {
        console.log(`\n✅ Bug ${result.bugId} gelöscht.`);
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
    const status = checkClaimStatus(opts.taskId, opts.agentId);
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
  if (opts.deps !== undefined) updates.deps = opts.deps || '-';
  if (opts.claim) updates.claim = true;
  if (opts.unclaim) updates.unclaim = true;
  if (opts.beschreibung) updates.beschreibung = opts.beschreibung;
  if (opts.prio) updates.prio = opts.prio;

  if (Object.keys(updates).length === 0) {
    console.error('\n❌ Fehler: Keine Änderung angegeben.\n');
    console.error('Nutze --status, --deps, --claim, --unclaim, etc.');
    process.exit(1);
  }

  const results = updateTask(opts.taskId, updates, { dryRun: opts.dryRun, agentId: opts.agentId });
  formatOutput(results, opts);

  if (!results.success) {
    process.exit(1);
  }
}

main();
