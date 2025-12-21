#!/usr/bin/env node
/**
 * Task-Lookup-Skript
 *
 * Zeigt Details zu einer Task und optional ihre Dependencies/Dependents.
 * Kann auch nach Keyword in Bereich, Beschreibung oder Spec suchen.
 *
 * Ausführung:
 *   node scripts/task-lookup.mjs 428                # Task #428 anzeigen
 *   node scripts/task-lookup.mjs 428 --deps         # + Dependencies
 *   node scripts/task-lookup.mjs 428 --dependents   # + Tasks die #428 brauchen
 *   node scripts/task-lookup.mjs 428 -a             # Beides (all)
 *   node scripts/task-lookup.mjs 428 --tree         # Dependency-Baum
 *   node scripts/task-lookup.mjs 428 --json         # JSON-Ausgabe
 *
 * Suche:
 *   node scripts/task-lookup.mjs -s Travel          # Suche in Bereich/Beschreibung/Spec
 *   node scripts/task-lookup.mjs --bereich Combat   # Nur im Bereich suchen
 *   node scripts/task-lookup.mjs --spec Weather     # Nur in der Spec-Spalte suchen
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = join(__dirname, '..', 'docs', 'architecture', 'Development-Roadmap.md');

/**
 * Parst eine Task-ID (z.B. "428", "428b", "2917a")
 * Gibt String zurück für alphanumerische IDs, Zahl für reine Ziffern
 */
function parseTaskId(raw) {
  const trimmed = raw.trim();
  // Alphanumerische ID (z.B. "428b", "2917a")
  if (/^\d+[a-z]$/i.test(trimmed)) {
    return trimmed.toLowerCase();  // Normalisieren zu lowercase
  }
  // Reine Zahl
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parst Dependencies aus einem String
 * Unterstützt: #123, #428b, b4
 */
function parseDeps(depsRaw) {
  if (depsRaw === '-') return [];

  const deps = [];
  // Match: #123, #428b, #2917a, b4
  const matches = depsRaw.matchAll(/#(\d+[a-z]?)|b(\d+)/gi);

  for (const match of matches) {
    if (match[1]) {
      // Task-ID: kann Zahl oder alphanumerisch sein
      deps.push(parseTaskId(match[1]));
    } else if (match[2]) {
      // Bug-ID: z.B. "b4"
      deps.push(`b${match[2]}`);
    }
  }

  return deps.filter(d => d !== null);
}

/**
 * Formatiert eine Task-/Bug-ID für Ausgabe
 * - Zahlen: #428
 * - Alphanumerische Task-IDs: #428b
 * - Bug-IDs: b4 (ohne #)
 */
function formatId(id) {
  if (typeof id === 'number') return `#${id}`;
  if (typeof id === 'string' && id.startsWith('b')) return id;  // Bug-ID
  return `#${id}`;  // Alphanumerische Task-ID
}

/**
 * Parst Command-Line-Argumente
 */
function parseArgs(argv) {
  const opts = {
    itemId: null,  // Task-Nummer (Zahl) oder Bug-ID (String wie 'b4')
    showDeps: false,
    showDependents: false,
    tree: false,
    treeDepth: 3,
    json: false,
    quiet: false,
    help: false,
    // Such-Optionen
    search: null,      // Suche in allen Feldern
    bereich: null,     // Suche nur im Bereich
    spec: null,        // Suche nur in Spec
    limit: 20          // Max. Ergebnisse bei Suche
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-d' || arg === '--deps' || arg === '--dependencies') {
      opts.showDeps = true;
    } else if (arg === '-D' || arg === '--dependents' || arg === '--rdeps') {
      opts.showDependents = true;
    } else if (arg === '-a' || arg === '--all') {
      opts.showDeps = true;
      opts.showDependents = true;
    } else if (arg === '-t' || arg === '--tree') {
      opts.tree = true;
      opts.showDeps = true;
    } else if (arg === '--depth') {
      opts.treeDepth = parseInt(argv[++i], 10) || 3;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '-q' || arg === '--quiet') {
      opts.quiet = true;
    } else if (arg === '-s' || arg === '--search') {
      opts.search = argv[++i];
    } else if (arg === '--bereich' || arg === '-b') {
      opts.bereich = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '-n' || arg === '--limit') {
      opts.limit = parseInt(argv[++i], 10) || 20;
    } else if (!arg.startsWith('-')) {
      // Bug-ID (z.B. 'b4') oder Task-ID (z.B. '428', '428b')
      if (arg.match(/^b\d+$/)) {
        opts.itemId = arg;
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) opts.itemId = parsed;
      }
    }
  }

  return opts;
}

/**
 * Zeigt Hilfe an
 */
function showHelp() {
  console.log(`
Task-Lookup-Skript

USAGE:
  node scripts/task-lookup.mjs <ID> [OPTIONS]
  node scripts/task-lookup.mjs -s <KEYWORD> [OPTIONS]

ARGUMENTE:
  <ID>                    Task-ID (z.B. 428, 428b) oder Bug-ID (z.B. b4)

SUCHE:
  -s, --search <KEYWORD>  Suche in Bereich, Beschreibung und Spec
  -b, --bereich <KEYWORD> Suche nur im Bereich
      --spec <KEYWORD>    Suche nur in der Spec-Spalte
  -n, --limit <N>         Max. Ergebnisse bei Suche (default: 20)

OPTIONEN:
  -d, --deps              Voraussetzungen: Tasks/Bugs die erst erledigt sein müssen
  -D, --dependents        Blockiert: Tasks/Bugs die auf dieses Item warten
  -a, --all               Zeige beides
  -t, --tree              Zeige rekursiven Dependency-Baum
      --depth <N>         Tiefe des Baums (default: 3)
      --json              JSON-Ausgabe
  -q, --quiet             Kompakte Ausgabe
  -h, --help              Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task-lookup.mjs 428                  # Task #428 Details
  node scripts/task-lookup.mjs 428b                 # Task #428b Details
  node scripts/task-lookup.mjs b4                   # Bug b4 Details
  node scripts/task-lookup.mjs 428 --deps           # + Voraussetzungen
  node scripts/task-lookup.mjs 428 --dependents     # + was darauf wartet
  node scripts/task-lookup.mjs 428 -a               # Vollständige Analyse
  node scripts/task-lookup.mjs 428 --tree           # Dependency-Baum
  node scripts/task-lookup.mjs 428 --json           # Als JSON

  # Suche:
  node scripts/task-lookup.mjs -s Travel            # Suche 'Travel' überall
  node scripts/task-lookup.mjs -b Combat            # Nur Bereich = Combat
  node scripts/task-lookup.mjs --spec Weather       # Nur in Spec-Spalte
  node scripts/task-lookup.mjs -s Encounter -n 10   # Max 10 Ergebnisse
`);
}

/**
 * Parst eine Task-Zeile aus der Markdown-Tabelle
 */
function parseTaskLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 9) return null;

  // Task-ID kann alphanumerisch sein (z.B. "428b")
  const number = parseTaskId(cells[0]);
  if (number === null) return null;

  const depsRaw = cells[6];
  const deps = parseDeps(depsRaw);

  return {
    number,
    status: cells[1],
    bereich: cells[2],
    beschreibung: cells[3],
    prio: cells[4],
    mvp: cells[5],
    depsRaw,
    deps,
    spec: cells[7],
    imp: cells[8],
    isBug: false
  };
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
  const deps = parseDeps(depsRaw);

  return {
    number,
    status: '⬜',      // Bugs sind implizit offen
    bereich: 'Bug',
    beschreibung,
    prio,
    mvp: 'Ja',
    depsRaw,
    deps,
    spec: '-',
    imp: '-',
    isBug: true
  };
}

/**
 * Parst die gesamte Roadmap-Datei (Tasks + Bugs)
 */
function parseRoadmap(content) {
  const lines = content.split('\n');
  const items = [];
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
      if (task) items.push(task);
    }
    if (inBugTable) {
      const bug = parseBugLine(line);
      if (bug) items.push(bug);
    }
  }
  return items;
}

/**
 * Findet alle Items die von einem bestimmten Item abhängen
 */
function findDependents(itemId, allItems) {
  return allItems.filter(t => t.deps.includes(itemId));
}

/**
 * Sucht Items nach Keyword
 */
function searchItems(items, opts) {
  const keyword = (opts.search || opts.bereich || opts.spec || '').toLowerCase();
  if (!keyword) return [];

  return items.filter(item => {
    if (opts.bereich) {
      return item.bereich.toLowerCase().includes(keyword);
    }
    if (opts.spec) {
      return item.spec.toLowerCase().includes(keyword);
    }
    // Suche in allen Feldern
    return (
      item.bereich.toLowerCase().includes(keyword) ||
      item.beschreibung.toLowerCase().includes(keyword) ||
      item.spec.toLowerCase().includes(keyword)
    );
  });
}

/**
 * Findet alle Dependencies eines Items (rekursiv)
 */
function findDepsRecursive(itemId, itemMap, depth, maxDepth, visited = new Set()) {
  if (depth > maxDepth || visited.has(itemId)) return null;
  visited.add(itemId);

  const item = itemMap.get(itemId);
  if (!item) {
    return { number: itemId, status: '?', missing: true, children: [], label: formatId(itemId) };
  }

  const children = item.deps.map(dep =>
    findDepsRecursive(dep, itemMap, depth + 1, maxDepth, visited)
  ).filter(Boolean);

  return {
    number: item.number,
    status: item.status,
    beschreibung: item.beschreibung,
    isBug: item.isBug,
    children
  };
}

/**
 * Formatiert ein Item (Task oder Bug)
 */
function formatItem(item, opts) {
  const idLabel = item.isBug ? `Bug ${item.number}` : `Task ${formatId(item.number)}`;

  if (opts.quiet) {
    return `${formatId(item.number)} [${item.status}] ${item.bereich}: ${item.beschreibung}`;
  }

  const lines = [
    `┌─────────────────────────────────────────────────────────────────────────────┐`,
    `│ ${idLabel}`.padEnd(78) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│ Status:       ${item.status}`.padEnd(78) + '│',
    `│ Bereich:      ${item.bereich}`.padEnd(78) + '│',
    `│ Beschreibung: ${item.beschreibung.slice(0, 60)}`.padEnd(78) + '│',
  ];

  if (item.beschreibung.length > 60) {
    lines.push(`│               ${item.beschreibung.slice(60, 120)}`.padEnd(78) + '│');
  }

  lines.push(
    `│ Priorität:    ${item.prio}`.padEnd(78) + '│',
    `│ MVP:          ${item.mvp}`.padEnd(78) + '│',
    `│ Dependencies: ${item.depsRaw}`.padEnd(78) + '│'
  );

  // Spec und Imp nur für Tasks anzeigen
  if (!item.isBug) {
    lines.push(
      `│ Spec:         ${item.spec.slice(0, 60)}`.padEnd(78) + '│',
      `│ Imp:          ${item.imp.slice(0, 60)}`.padEnd(78) + '│'
    );
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join('\n');
}

/**
 * Formatiert eine Item-Liste als Tabelle
 */
function formatItemList(items, title) {
  if (items.length === 0) return `\n${title}: (keine)\n`;

  const lines = [`\n${title} (${items.length}):\n`];

  const headers = ['#', 'Status', 'Bereich', 'Beschreibung', 'Prio'];
  const rows = items.map(t => [
    formatId(t.number),
    t.status,
    t.bereich.length > 15 ? t.bereich.slice(0, 12) + '...' : t.bereich,
    t.beschreibung.length > 40 ? t.beschreibung.slice(0, 37) + '...' : t.beschreibung,
    t.prio
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  );

  lines.push(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
  lines.push(widths.map(w => '-'.repeat(w)).join('-+-'));
  for (const row of rows) {
    lines.push(row.map((cell, i) => cell.padEnd(widths[i])).join(' | '));
  }

  return lines.join('\n');
}

/**
 * Formatiert einen Dependency-Baum
 */
function formatTree(node, prefix = '', isLast = true) {
  if (!node) return '';

  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  // ID-Label mit formatId für einheitliche Formatierung
  const idLabel = formatId(node.number);

  let line = prefix + connector;
  if (node.missing) {
    line += `${node.label || idLabel} (nicht gefunden)`;
  } else {
    line += `${idLabel} [${node.status}] ${node.beschreibung?.slice(0, 40) || ''}`;
  }

  const lines = [line];

  if (node.children) {
    node.children.forEach((child, index) => {
      const childIsLast = index === node.children.length - 1;
      lines.push(formatTree(child, prefix + extension, childIsLast));
    });
  }

  return lines.join('\n');
}

/**
 * JSON-Ausgabe
 */
function formatJson(item, deps, dependents, tree) {
  const output = {
    item: {
      number: item.number,
      status: item.status,
      bereich: item.bereich,
      beschreibung: item.beschreibung,
      prio: item.prio,
      mvp: item.mvp,
      deps: item.deps,
      isBug: item.isBug
    }
  };

  // Spec und Imp nur für Tasks
  if (!item.isBug) {
    output.item.spec = item.spec;
    output.item.imp = item.imp;
  }

  if (deps) {
    output.dependencies = deps.map(t => ({
      number: t.number,
      status: t.status,
      bereich: t.bereich,
      beschreibung: t.beschreibung,
      isBug: t.isBug
    }));
  }

  if (dependents) {
    output.dependents = dependents.map(t => ({
      number: t.number,
      status: t.status,
      bereich: t.bereich,
      beschreibung: t.beschreibung,
      isBug: t.isBug
    }));
  }

  if (tree) {
    output.dependencyTree = tree;
  }

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Formatiert Suchergebnisse als JSON
 */
function formatSearchJson(results, keyword, searchType) {
  console.log(JSON.stringify({
    search: { keyword, type: searchType },
    count: results.length,
    results: results.map(t => ({
      number: t.number,
      status: t.status,
      bereich: t.bereich,
      beschreibung: t.beschreibung,
      prio: t.prio,
      mvp: t.mvp,
      spec: t.spec,
      isBug: t.isBug
    }))
  }, null, 2));
}

// Hauptprogramm
function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    showHelp();
    return;
  }

  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const allItems = parseRoadmap(content);
  const itemMap = new Map(allItems.map(t => [t.number, t]));

  // Such-Modus
  const isSearchMode = opts.search || opts.bereich || opts.spec;
  if (isSearchMode) {
    const keyword = opts.search || opts.bereich || opts.spec;
    const searchType = opts.bereich ? 'bereich' : opts.spec ? 'spec' : 'all';
    let results = searchItems(allItems, opts);

    // Limit anwenden
    if (opts.limit > 0 && results.length > opts.limit) {
      results = results.slice(0, opts.limit);
    }

    if (opts.json) {
      formatSearchJson(results, keyword, searchType);
    } else {
      const searchLabel = opts.bereich ? `Bereich="${keyword}"` :
                          opts.spec ? `Spec="${keyword}"` :
                          `"${keyword}"`;
      console.log(formatItemList(results, `Suchergebnisse für ${searchLabel}`));

      if (!opts.quiet && results.length === opts.limit) {
        console.log(`\n(Limit: ${opts.limit} - nutze -n 0 für alle)`);
      }
    }
    return;
  }

  // Item-Modus
  if (opts.itemId === null) {
    console.error('Fehler: Task-Nummer, Bug-ID oder Suche erforderlich.\n');
    console.error('Usage: node scripts/task-lookup.mjs <ID> [OPTIONS]');
    console.error('       node scripts/task-lookup.mjs -s <KEYWORD>');
    console.error('       node scripts/task-lookup.mjs --help');
    process.exit(1);
  }

  const item = itemMap.get(opts.itemId);

  if (!item) {
    console.error(`Fehler: ${formatId(opts.itemId)} nicht gefunden.`);
    process.exit(1);
  }

  // Dependencies und Dependents sammeln
  let deps = null;
  let dependents = null;
  let tree = null;

  if (opts.showDeps) {
    deps = item.deps.map(n => itemMap.get(n)).filter(Boolean);
  }

  if (opts.showDependents) {
    dependents = findDependents(opts.itemId, allItems);
  }

  if (opts.tree) {
    tree = findDepsRecursive(opts.itemId, itemMap, 0, opts.treeDepth);
  }

  // Ausgabe
  if (opts.json) {
    formatJson(item, deps, dependents, tree);
  } else {
    console.log(formatItem(item, opts));

    if (opts.tree) {
      console.log('\nVoraussetzungen (Baum, Tiefe ' + opts.treeDepth + '):');
      console.log(formatTree(tree));
    } else if (deps) {
      console.log(formatItemList(deps, 'Voraussetzungen (muss erst erledigt sein)'));
    }

    if (dependents) {
      console.log(formatItemList(dependents, 'Blockiert (wartet auf dieses Item)'));
    }
  }
}

main();
