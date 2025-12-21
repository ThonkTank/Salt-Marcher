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

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = join(__dirname, '..', 'docs', 'architecture', 'Development-Roadmap.md');

// Sortier-Prioritäten
const STATUS_PRIORITY = { '🔶': 0, '⚠️': 1, '⬜': 2, '✅': 3 };
const MVP_PRIORITY = { 'Ja': 0, 'Nein': 1 };
const PRIO_PRIORITY = { 'hoch': 0, 'mittel': 1, 'niedrig': 2 };

// Status-Aliase für CLI
const STATUS_ALIASES = {
  'done': '✅', 'fertig': '✅', 'complete': '✅',
  'partial': '🔶', 'nonconform': '🔶',
  'broken': '⚠️', 'warning': '⚠️',
  'open': '⬜', 'todo': '⬜', 'offen': '⬜'
};

/**
 * Parst Command-Line-Argumente
 */
function parseArgs(argv) {
  const opts = {
    keywords: [],
    limit: 10,
    status: null,      // null = alle außer ✅
    mvp: null,         // null = beide, true = nur Ja, false = nur Nein
    prio: null,        // null = alle
    includeDone: false,
    includeBlocked: false,
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

/**
 * Zeigt Hilfe an
 */
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
  1. Status: 🔶 > ⚠️ > ⬜
  2. MVP: Ja > Nein
  3. Prio: hoch > mittel > niedrig
  4. RefCount: Tasks, von denen viele andere abhängen
  5. Task-Nummer: Niedrigere = älter = höhere Priorität
`);
}

/**
 * Parst eine Task-Zeile aus der Markdown-Tabelle
 */
function parseTaskLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 7) return null;

  const number = parseInt(cells[0], 10);
  if (isNaN(number)) return null;

  const status = cells[1];
  const bereich = cells[2];
  const beschreibung = cells[3];
  const prio = cells[4];
  const mvp = cells[5];
  const depsRaw = cells[6];

  // Deps können Task-IDs (#N) oder Bug-IDs (bN) sein
  const deps = depsRaw === '-'
    ? []
    : depsRaw.match(/#(\d+)|b(\d+)/g)?.map(d => d.startsWith('#') ? parseInt(d.slice(1), 10) : d) ?? [];

  return { number, status, bereich, beschreibung, prio, mvp, deps, isBug: false };
}

/**
 * Parst eine Bug-Zeile aus der Markdown-Tabelle
 * Format: | b# | Beschreibung | Prio | Deps |
 */
function parseBugLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 4) return null;

  const match = cells[0].match(/^b(\d+)$/);
  if (!match) return null;

  const number = cells[0];  // z.B. "b1"
  const beschreibung = cells[1];
  const prio = cells[2];
  const depsRaw = cells[3];

  // Deps können Task-IDs (#N) oder Bug-IDs (bN) sein
  const deps = depsRaw === '-'
    ? []
    : depsRaw.match(/#(\d+)|b(\d+)/g)?.map(d => d.startsWith('#') ? parseInt(d.slice(1), 10) : d) ?? [];

  return {
    number,
    status: '⬜',      // Bugs sind implizit offen
    bereich: 'Bug',
    beschreibung,
    prio,
    mvp: 'Ja',         // Bugs sind immer MVP-relevant
    deps,
    isBug: true
  };
}

/**
 * Parst die gesamte Roadmap-Datei (Tasks + Bugs)
 */
function parseRoadmap(content) {
  const lines = content.split('\n');
  const tasks = [];
  const bugs = [];
  let inTaskTable = false;
  let inBugTable = false;

  for (const line of lines) {
    // Task-Tabelle erkennen
    if (line.includes('| # | Status |')) {
      inTaskTable = true;
      inBugTable = false;
      continue;
    }
    // Bug-Tabelle erkennen
    if (line.includes('| b# |')) {
      inBugTable = true;
      inTaskTable = false;
      continue;
    }
    // Separator-Zeile überspringen
    if ((inTaskTable || inBugTable) && line.match(/^\|[\s:-]+\|/)) continue;
    // Tabelle beenden
    if ((inTaskTable || inBugTable) && !line.startsWith('|')) {
      if (line.trim() === '' || line.startsWith('#')) {
        inTaskTable = false;
        inBugTable = false;
      }
      continue;
    }
    // Zeilen parsen
    if (inTaskTable) {
      const task = parseTaskLine(line);
      if (task) tasks.push(task);
    }
    if (inBugTable) {
      const bug = parseBugLine(line);
      if (bug) bugs.push(bug);
    }
  }
  return { tasks, bugs };
}

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
 * Bug-Status-Propagation: Tasks die von Bugs referenziert werden → ⚠️
 * Und Bug-ID wird als Dependency hinzugefügt
 */
function propagateBugStatus(tasks, bugs) {
  const taskMap = new Map(tasks.map(t => [t.number, t]));

  for (const bug of bugs) {
    for (const dep of bug.deps) {
      // Nur Task-IDs (Zahlen), keine Bug-IDs
      if (typeof dep === 'number') {
        const task = taskMap.get(dep);
        if (task && task.status === '✅') {
          task.status = '⚠️';
          task.deps.push(bug.number);  // z.B. 'b4'
        }
      }
    }
  }
}

/**
 * Prüft ob alle Dependencies erfüllt sind (Status = ✅)
 * Bug-Deps werden ignoriert - sie zeigen "broken" an, blockieren aber nicht
 */
function areDepsResolved(item, statusMap) {
  return item.deps.every(dep => {
    // Bug-Deps ignorieren - sie zeigen "broken" an, nicht "blockiert"
    if (typeof dep === 'string' && dep.startsWith('b')) {
      return true;
    }
    const status = statusMap.get(dep);
    return status === '✅';
  });
}

/**
 * Sortier-Vergleichsfunktion
 * Unterstützt gemischte IDs (Tasks: Zahlen, Bugs: Strings wie 'b4')
 */
function compareItems(a, b, refCounts) {
  const statusDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  const mvpDiff = (MVP_PRIORITY[a.mvp] ?? 99) - (MVP_PRIORITY[b.mvp] ?? 99);
  if (mvpDiff !== 0) return mvpDiff;

  const prioDiff = (PRIO_PRIORITY[a.prio] ?? 99) - (PRIO_PRIORITY[b.prio] ?? 99);
  if (prioDiff !== 0) return prioDiff;

  const refCountA = refCounts.get(a.number) || 0;
  const refCountB = refCounts.get(b.number) || 0;
  const refDiff = refCountB - refCountA;
  if (refDiff !== 0) return refDiff;

  // Nummer-Vergleich: Bugs (Strings) vs Tasks (Zahlen)
  const numA = typeof a.number === 'string' ? parseInt(a.number.slice(1), 10) : a.number;
  const numB = typeof b.number === 'string' ? parseInt(b.number.slice(1), 10) : b.number;

  // Tasks vor Bugs bei gleicher Nummer
  if (a.isBug !== b.isBug) return a.isBug ? 1 : -1;

  return numA - numB;
}

/**
 * Prüft ob Task den Filtern entspricht
 */
function matchesFilters(task, opts, statusMap) {
  // Status-Filter
  if (!opts.includeDone && task.status === '✅') return false;
  if (opts.status && task.status !== opts.status) return false;

  // Dependency-Filter
  if (!opts.includeBlocked && !areDepsResolved(task, statusMap)) return false;

  // MVP-Filter
  if (opts.mvp === true && task.mvp !== 'Ja') return false;
  if (opts.mvp === false && task.mvp !== 'Nein') return false;

  // Prio-Filter
  if (opts.prio && task.prio.toLowerCase() !== opts.prio) return false;

  // Keyword-Filter
  if (opts.keywords.length > 0) {
    const searchText = `${task.bereich} ${task.beschreibung}`.toLowerCase();
    if (!opts.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

/**
 * Formatiert die Ausgabe-Tabelle
 */
function formatTable(items, refCounts) {
  const headers = ['#', 'Status', 'Bereich', 'Beschreibung', 'Prio', 'MVP', 'Deps', 'Refs'];

  const rows = items.map(t => [
    String(t.number),
    t.status,
    t.bereich.length > 20 ? t.bereich.slice(0, 17) + '...' : t.bereich,
    t.beschreibung.length > 45 ? t.beschreibung.slice(0, 42) + '...' : t.beschreibung,
    t.prio,
    t.mvp,
    t.deps.length ? t.deps.map(d => typeof d === 'string' ? d : `#${d}`).join(', ') : '-',
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

/**
 * Formatiert JSON-Ausgabe
 */
function formatJson(tasks, refCounts) {
  const output = tasks.map(t => ({
    ...t,
    refCount: refCounts.get(t.number) || 0
  }));
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Beschreibt aktive Filter
 */
function describeFilters(opts) {
  const parts = [];
  if (opts.status) parts.push(`Status=${opts.status}`);
  if (opts.mvp === true) parts.push('MVP=Ja');
  if (opts.mvp === false) parts.push('MVP=Nein');
  if (opts.prio) parts.push(`Prio=${opts.prio}`);
  if (opts.keywords.length) parts.push(`Keywords="${opts.keywords.join('" ODER "')}"`);
  if (opts.includeDone) parts.push('+done');
  if (opts.includeBlocked) parts.push('+blocked');
  return parts.length ? parts.join(', ') : 'keine';
}

// Hauptprogramm
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
  const { tasks, bugs } = parseRoadmap(content);

  // Bug-Status-Propagation: Tasks die von Bugs referenziert werden → ⚠️
  propagateBugStatus(tasks, bugs);

  // Alle Items kombinieren
  const allItems = [...tasks, ...bugs];

  // Status-Map für Dependency-Prüfung
  const statusMap = new Map(allItems.map(t => [t.number, t.status]));
  const refCounts = calculateRefCounts(allItems);

  if (!opts.quiet) {
    console.log(`Gefunden: ${tasks.length} Tasks, ${bugs.length} Bugs`);

    // Status-Aufschlüsselung
    const statusCounts = { '✅': 0, '🔶': 0, '⚠️': 0, '⬜': 0 };
    let blockedCount = 0;
    for (const item of allItems) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if (!areDepsResolved(item, statusMap)) {
        blockedCount++;
      }
    }
    console.log(`Status: ${statusCounts['✅']} ✅, ${statusCounts['🔶']} 🔶, ${statusCounts['⚠️']} ⚠️, ${statusCounts['⬜']} ⬜, ${blockedCount} ❌`);

    console.log(`Filter: ${describeFilters(opts)}`);
  }

  // Filtern
  const filtered = allItems.filter(t => matchesFilters(t, opts, statusMap));

  if (!opts.quiet) {
    console.log(`Nach Filterung: ${filtered.length} Items\n`);
  }

  if (filtered.length === 0) {
    console.log('Keine Tasks/Bugs gefunden.');
    return;
  }

  // Sortieren
  filtered.sort((a, b) => compareItems(a, b, refCounts));

  // Limit anwenden
  const results = opts.limit > 0 ? filtered.slice(0, opts.limit) : filtered;

  // Ausgabe
  if (opts.json) {
    formatJson(results, refCounts);
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
      console.log('1. Status: 🔶 > ⚠️ > ⬜');
      console.log('2. MVP: Ja > Nein');
      console.log('3. Prio: hoch > mittel > niedrig');
      console.log('4. RefCount: Höher = wichtiger');
      console.log('5. Nummer: Niedriger = höhere Priorität');
    }
  }
}

main();
