#!/usr/bin/env node
/**
 * Task-Priorisierungs-Skript
 *
 * Parst die Development-Roadmap.md und gibt priorisierte Tasks aus.
 *
 * Ausführung:
 *   node scripts/prioritize-tasks.mjs                    # Top 10 aller Tasks
 *   node scripts/prioritize-tasks.mjs travel             # Filter: "travel"
 *   node scripts/prioritize-tasks.mjs -n 20              # Top 20
 *   node scripts/prioritize-tasks.mjs --status 🔶        # Nur 🔶 Status
 *   node scripts/prioritize-tasks.mjs --mvp              # Nur MVP Tasks
 *   node scripts/prioritize-tasks.mjs --prio hoch        # Nur hohe Priorität
 *   node scripts/prioritize-tasks.mjs --json             # JSON-Ausgabe
 *   node scripts/prioritize-tasks.mjs -q quest           # Quiet: nur Tabelle
 *   node scripts/prioritize-tasks.mjs --help             # Hilfe anzeigen
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { relative, join } from 'path';

import {
  ROADMAP_PATH, DOCS_PATH, CLAIMS_PATH,
  parseTaskId, formatId, isTaskId,
  loadClaims, parseRoadmap,
  STATUS_PRIORITY, MVP_PRIORITY, PRIO_PRIORITY, STATUS_ALIASES
} from './task-utils.mjs';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv) {
  const opts = {
    keywords: [],
    limit: 10,
    status: null,      // null = alle außer ✅
    mvp: null,         // null = beide, true = nur Ja, false = nur Nein
    prio: null,        // null = alle
    includeDone: false,
    includeBlocked: false,
    includeClaimed: false,
    includeResolved: false,
    json: false,
    quiet: false,
    help: false
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-n' || arg === '--limit') {
      opts.limit = parseInt(argv[++i], 10) || 10;
    } else if (arg === '-s' || arg === '--status') {
      const val = argv[++i];
      opts.status = STATUS_ALIASES[val?.toLowerCase()] || val;
    } else if (arg === '--mvp') {
      opts.mvp = true;
    } else if (arg === '--no-mvp') {
      opts.mvp = false;
    } else if (arg === '-p' || arg === '--prio') {
      opts.prio = argv[++i]?.toLowerCase();
    } else if (arg === '--include-done') {
      opts.includeDone = true;
    } else if (arg === '--include-blocked') {
      opts.includeBlocked = true;
    } else if (arg === '--include-claimed') {
      opts.includeClaimed = true;
    } else if (arg === '--include-resolved') {
      opts.includeResolved = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '-q' || arg === '--quiet') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      opts.keywords.push(arg);
    }
    i++;
  }

  return opts;
}

function showHelp() {
  console.log(`
Task-Priorisierungs-Skript

USAGE:
  node scripts/prioritize-tasks.mjs [OPTIONS] [KEYWORDS...]

KEYWORDS:
  Beliebige Wörter zum Filtern in Bereich/Beschreibung (ODER-Verknüpfung)

FILTER-OPTIONEN:
  -s, --status <status>   Nur Tasks mit diesem Status
                          Werte: 🔶, ⚠️, ⬜, ✅ (oder: done, partial, broken, open)
  --mvp                   Nur MVP-Tasks
  --no-mvp                Nur Nicht-MVP-Tasks
  -p, --prio <prio>       Nur Tasks mit dieser Priorität (hoch, mittel, niedrig)
  --include-done          Auch ✅ Tasks anzeigen
  --include-blocked       Auch Tasks mit unerfüllten Dependencies anzeigen
  --include-claimed       Auch 🔒 (geclaimed) Tasks anzeigen
  --include-resolved      Auch ✅ (gelöste) Bugs anzeigen

OUTPUT-OPTIONEN:
  -n, --limit <N>         Anzahl der Ergebnisse (default: 10, 0 = alle)
  --json                  JSON-Ausgabe statt Tabelle
  -q, --quiet             Nur Tabelle, keine Statistiken/Sortierkriterien
  -h, --help              Diese Hilfe anzeigen

BEISPIELE:
  node scripts/prioritize-tasks.mjs                     # Top 10 aller offenen Tasks
  node scripts/prioritize-tasks.mjs quest               # Tasks mit "quest"
  node scripts/prioritize-tasks.mjs -n 5 --mvp          # Top 5 MVP-Tasks
  node scripts/prioritize-tasks.mjs --status 🔶         # Nur fast fertige Tasks
  node scripts/prioritize-tasks.mjs --prio hoch -n 0    # Alle hoch-prio Tasks
  node scripts/prioritize-tasks.mjs --json travel       # JSON-Ausgabe für "travel"

SORTIERKRITERIEN:
  1. MVP: Ja > Nein (alle MVP-Tasks vor allen post-MVP-Tasks)
  2. Status: 🔶 > ⚠️ > ⬜
  3. Prio: hoch > mittel > niedrig
  4. RefCount: Tasks, von denen viele andere abhängen
  5. Task-Nummer: Niedrigere = älter = höhere Priorität

INTEGRITÄTSPRÜFUNGEN:
  Das Skript führt automatisch folgende Prüfungen durch:

  1. Zyklen-Erkennung:
     Warnt bei zirkulären Dependencies (z.B. #100 → #101 → #100).
     Betroffene Tasks können niemals "nicht blockiert" werden.

  2. Duplikat-Erkennung:
     Warnt wenn dieselbe Task-ID mehrfach in der Roadmap vorkommt.

  3. Verwaiste Referenzen:
     Warnt wenn Docs Task-IDs referenzieren, die nicht in der Roadmap existieren.

  Alle Warnungen erscheinen auch im --quiet Modus.
  Bei --json werden sie in "cycles", "duplicates" und "orphanRefs" Feldern ausgegeben.
`);
}

// ============================================================================
// Docs Scanning
// ============================================================================

/**
 * Sammelt rekursiv alle .md Dateien in einem Verzeichnis
 */
function collectMdFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectMdFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Scannt alle Docs-Dateien nach Task-Referenzen
 */
function scanDocsForTaskRefs(docsPath) {
  const results = [];
  const mdFiles = collectMdFiles(docsPath);

  // Regex für Task-Referenzen: #123, #428b, #2917a (aber nicht in URLs oder Ankern)
  const refRegex = /(?<![(\['"])#(\d{1,4}[a-z]?)(?![a-z\d-])/gi;

  for (const file of mdFiles) {
    if (file === ROADMAP_PATH) continue;

    const content = readFileSync(file, 'utf-8');
    const refs = new Set();

    let match;
    while ((match = refRegex.exec(content)) !== null) {
      const id = parseTaskId(match[1]);
      if (id !== null) {
        refs.add(id);
      }
    }

    if (refs.size > 0) {
      results.push({
        file: relative(join(docsPath, '..'), file),
        refs
      });
    }
  }

  return results;
}

/**
 * Findet verwaiste Task-Referenzen
 */
function findOrphanRefs(docsRefs, roadmapIds) {
  const orphans = [];

  for (const { file, refs } of docsRefs) {
    for (const id of refs) {
      const normalizedId = typeof id === 'number' ? id : id;
      if (!roadmapIds.has(normalizedId)) {
        orphans.push({ file, id });
      }
    }
  }

  return orphans;
}

// ============================================================================
// Integrity Checks
// ============================================================================

/**
 * Findet doppelte Task-IDs in der Roadmap
 */
function findDuplicateIds(tasks, bugs) {
  const seen = new Map();
  const duplicates = [];

  for (const task of tasks) {
    const key = `task-${task.number}`;
    if (seen.has(key)) {
      seen.get(key).push(task);
    } else {
      seen.set(key, [task]);
    }
  }

  for (const bug of bugs) {
    const key = `bug-${bug.number}`;
    if (seen.has(key)) {
      seen.get(key).push(bug);
    } else {
      seen.set(key, [bug]);
    }
  }

  for (const [, occurrences] of seen) {
    if (occurrences.length > 1) {
      duplicates.push({
        id: occurrences[0].number,
        isBug: occurrences[0].isBug,
        occurrences
      });
    }
  }

  return duplicates;
}

/**
 * Findet alle zirkulären Dependencies im Dependency-Graph
 */
function findCycles(items) {
  const graph = new Map();
  const allIds = new Set();

  for (const item of items) {
    if (item.isBug) continue;

    const taskDeps = item.deps.filter(isTaskId);
    graph.set(item.number, taskDeps);
    allIds.add(item.number);
  }

  const cycles = [];

  function dfs(node, path, pathSet) {
    if (pathSet.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }

    if (!allIds.has(node)) return;

    pathSet.add(node);
    path.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, path, pathSet);
    }

    path.pop();
    pathSet.delete(node);
  }

  for (const id of allIds) {
    dfs(id, [], new Set());
  }

  return deduplicateCycles(cycles);
}

/**
 * Normalisiert einen Zyklus für Vergleichbarkeit
 */
function normalizeCycle(cycle) {
  const c = cycle.slice(0, -1);
  if (c.length === 0) return c;

  let minIdx = 0;
  for (let i = 1; i < c.length; i++) {
    const curr = c[i];
    const min = c[minIdx];

    if (typeof curr === 'number' && typeof min === 'string') {
      minIdx = i;
    } else if (typeof curr === typeof min) {
      if (curr < min) minIdx = i;
    }
  }

  return [...c.slice(minIdx), ...c.slice(0, minIdx)];
}

/**
 * Entfernt doppelte Zyklen
 */
function deduplicateCycles(cycles) {
  const seen = new Set();
  return cycles.filter(cycle => {
    const normalized = normalizeCycle(cycle);
    const key = normalized.map(formatId).join('→');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// Sorting & Filtering
// ============================================================================

/**
 * Berechnet wie viele Items auf jede Task/Bug verweisen
 */
function calculateRefCounts(items) {
  const refCount = new Map();
  for (const item of items) {
    for (const dep of item.deps) {
      refCount.set(dep, (refCount.get(dep) || 0) + 1);
    }
  }
  return refCount;
}

/**
 * Prüft ob alle Dependencies erfüllt sind
 */
function areDepsResolved(item, statusMap) {
  return item.deps.every(dep => {
    if (typeof dep === 'string' && dep.startsWith('b')) {
      return true;
    }
    const status = statusMap.get(dep);
    return status === '✅';
  });
}

/**
 * Sortier-Vergleichsfunktion
 */
function compareItems(a, b, refCounts) {
  const mvpDiff = (MVP_PRIORITY[a.mvp] ?? 99) - (MVP_PRIORITY[b.mvp] ?? 99);
  if (mvpDiff !== 0) return mvpDiff;

  const statusDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  const prioDiff = (PRIO_PRIORITY[a.prio] ?? 99) - (PRIO_PRIORITY[b.prio] ?? 99);
  if (prioDiff !== 0) return prioDiff;

  const refCountA = refCounts.get(a.number) || 0;
  const refCountB = refCounts.get(b.number) || 0;
  const refDiff = refCountB - refCountA;
  if (refDiff !== 0) return refDiff;

  const numA = typeof a.number === 'string' ? parseInt(a.number.slice(1), 10) : a.number;
  const numB = typeof b.number === 'string' ? parseInt(b.number.slice(1), 10) : b.number;

  if (a.isBug !== b.isBug) return a.isBug ? 1 : -1;

  return numA - numB;
}

/**
 * Prüft ob Task den Filtern entspricht
 */
function matchesFilters(task, opts, statusMap) {
  if (task.status === '✅') {
    if (task.isBug && !opts.includeResolved) return false;
    if (!task.isBug && !opts.includeDone) return false;
  }
  if (!opts.includeClaimed && task.status === '🔒') return false;
  if (opts.status && task.status !== opts.status) return false;

  if (!opts.includeBlocked && !areDepsResolved(task, statusMap)) return false;

  if (opts.mvp === true && task.mvp !== 'Ja') return false;
  if (opts.mvp === false && task.mvp !== 'Nein') return false;

  if (opts.prio && task.prio.toLowerCase() !== opts.prio) return false;

  if (opts.keywords.length > 0) {
    const searchText = `${task.bereich} ${task.beschreibung}`.toLowerCase();
    if (!opts.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatTable(items, refCounts) {
  const headers = ['#', 'Status', 'Bereich', 'Beschreibung', 'Prio', 'MVP', 'Deps', 'Refs'];

  const rows = items.map(t => [
    String(t.number),
    t.status,
    t.bereich.length > 20 ? t.bereich.slice(0, 17) + '...' : t.bereich,
    t.beschreibung.length > 45 ? t.beschreibung.slice(0, 42) + '...' : t.beschreibung,
    t.prio,
    t.mvp,
    t.deps.length ? t.deps.map(formatId).join(', ') : '-',
    String(refCounts.get(t.number) || 0)
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  );

  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  const separator = widths.map(w => '-'.repeat(w)).join('-+-');

  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join(' | '));
  }
}

function formatJson(tasks, refCounts, cycles, duplicates, orphans) {
  const items = tasks.map(t => ({
    ...t,
    refCount: refCounts.get(t.number) || 0
  }));

  const formattedCycles = cycles.map(cycle => cycle.map(formatId));

  const formattedDuplicates = duplicates.map(({ id, occurrences }) => ({
    id: formatId(id),
    count: occurrences.length,
    descriptions: occurrences.map(o => o.beschreibung)
  }));

  const orphansByFile = {};
  for (const { file, id } of orphans) {
    if (!orphansByFile[file]) orphansByFile[file] = [];
    orphansByFile[file].push(formatId(id));
  }

  const output = {
    items,
    cycles: formattedCycles,
    duplicates: formattedDuplicates,
    orphanRefs: orphansByFile
  };

  console.log(JSON.stringify(output, null, 2));
}

function describeFilters(opts) {
  const parts = [];
  if (opts.status) parts.push(`Status=${opts.status}`);
  if (opts.mvp === true) parts.push('MVP=Ja');
  if (opts.mvp === false) parts.push('MVP=Nein');
  if (opts.prio) parts.push(`Prio=${opts.prio}`);
  if (opts.keywords.length) parts.push(`Keywords="${opts.keywords.join('" ODER "')}"`);
  if (opts.includeDone) parts.push('+done');
  if (opts.includeBlocked) parts.push('+blocked');
  if (opts.includeClaimed) parts.push('+claimed');
  if (opts.includeResolved) parts.push('+resolved');
  return parts.length ? parts.join(', ') : 'keine';
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

  if (!opts.quiet) {
    console.log('Lade Development-Roadmap.md...\n');
  }

  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const { tasks, bugs } = parseRoadmap(content, { separateBugs: true });

  const allItems = [...tasks, ...bugs];
  const statusMap = new Map(allItems.map(t => [t.number, t.status]));
  const refCounts = calculateRefCounts(allItems);

  // Zirkuläre Dependencies prüfen
  const cycles = findCycles(allItems);
  if (cycles.length > 0) {
    console.warn('\n⚠️  WARNUNG: Zirkuläre Dependencies gefunden!\n');
    for (const cycle of cycles) {
      const formatted = cycle.map(formatId);
      console.warn(`   ${formatted.join(' → ')}`);
    }
    console.warn('\nDiese Tasks/Bugs können niemals "nicht blockiert" werden.\n');
  }

  // Doppelte Task-IDs prüfen
  const duplicates = findDuplicateIds(tasks, bugs);
  if (duplicates.length > 0) {
    console.warn('\n⚠️  WARNUNG: Doppelte IDs in der Roadmap!\n');
    for (const { id, occurrences } of duplicates) {
      console.warn(`   ${formatId(id)} erscheint ${occurrences.length}x:`);
      for (const occ of occurrences) {
        console.warn(`      - "${occ.beschreibung.slice(0, 50)}${occ.beschreibung.length > 50 ? '...' : ''}"`);
      }
    }
    console.warn('');
  }

  // Verwaiste Task-Referenzen prüfen
  const roadmapIds = new Set(allItems.map(item => item.number));
  const docsRefs = scanDocsForTaskRefs(DOCS_PATH);
  const orphans = findOrphanRefs(docsRefs, roadmapIds);
  if (orphans.length > 0) {
    console.warn('\n⚠️  WARNUNG: Verwaiste Task-Referenzen in Docs!\n');
    const byFile = new Map();
    for (const { file, id } of orphans) {
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(id);
    }
    for (const [file, ids] of byFile) {
      console.warn(`   ${file}:`);
      console.warn(`      ${ids.map(formatId).join(', ')}`);
    }
    console.warn('\nDiese IDs werden in Docs referenziert, existieren aber nicht in der Roadmap.\n');
  }

  if (!opts.quiet) {
    console.log(`Gefunden: ${tasks.length} Tasks, ${bugs.length} Bugs`);

    const statusCounts = { '✅': 0, '🔶': 0, '⚠️': 0, '⬜': 0, '🔒': 0 };
    let blockedCount = 0;
    for (const item of allItems) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if (!areDepsResolved(item, statusMap)) {
        blockedCount++;
      }
    }
    console.log(`Status: ${statusCounts['✅']} ✅, ${statusCounts['🔶']} 🔶, ${statusCounts['⚠️']} ⚠️, ${statusCounts['⬜']} ⬜, ${statusCounts['🔒']} 🔒, ${blockedCount} ❌`);

    console.log(`Filter: ${describeFilters(opts)}`);
  }

  const filtered = allItems.filter(t => matchesFilters(t, opts, statusMap));

  if (!opts.quiet) {
    console.log(`Nach Filterung: ${filtered.length} Items\n`);
  }

  if (filtered.length === 0) {
    console.log('Keine Tasks/Bugs gefunden.');
    return;
  }

  filtered.sort((a, b) => compareItems(a, b, refCounts));

  const results = opts.limit > 0 ? filtered.slice(0, opts.limit) : filtered;

  if (opts.json) {
    formatJson(results, refCounts, cycles, duplicates, orphans);
  } else {
    if (!opts.quiet) {
      const taskCount = results.filter(r => !r.isBug).length;
      const bugCount = results.filter(r => r.isBug).length;
      const summary = bugCount > 0 ? `${taskCount} Tasks, ${bugCount} Bugs` : `${taskCount} Tasks`;
      console.log(`=== TOP ${results.length} PRIORISIERT (${summary}) ===\n`);
    }
    formatTable(results, refCounts);

    if (!opts.quiet) {
      console.log('\n--- Sortierkriterien ---');
      console.log('1. MVP: Ja > Nein');
      console.log('2. Status: 🔶 > ⚠️ > ⬜ > 🔒');
      console.log('3. Prio: hoch > mittel > niedrig');
      console.log('4. RefCount: Höher = wichtiger');
      console.log('5. Nummer: Niedriger = höhere Priorität');
    }
  }
}

main();
