#!/usr/bin/env node
/**
 * Sync-Roadmap-Tasks-Skript
 *
 * Synchronisiert Deps und Spec zwischen Doc-Tasks-Tabellen und der Roadmap.
 *
 * Ausführung:
 *   node scripts/sync-roadmap-tasks.mjs              # Dry-run (zeigt Änderungen)
 *   node scripts/sync-roadmap-tasks.mjs --apply      # Änderungen anwenden
 *   node scripts/sync-roadmap-tasks.mjs --json       # JSON-Output
 *   node scripts/sync-roadmap-tasks.mjs --verbose    # Details anzeigen
 *   node scripts/sync-roadmap-tasks.mjs --doc-only   # Nur Doc→Roadmap
 *   node scripts/sync-roadmap-tasks.mjs --roadmap-only # Nur Roadmap→Doc
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = join(__dirname, '..', 'docs');
const ROADMAP_PATH = join(__dirname, '..', 'docs', 'architecture', 'Development-Roadmap.md');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv) {
  const opts = {
    apply: false,
    json: false,
    verbose: false,
    toRoadmap: false,
    toDocs: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--apply' || arg === '-a') opts.apply = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--to-roadmap') opts.toRoadmap = true;
    else if (arg === '--to-docs') opts.toDocs = true;
  }

  return opts;
}

function showHelp() {
  console.log(`
Sync-Roadmap-Tasks-Skript

Synchronisiert Deps und Spec zwischen Doc-Tasks-Tabellen und der Roadmap.

USAGE:
  node scripts/sync-roadmap-tasks.mjs --to-roadmap [OPTIONS]
  node scripts/sync-roadmap-tasks.mjs --to-docs [OPTIONS]

RICHTUNG (eine muss angegeben werden):
      --to-roadmap   Sync Doc → Roadmap (Deps + Referenzen)
      --to-docs      Sync Roadmap → Doc (Deps + Spec)

OPTIONEN:
  -a, --apply        Änderungen tatsächlich anwenden (default: dry-run)
      --json         JSON-Output statt formatierter Tabelle
  -v, --verbose      Zeige Details zu allen gefundenen Tasks
  -h, --help         Diese Hilfe anzeigen

SYNC-REGELN (--to-roadmap):
  Doc.Deps → Roadmap.Deps        Wenn Doc mehr Einträge hat
  Doc.Referenzen → Roadmap.Spec  Wenn Doc mehr Referenzen hat

SYNC-REGELN (--to-docs):
  Roadmap.Deps → Doc.Deps        Wenn Roadmap mehr Einträge hat
  Roadmap.Spec → Doc.Referenzen  Wenn Roadmap mehr Referenzen hat

BEISPIELE:
  node scripts/sync-roadmap-tasks.mjs --to-roadmap           # Dry-run Doc→Roadmap
  node scripts/sync-roadmap-tasks.mjs --to-docs              # Dry-run Roadmap→Doc
  node scripts/sync-roadmap-tasks.mjs --to-roadmap --apply   # Änderungen anwenden
  node scripts/sync-roadmap-tasks.mjs --verbose    # Mit Details
`);
}

// ============================================================================
// Doc Tasks Table Parsing
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
 * Parst eine Task-Zeile aus einer Doc-Tasks-Tabelle
 * Format: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
 */
function parseDocTaskLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 6) return null;

  // Erste Zelle sollte eine Nummer sein (kann Suffix wie 'a', 'b' haben)
  const numberStr = cells[0];
  const match = numberStr.match(/^(\d+)([a-z])?$/);
  if (!match) return null;
  const number = numberStr;  // Als String behalten für exaktes Matching

  const beschreibung = cells[1];
  const prio = cells[2];
  const mvp = cells[3];
  const depsRaw = cells[4];
  const referenzen = cells[5];

  // Parse Deps (können #N, #Na, oder bN sein)
  const deps = depsRaw === '-'
    ? []
    : (depsRaw.match(/#(\d+[a-z]?)|b(\d+)/g)?.map(d => d.startsWith('#') ? d.slice(1) : d) ?? []);

  return {
    number,
    beschreibung,
    prio,
    mvp,
    depsRaw,
    deps,
    referenzen
  };
}

/**
 * Parst alle Tasks aus einem Dokument
 */
function parseDocTasks(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const tasks = [];
  let inTaskTable = false;

  for (const line of lines) {
    // Tasks-Tabelle erkennen (mit | # | Beschreibung |)
    if (line.includes('| # |') && line.includes('Beschreibung')) {
      inTaskTable = true;
      continue;
    }
    // Separator-Zeile überspringen
    if (inTaskTable && line.match(/^\|[\s:-]+\|/)) continue;
    // Tabelle beenden
    if (inTaskTable && !line.startsWith('|')) {
      if (line.trim() === '' || line.startsWith('#')) {
        inTaskTable = false;
      }
      continue;
    }
    // Zeilen parsen
    if (inTaskTable) {
      const task = parseDocTaskLine(line);
      if (task) tasks.push(task);
    }
  }

  return { filePath, fileName: basename(filePath), tasks, content };
}

// ============================================================================
// Roadmap Tasks Table Parsing
// ============================================================================

/**
 * Parst eine Task-Zeile aus der Roadmap-Tabelle
 * Format: | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 */
function parseRoadmapTaskLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 9) return null;

  // Nummer kann Suffix haben (z.B. 2917a, 2917b)
  const numberStr = cells[0];
  const match = numberStr.match(/^(\d+)([a-z])?$/);
  if (!match) return null;
  const number = numberStr;  // Als String behalten

  const depsRaw = cells[6];
  // Deps können #N, #Na, bN sein
  const deps = depsRaw === '-'
    ? []
    : (depsRaw.match(/#(\d+[a-z]?)|b(\d+)/g)?.map(d => d.startsWith('#') ? d.slice(1) : d) ?? []);

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
    originalLine: line
  };
}

/**
 * Parst alle Tasks aus der Roadmap
 */
function parseRoadmapTasks() {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const lines = content.split('\n');
  const tasks = [];
  let inTaskTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Task-Tabelle erkennen
    if (line.includes('| # | Status |')) {
      inTaskTable = true;
      continue;
    }
    // Bug-Tabelle überspringen
    if (line.includes('| b# |')) {
      inTaskTable = false;
      continue;
    }
    // Separator-Zeile überspringen
    if (inTaskTable && line.match(/^\|[\s:-]+\|/)) continue;
    // Tabelle beenden
    if (inTaskTable && !line.startsWith('|')) {
      if (line.trim() === '' || line.startsWith('#')) {
        inTaskTable = false;
      }
      continue;
    }
    // Zeilen parsen
    if (inTaskTable) {
      const task = parseRoadmapTaskLine(line);
      if (task) {
        task.lineIndex = i;
        tasks.push(task);
      }
    }
  }

  return { tasks, content, lines };
}

// ============================================================================
// Diff Calculation
// ============================================================================

/**
 * Normalisiert Deps für Vergleich (sortiert, dedupliziert)
 */
function normalizeDeps(deps) {
  const unique = [...new Set(deps.map(d => String(d)))];
  return unique.sort((a, b) => {
    // Numerisch sortieren wenn möglich
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
}

/**
 * Mapping von Dateinamen zu relativen Pfaden (von docs/architecture/ aus)
 */
const DOC_PATH_MAP = {
  // Features
  'Audio-System.md': '../features/Audio-System.md',
  'Character-System.md': '../features/Character-System.md',
  'Combat-System.md': '../features/Combat-System.md',
  'Dungeon-System.md': '../features/Dungeon-System.md',
  'Encounter-Balancing.md': '../features/Encounter-Balancing.md',
  'Encounter-System.md': '../features/Encounter-System.md',
  'Inventory-System.md': '../features/Inventory-System.md',
  'Loot-Feature.md': '../features/Loot-Feature.md',
  'Map-Feature.md': '../features/Map-Feature.md',
  'Quest-System.md': '../features/Quest-System.md',
  'Time-System.md': '../features/Time-System.md',
  'Travel-System.md': '../features/Travel-System.md',
  'Weather-System.md': '../features/Weather-System.md',
  // Domain
  'Creature.md': '../domain/Creature.md',
  'Faction.md': '../domain/Faction.md',
  'Item.md': '../domain/Item.md',
  'Journal.md': '../domain/Journal.md',
  'Map.md': '../domain/Map.md',
  'Map-Navigation.md': '../domain/Map-Navigation.md',
  'NPC-System.md': '../domain/NPC-System.md',
  'Path.md': '../domain/Path.md',
  'POI.md': '../domain/POI.md',
  'Quest.md': '../domain/Quest.md',
  'Shop.md': '../domain/Shop.md',
  'Terrain.md': '../domain/Terrain.md',
  // Application
  'Cartographer.md': '../application/Cartographer.md',
  'DetailView.md': '../application/DetailView.md',
  'Library.md': '../application/Library.md',
  'SessionRunner.md': '../application/SessionRunner.md',
  // Architecture (same folder)
  'Application.md': './Application.md',
  'Conventions.md': './Conventions.md',
  'Core.md': './Core.md',
  'Data-Flow.md': './Data-Flow.md',
  'Development-Roadmap.md': './Development-Roadmap.md',
  'EntityRegistry.md': './EntityRegistry.md',
  'Error-Handling.md': './Error-Handling.md',
  'EventBus.md': './EventBus.md',
  'Events-Catalog.md': './Events-Catalog.md',
  'Features.md': './Features.md',
  'Infrastructure.md': './Infrastructure.md',
  'Project-Structure.md': './Project-Structure.md',
};

/**
 * Konvertiert eine einzelne Referenz (z.B. "Travel-System.md#state-machine")
 * in Markdown-Link-Format für die Roadmap
 */
function refToMarkdownLink(ref) {
  // Bereits ein Markdown-Link?
  if (ref.startsWith('[')) return ref;

  // Extrahiere Dateiname und optionalen Anker
  const match = ref.match(/^([^#]+)(#.*)?$/);
  if (!match) return ref;

  const [, fileName, anchor = ''] = match;
  const relativePath = DOC_PATH_MAP[fileName];

  if (!relativePath) {
    // Unbekannte Datei - als einfachen Text belassen
    return ref;
  }

  // Format: [Datei.md#anker](relativer-pfad#anker)
  return `[${fileName}${anchor}](${relativePath}${anchor})`;
}

/**
 * Normalisiert Referenzen für Vergleich (als Array von einzelnen Referenzen)
 * Extrahiert den Anzeigetext aus Markdown-Links
 */
function normalizeRefs(refs) {
  if (!refs || refs === '-') return [];

  // Splitten bei Komma (aber nicht innerhalb von Markdown-Links)
  const parts = [];
  let current = '';
  let inLink = 0;

  for (const char of refs) {
    if (char === '[') inLink++;
    if (char === ')' && inLink > 0) inLink--;
    if (char === ',' && inLink === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  // Extrahiere Anzeigetext aus Markdown-Links für Vergleich
  return parts.map(p => {
    const match = p.match(/^\[([^\]]+)\]/);
    return match ? match[1] : p;
  });
}

/**
 * Formatiert Referenzen für die Roadmap (als Markdown-Links)
 */
function formatRefsForRoadmap(refs) {
  if (!refs || refs === '-') return '-';

  // Splitten und konvertieren
  const parts = refs.split(',').map(r => r.trim()).filter(r => r.length > 0);
  return parts.map(refToMarkdownLink).join(', ');
}

/**
 * Konvertiert Roadmap-Spec (Markdown-Links) zu Doc-Referenzen (einfach)
 * [Travel-System.md#state-machine](../features/...) → Travel-System.md#state-machine
 */
function formatRefsForDoc(spec) {
  if (!spec || spec === '-') return '-';

  // Extrahiere Anzeigetext aus Markdown-Links
  const parts = normalizeRefs(spec);
  return parts.join(', ');
}

/**
 * Formatiert Deps für Ausgabe in Tabelle
 */
function formatDeps(deps) {
  if (deps.length === 0) return '-';
  return deps.map(d => {
    // Bug-IDs (wie 'b4') bekommen kein #, aber Task-IDs (auch mit Suffix) schon
    if (typeof d === 'number') return `#${d}`;
    if (/^\d+[a-z]?$/.test(String(d))) return `#${d}`;  // Task-Nummer mit optionalem Suffix
    return d;  // Bug-IDs wie 'b4'
  }).join(', ');
}

/**
 * Berechnet Diffs zwischen Doc-Tasks und Roadmap-Tasks
 */
function calculateDiffs(docFiles, roadmapData, opts) {
  const diffs = {
    docsToRoadmap: [],     // Änderungen von Docs → Roadmap
    roadmapToDocs: [],     // Änderungen von Roadmap → Docs
    matchedTasks: 0,
    unmatchedDocTasks: 0,
    unmatchedRoadmapTasks: 0
  };

  // Build lookup maps
  const roadmapMap = new Map(roadmapData.tasks.map(t => [t.number, t]));
  const docTasksMap = new Map();

  for (const doc of docFiles) {
    for (const task of doc.tasks) {
      const existing = docTasksMap.get(task.number);
      if (!existing) {
        docTasksMap.set(task.number, { task, doc });
      }
    }
  }

  // Compare each doc task with roadmap
  for (const doc of docFiles) {
    for (const docTask of doc.tasks) {
      const roadmapTask = roadmapMap.get(docTask.number);

      if (!roadmapTask) {
        diffs.unmatchedDocTasks++;
        if (opts.verbose) {
          console.log(`[WARN] Task #${docTask.number} in ${doc.fileName} nicht in Roadmap`);
        }
        continue;
      }

      diffs.matchedTasks++;

      const docDeps = normalizeDeps(docTask.deps);
      const roadmapDeps = normalizeDeps(roadmapTask.deps);
      const docRefs = normalizeRefs(docTask.referenzen);
      const roadmapRefs = normalizeRefs(roadmapTask.spec);

      // ========== Doc → Roadmap (--to-roadmap) ==========
      if (opts.toRoadmap) {
        // Deps: Doc → Roadmap (wenn Doc mehr hat)
        const missingInRoadmap = docDeps.filter(d => !roadmapDeps.includes(d));
        if (missingInRoadmap.length > 0) {
          const mergedDeps = normalizeDeps([...roadmapTask.deps, ...docTask.deps]);
          diffs.docsToRoadmap.push({
            type: 'deps',
            taskNumber: docTask.number,
            source: doc.fileName,
            roadmapTask,
            docTask,
            currentValue: roadmapTask.depsRaw,
            newValue: formatDeps(mergedDeps),
            mergedDeps
          });
        }

        // Referenzen: Doc → Roadmap (wenn Doc mehr hat)
        if (docRefs.length > 0 && docRefs.length > roadmapRefs.length) {
          diffs.docsToRoadmap.push({
            type: 'spec',
            taskNumber: docTask.number,
            source: doc.fileName,
            roadmapTask,
            docTask,
            currentValue: roadmapTask.spec,
            newValue: formatRefsForRoadmap(docTask.referenzen)
          });
        }
      }

      // ========== Roadmap → Doc (--to-docs) ==========
      if (opts.toDocs) {
        // Deps: Roadmap → Doc (wenn Roadmap mehr hat)
        const missingInDoc = roadmapDeps.filter(d => !docDeps.includes(d));
        if (missingInDoc.length > 0) {
          const mergedDeps = normalizeDeps([...docTask.deps, ...roadmapTask.deps]);
          diffs.roadmapToDocs.push({
            type: 'deps',
            taskNumber: docTask.number,
            target: doc.fileName,
            targetPath: doc.filePath,
            roadmapTask,
            docTask,
            currentValue: docTask.depsRaw || '-',
            newValue: formatDeps(mergedDeps)
          });
        }

        // Referenzen: Roadmap → Doc (wenn Roadmap mehr hat)
        if (roadmapRefs.length > 0 && roadmapRefs.length > docRefs.length) {
          diffs.roadmapToDocs.push({
            type: 'referenzen',
            taskNumber: docTask.number,
            target: doc.fileName,
            targetPath: doc.filePath,
            roadmapTask,
            docTask,
            currentValue: docTask.referenzen || '-',
            newValue: formatRefsForDoc(roadmapTask.spec)
          });
        }
      }
    }
  }

  // Count unmatched roadmap tasks
  for (const [number, task] of roadmapMap) {
    if (!docTasksMap.has(number)) {
      diffs.unmatchedRoadmapTasks++;
      if (opts.verbose) {
        console.log(`[INFO] Task #${number} in Roadmap, aber nicht in Docs`);
      }
    }
  }

  return diffs;
}

// ============================================================================
// Apply Changes
// ============================================================================

/**
 * Wendet Änderungen auf die Roadmap an
 */
function applyRoadmapChanges(roadmapData, diffs, dryRun) {
  if (diffs.docsToRoadmap.length === 0) return false;

  const lines = [...roadmapData.lines];
  let modified = false;

  for (const diff of diffs.docsToRoadmap) {
    const task = diff.roadmapTask;
    const lineIndex = task.lineIndex;
    const originalLine = lines[lineIndex];

    // Parse the line into cells
    const cells = originalLine.split('|').map(c => c.trim());

    if (diff.type === 'deps') {
      // Update Deps column (index 7 after split with empty first element)
      cells[7] = diff.newValue;
      modified = true;
    } else if (diff.type === 'spec') {
      // Update Spec column (index 8 after split)
      cells[8] = diff.newValue;
      modified = true;
    }

    // Reconstruct line
    lines[lineIndex] = '| ' + cells.slice(1, -1).join(' | ') + ' |';
  }

  if (modified && !dryRun) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'), 'utf-8');
  }

  return modified;
}

/**
 * Wendet Änderungen auf Docs an
 */
function applyDocChanges(docFiles, diffs, dryRun) {
  if (diffs.roadmapToDocs.length === 0) return false;

  // Group diffs by target file
  const diffsByFile = new Map();
  for (const diff of diffs.roadmapToDocs) {
    const existing = diffsByFile.get(diff.targetPath) || [];
    existing.push(diff);
    diffsByFile.set(diff.targetPath, existing);
  }

  let modified = false;

  for (const [filePath, fileDiffs] of diffsByFile) {
    const doc = docFiles.find(d => d.filePath === filePath);
    if (!doc) continue;

    let content = doc.content;

    for (const diff of fileDiffs) {
      // Doc-Tabelle: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
      const taskNumber = diff.taskNumber;

      if (diff.type === 'deps') {
        // Deps ist Spalte 5: | # | Beschr | Prio | MVP? | DEPS | Refs |
        const regex = new RegExp(
          `^(\\|\\s*${taskNumber}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|)[^|]*(\\|[^|]*\\|)$`,
          'gm'
        );
        const replacement = `$1 ${diff.newValue} $2`;
        const newContent = content.replace(regex, replacement);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else if (diff.type === 'referenzen') {
        // Referenzen ist Spalte 6: | # | Beschr | Prio | MVP? | Deps | REFS |
        const regex = new RegExp(
          `^(\\|\\s*${taskNumber}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|)[^|]*\\|$`,
          'gm'
        );
        const replacement = `$1 ${diff.newValue} |`;
        const newContent = content.replace(regex, replacement);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
    }

    if (!dryRun && modified) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }

  return modified;
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatDiffTable(diffs) {
  const lines = [];

  if (diffs.docsToRoadmap.length > 0) {
    lines.push('\n┌─────────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ Doc → Roadmap Änderungen                                                    │');
    lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

    for (const diff of diffs.docsToRoadmap) {
      lines.push(`│ #${diff.taskNumber}: ${diff.type.toUpperCase()}`.padEnd(78) + '│');
      lines.push(`│   Quelle: ${diff.source}`.padEnd(78) + '│');
      lines.push(`│   Aktuell: ${diff.currentValue.slice(0, 50)}`.padEnd(78) + '│');
      lines.push(`│   Neu:     ${diff.newValue.slice(0, 50)}`.padEnd(78) + '│');
      lines.push('│'.padEnd(78) + '│');
    }
    lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  if (diffs.roadmapToDocs.length > 0) {
    lines.push('\n┌─────────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ Roadmap → Doc Änderungen                                                    │');
    lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

    for (const diff of diffs.roadmapToDocs) {
      lines.push(`│ #${diff.taskNumber}: ${diff.type.toUpperCase()}`.padEnd(78) + '│');
      lines.push(`│   Ziel:    ${diff.target}`.padEnd(78) + '│');
      lines.push(`│   Aktuell: ${(diff.currentValue || '-').slice(0, 50)}`.padEnd(78) + '│');
      lines.push(`│   Neu:     ${diff.newValue.slice(0, 50)}`.padEnd(78) + '│');
      lines.push('│'.padEnd(78) + '│');
    }
    lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  return lines.join('\n');
}

function formatSummary(diffs, applied) {
  const total = diffs.docsToRoadmap.length + diffs.roadmapToDocs.length;

  const lines = [
    '\n═══════════════════════════════════════════════════════════════════════════════',
    '                              ZUSAMMENFASSUNG                                   ',
    '═══════════════════════════════════════════════════════════════════════════════',
    `  Gematchte Tasks:           ${diffs.matchedTasks}`,
    `  Tasks nur in Docs:         ${diffs.unmatchedDocTasks}`,
    `  Tasks nur in Roadmap:      ${diffs.unmatchedRoadmapTasks}`,
    '',
    `  Doc → Roadmap Änderungen:  ${diffs.docsToRoadmap.length}`,
    `  Roadmap → Doc Änderungen:  ${diffs.roadmapToDocs.length}`,
    '',
    applied
      ? `  ✅ ${total} Änderungen angewendet`
      : `  ℹ️  ${total} Änderungen erkannt (dry-run, nutze --apply)`,
    '═══════════════════════════════════════════════════════════════════════════════'
  ];

  return lines.join('\n');
}

function formatJson(diffs, applied) {
  const output = {
    summary: {
      matchedTasks: diffs.matchedTasks,
      unmatchedDocTasks: diffs.unmatchedDocTasks,
      unmatchedRoadmapTasks: diffs.unmatchedRoadmapTasks,
      docsToRoadmapCount: diffs.docsToRoadmap.length,
      roadmapToDocsCount: diffs.roadmapToDocs.length,
      applied
    },
    docsToRoadmap: diffs.docsToRoadmap.map(d => ({
      taskNumber: d.taskNumber,
      type: d.type,
      source: d.source,
      currentValue: d.currentValue,
      newValue: d.newValue
    })),
    roadmapToDocs: diffs.roadmapToDocs.map(d => ({
      taskNumber: d.taskNumber,
      type: d.type,
      target: d.target,
      currentValue: d.currentValue,
      newValue: d.newValue
    }))
  };

  console.log(JSON.stringify(output, null, 2));
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

  // Validierung: Genau eine Richtung muss angegeben werden
  if (!opts.toRoadmap && !opts.toDocs) {
    console.error('❌ Fehler: Richtung muss angegeben werden: --to-roadmap oder --to-docs');
    console.error('   Nutze --help für Details.\n');
    process.exit(1);
  }
  if (opts.toRoadmap && opts.toDocs) {
    console.error('❌ Fehler: Nur eine Richtung erlaubt (--to-roadmap ODER --to-docs)');
    process.exit(1);
  }

  const direction = opts.toRoadmap ? 'Doc → Roadmap' : 'Roadmap → Doc';
  console.log(`🔄 Sync-Roadmap-Tasks (${direction})\n`);

  // 1. Find all docs with Tasks sections
  console.log('📂 Suche Dokumentationsdateien...');
  const allMarkdownFiles = findMarkdownFiles(DOCS_PATH);
  const docsWithTasks = [];

  for (const filePath of allMarkdownFiles) {
    // Skip Roadmap itself
    if (filePath === ROADMAP_PATH) continue;

    const doc = parseDocTasks(filePath);
    if (doc.tasks.length > 0) {
      docsWithTasks.push(doc);
      if (opts.verbose) {
        console.log(`   ${doc.fileName}: ${doc.tasks.length} Tasks`);
      }
    }
  }

  console.log(`   Gefunden: ${docsWithTasks.length} Dokumente mit Tasks-Sektionen`);
  console.log(`   Gesamt: ${docsWithTasks.reduce((sum, d) => sum + d.tasks.length, 0)} Tasks in Docs\n`);

  // 2. Parse Roadmap
  console.log('📋 Parse Roadmap...');
  const roadmapData = parseRoadmapTasks();
  console.log(`   Gefunden: ${roadmapData.tasks.length} Tasks in Roadmap\n`);

  // 3. Calculate diffs
  console.log('🔍 Berechne Unterschiede...');
  const diffs = calculateDiffs(docsWithTasks, roadmapData, opts);

  // 4. Output
  if (opts.json) {
    formatJson(diffs, opts.apply);
    return;
  }

  if (diffs.docsToRoadmap.length > 0 || diffs.roadmapToDocs.length > 0) {
    console.log(formatDiffTable(diffs));
  }

  // 5. Apply changes if requested
  let applied = false;
  if (opts.apply && (diffs.docsToRoadmap.length > 0 || diffs.roadmapToDocs.length > 0)) {
    console.log('\n⚡ Wende Änderungen an...');
    applyRoadmapChanges(roadmapData, diffs, false);
    applyDocChanges(docsWithTasks, diffs, false);
    applied = true;
  }

  console.log(formatSummary(diffs, applied));
}

main();
