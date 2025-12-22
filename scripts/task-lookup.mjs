#!/usr/bin/env node
/**
 * Task-Lookup-Skript
 *
 * Zeigt Details zu einer Task inkl. Dependencies/Dependents als Baum (Standard).
 * Kann auch nach Keyword in Bereich, Beschreibung oder Spec suchen.
 *
 * Ausführung (zeigt standardmäßig deps + dependents als Tree):
 *   node scripts/task-lookup.mjs 428                # Task #428 mit Dep-Trees
 *   node scripts/task-lookup.mjs 428 --no-tree      # Flache Listen
 *   node scripts/task-lookup.mjs 428 --no-deps      # Nur Dependents
 *   node scripts/task-lookup.mjs 428 --depth 5      # Tieferer Baum
 *   node scripts/task-lookup.mjs 428 --json         # JSON-Ausgabe
 *
 * Suche:
 *   node scripts/task-lookup.mjs -s Travel          # Suche in Bereich/Beschreibung/Spec
 *   node scripts/task-lookup.mjs --bereich Combat   # Nur im Bereich suchen
 *   node scripts/task-lookup.mjs --spec Weather     # Nur in der Spec-Spalte suchen
 */

import { readFileSync } from 'fs';

import {
  ROADMAP_PATH, CLAIMS_PATH,
  parseTaskId, formatId,
  getAgentId, loadClaims, formatTimeRemaining, CLAIM_EXPIRY_MS,
  parseRoadmap
} from './task-utils.mjs';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv) {
  const opts = {
    itemId: null,
    showDeps: true,
    showDependents: true,
    tree: true,
    treeDepth: 3,
    json: false,
    quiet: false,
    help: false,
    search: null,
    bereich: null,
    spec: null,
    limit: 20
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
    } else if (arg === '--no-tree') {
      opts.tree = false;
    } else if (arg === '--no-deps') {
      opts.showDeps = false;
    } else if (arg === '--no-dependents') {
      opts.showDependents = false;
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

OPTIONEN (Standard: deps + dependents + tree aktiviert):
  -d, --deps              Voraussetzungen anzeigen (Standard: an)
  -D, --dependents        Blockierte Items anzeigen (Standard: an)
  -t, --tree              Rekursiver Baum (Standard: an)
      --depth <N>         Tiefe des Baums (default: 3)
      --no-deps           Voraussetzungen ausblenden
      --no-dependents     Blockierte Items ausblenden
      --no-tree           Flache Liste statt Baum
      --json              JSON-Ausgabe
  -q, --quiet             Kompakte Ausgabe
  -h, --help              Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task-lookup.mjs 428                  # Task #428 mit Dep-/Dependents-Trees
  node scripts/task-lookup.mjs 428b                 # Task #428b Details
  node scripts/task-lookup.mjs b4                   # Bug b4 Details
  node scripts/task-lookup.mjs 428 --no-tree        # Flache Listen statt Bäume
  node scripts/task-lookup.mjs 428 --no-dependents  # Nur Voraussetzungen zeigen
  node scripts/task-lookup.mjs 428 --depth 5        # Tieferer Baum (5 Ebenen)
  node scripts/task-lookup.mjs 428 --json           # Als JSON

  # Suche:
  node scripts/task-lookup.mjs -s Travel            # Suche 'Travel' überall
  node scripts/task-lookup.mjs -b Combat            # Nur Bereich = Combat
  node scripts/task-lookup.mjs --spec Weather       # Nur in Spec-Spalte
  node scripts/task-lookup.mjs -s Encounter -n 10   # Max 10 Ergebnisse
`);
}

// ============================================================================
// Search & Lookup
// ============================================================================

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
      return (item.spec || '').toLowerCase().includes(keyword);
    }
    return (
      item.bereich.toLowerCase().includes(keyword) ||
      item.beschreibung.toLowerCase().includes(keyword) ||
      (item.spec || '').toLowerCase().includes(keyword)
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
 * Findet alle Dependents eines Items (rekursiv nach oben)
 */
function findDependentsRecursive(itemId, allItems, depth, maxDepth, visited = new Set()) {
  if (depth > maxDepth || visited.has(itemId)) return null;
  visited.add(itemId);

  const item = allItems.find(t =>
    (typeof itemId === 'number' && t.number === itemId) ||
    (typeof itemId === 'string' && t.number === itemId)
  );

  if (!item) {
    return { number: itemId, status: '?', missing: true, children: [], label: formatId(itemId) };
  }

  const directDependents = allItems.filter(t => t.deps.includes(itemId));

  const children = directDependents.map(dep =>
    findDependentsRecursive(dep.number, allItems, depth + 1, maxDepth, visited)
  ).filter(Boolean);

  return {
    number: item.number,
    status: item.status,
    beschreibung: item.beschreibung,
    isBug: item.isBug,
    children
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

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

  if (!item.isBug) {
    lines.push(
      `│ Spec:         ${(item.spec || '-').slice(0, 60)}`.padEnd(78) + '│',
      `│ Imp:          ${(item.imp || '-').slice(0, 60)}`.padEnd(78) + '│'
    );
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join('\n');
}

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

function formatTree(node, prefix = '', isLast = true) {
  if (!node) return '';

  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';
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

function formatJson(item, deps, dependents, tree, dependentsTree, duplicates = []) {
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

  if (dependentsTree) {
    output.dependentsTree = dependentsTree;
  }

  if (duplicates.length > 1) {
    output.duplicateWarning = {
      count: duplicates.length,
      descriptions: duplicates.map(d => d.beschreibung)
    };
  }

  console.log(JSON.stringify(output, null, 2));
}

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

// ============================================================================
// Main
// ============================================================================

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    showHelp();
    return;
  }

  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const allItems = parseRoadmap(content, { minColumns: 9 });
  const itemMap = new Map(allItems.map(t => [t.number, t]));

  // Such-Modus
  const isSearchMode = opts.search || opts.bereich || opts.spec;
  if (isSearchMode) {
    const keyword = opts.search || opts.bereich || opts.spec;
    const searchType = opts.bereich ? 'bereich' : opts.spec ? 'spec' : 'all';
    let results = searchItems(allItems, opts);

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

  // Duplikat-Prüfung
  const duplicates = allItems.filter(t => t.number === opts.itemId);
  const hasDuplicates = duplicates.length > 1;

  // Dependencies und Dependents sammeln
  let deps = null;
  let dependents = null;
  let tree = null;
  let dependentsTree = null;

  if (opts.showDeps) {
    deps = item.deps.map(n => itemMap.get(n)).filter(Boolean);
  }

  if (opts.showDependents) {
    dependents = findDependents(opts.itemId, allItems);
  }

  if (opts.tree && opts.showDeps) {
    tree = findDepsRecursive(opts.itemId, itemMap, 0, opts.treeDepth);
  }

  if (opts.tree && opts.showDependents) {
    dependentsTree = findDependentsRecursive(opts.itemId, allItems, 0, opts.treeDepth);
  }

  // Ausgabe
  if (opts.json) {
    formatJson(item, deps, dependents, tree, dependentsTree, duplicates);
  } else {
    console.log(formatItem(item, opts));

    if (opts.tree) {
      console.log('\nVoraussetzungen (Baum, Tiefe ' + opts.treeDepth + '):');
      console.log(formatTree(tree));
    } else if (deps) {
      console.log(formatItemList(deps, 'Voraussetzungen (muss erst erledigt sein)'));
    }

    if (opts.tree && dependentsTree && dependentsTree.children && dependentsTree.children.length > 0) {
      console.log('\nBlockiert (Baum, Tiefe ' + opts.treeDepth + '):');
      dependentsTree.children.forEach((child, index) => {
        const isLast = index === dependentsTree.children.length - 1;
        console.log(formatTree(child, '', isLast));
      });
    } else if (dependents && dependents.length > 0) {
      console.log(formatItemList(dependents, 'Blockiert (wartet auf dieses Item)'));
    }

    // Duplikat-Warnung anzeigen
    if (hasDuplicates) {
      console.warn(`\n⚠️  WARNUNG: ${formatId(opts.itemId)} erscheint ${duplicates.length}x in der Roadmap!\n`);
      for (const dup of duplicates) {
        console.warn(`   - "${dup.beschreibung.slice(0, 50)}${dup.beschreibung.length > 50 ? '...' : ''}"`);
      }
    }

    // Claim-Warnung anzeigen
    if (item.status === '🔒') {
      const claims = loadClaims();
      const claimKey = String(item.number);
      const claim = claims[claimKey];

      if (claim) {
        const myId = getAgentId();
        if (myId && claim.owner === myId) {
          console.log('\n✅ Diese Task ist von DIR geclaimed.');
        } else if (myId) {
          console.warn(`\n⚠️  WARNUNG: Task ${formatId(item.number)} wird von ${claim.owner} bearbeitet!`);
        } else {
          console.warn(`\n⚠️  Task ist geclaimed von: ${claim.owner}`);
        }

        const expiry = new Date(new Date(claim.timestamp).getTime() + CLAIM_EXPIRY_MS);
        const remaining = expiry.getTime() - Date.now();
        if (remaining > 0) {
          console.log(`   Claim läuft ab in: ${formatTimeRemaining(claim.timestamp)}`);
        } else {
          console.log('   Claim ist abgelaufen (wird beim nächsten update-tasks Aufruf entfernt)');
        }
      }
    }
  }
}

main();
