#!/usr/bin/env node
/**
 * Once-Off Sync: Roadmap Tasks → Spec Documents
 *
 * Synchronisiert alle Tasks aus der Development-Roadmap in ihre
 * erste referenzierte Spec-Datei.
 *
 * - Migriert Header von "Referenzen" zu "Spec"
 * - Fügt fehlende Tasks ein
 * - Aktualisiert existierende Tasks
 *
 * Usage:
 *   node scripts/sync-tasks-to-specs.mjs           # Sync ausführen
 *   node scripts/sync-tasks-to-specs.mjs --dry-run # Nur Vorschau
 *   node scripts/sync-tasks-to-specs.mjs --verbose # Detaillierte Ausgabe
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { parseRoadmap, formatDeps } from './core/table/parser.mjs';
import { RoadmapTaskSchema } from './core/table/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = join(__dirname, '..', 'docs');
const ROADMAP_PATH = join(DOCS_PATH, 'architecture', 'Development-Roadmap.md');

// ============================================================================
// CLI Parsing
// ============================================================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-n');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extrahiert die erste Spec-Datei aus der Spec-Spalte
 * z.B. "Travel-System.md#state-machine, Events-Catalog.md#travel" → "Travel-System.md"
 */
function extractFirstSpecFile(spec) {
  if (!spec || spec === '-') return null;

  // Erste Referenz nehmen (vor Komma)
  const firstRef = spec.split(',')[0].trim();

  // Anchor entfernen
  const fileName = firstRef.split('#')[0].trim();

  return fileName || null;
}

/**
 * Findet den vollen Pfad zu einer Spec-Datei
 */
function findSpecFile(fileName) {
  const searchDirs = ['features', 'domain', 'architecture', 'application'];

  for (const dir of searchDirs) {
    const fullPath = join(DOCS_PATH, dir, fileName);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Baut eine Task-Zeile im Roadmap-Format
 */
function buildTaskLine(task) {
  const deps = Array.isArray(task.deps) ? formatDeps(task.deps) : (task.depsRaw || '-');

  return `| ${task.number} | ${task.status} | ${task.bereich} | ${task.beschreibung} | ${task.prio} | ${task.mvp} | ${deps} | ${task.spec} | ${task.imp || '-'} |`;
}

/**
 * Aktualisiert eine existierende Task-Zeile
 */
function updateTaskLine(existingLine, task) {
  // Komplett ersetzen mit neuen Werten
  return buildTaskLine(task);
}

// ============================================================================
// Main Logic
// ============================================================================

function main() {
  console.log('Syncing tasks to spec docs...\n');

  // 1. Roadmap laden
  const roadmapContent = readFileSync(ROADMAP_PATH, 'utf-8');
  const parseResult = parseRoadmap(roadmapContent, { separateBugs: true });

  if (!parseResult.ok) {
    console.error('Failed to parse roadmap:', parseResult.error.message);
    process.exit(1);
  }

  const { tasks } = parseResult.value;

  // 2. Tasks nach Spec-Datei gruppieren
  const tasksBySpec = new Map();

  for (const task of tasks) {
    const specFile = extractFirstSpecFile(task.spec);
    if (!specFile) continue;

    if (!tasksBySpec.has(specFile)) {
      tasksBySpec.set(specFile, []);
    }
    tasksBySpec.get(specFile).push(task);
  }

  // Statistiken
  const stats = {
    docsProcessed: 0,
    headersMigrated: 0,
    tasksInserted: 0,
    tasksUpdated: 0,
    skippedNoFile: 0,
    errors: []
  };

  // 3. Pro Spec-Datei synchronisieren
  for (const [specFileName, specTasks] of tasksBySpec) {
    const specPath = findSpecFile(specFileName);

    if (!specPath) {
      if (VERBOSE) {
        console.log(`  ⚠ Datei nicht gefunden: ${specFileName}`);
      }
      stats.skippedNoFile++;
      continue;
    }

    const relativePath = specPath.replace(join(__dirname, '..') + '/', '');
    console.log(`${relativePath}:`);

    let content = readFileSync(specPath, 'utf-8');
    let lines = content.split('\n');
    let modified = false;

    // 3a. Header "Referenzen" → "Spec" umbenennen
    const headerIndex = lines.findIndex(line =>
      line.includes('| # |') && line.includes('Referenzen')
    );

    if (headerIndex !== -1) {
      lines[headerIndex] = lines[headerIndex].replace('Referenzen', 'Spec');
      console.log('  ⚙ Header: "Referenzen" → "Spec"');
      stats.headersMigrated++;
      modified = true;
    }

    // 3b. Task-Tabelle finden
    const taskTableHeaderIndex = lines.findIndex(line =>
      /^\|\s*#\s*\|/.test(line) && /Beschreibung/.test(line)
    );

    if (taskTableHeaderIndex === -1) {
      // Keine Tabelle gefunden → am Ende erstellen
      console.log('  ⚙ Neue Task-Tabelle erstellt');

      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Implementierungs-Tasks');
      lines.push('');
      lines.push(RoadmapTaskSchema.headerText);
      lines.push(RoadmapTaskSchema.separatorText);

      for (const task of specTasks) {
        lines.push(buildTaskLine(task));
        console.log(`  + #${task.number} ${task.beschreibung.slice(0, 40)}...`);
        stats.tasksInserted++;
      }

      modified = true;
    } else {
      // Tabelle existiert → Tasks einfügen/aktualisieren

      // Letzte Task-Zeile in der Tabelle finden
      let lastTaskLineIndex = taskTableHeaderIndex + 1; // Nach Header
      for (let i = taskTableHeaderIndex + 2; i < lines.length; i++) {
        if (/^\|\s*\d+\s*\|/.test(lines[i])) {
          lastTaskLineIndex = i;
        } else if (lines[i].trim() === '' || lines[i].startsWith('#')) {
          break;
        }
      }

      // Tasks synchronisieren
      for (const task of specTasks) {
        const taskPattern = new RegExp(`^\\|\\s*${task.number}\\s*\\|`);
        const existingIndex = lines.findIndex(line => taskPattern.test(line));

        if (existingIndex !== -1) {
          // Task existiert → aktualisieren
          const oldLine = lines[existingIndex];
          const newLine = updateTaskLine(oldLine, task);

          if (oldLine !== newLine) {
            lines[existingIndex] = newLine;
            if (VERBOSE) {
              console.log(`  ~ #${task.number} ${task.beschreibung.slice(0, 40)}...`);
            }
            stats.tasksUpdated++;
            modified = true;
          }
        } else {
          // Task existiert nicht → einfügen
          lastTaskLineIndex++;
          lines.splice(lastTaskLineIndex, 0, buildTaskLine(task));
          console.log(`  + #${task.number} ${task.beschreibung.slice(0, 40)}...`);
          stats.tasksInserted++;
          modified = true;
        }
      }
    }

    // 3c. Datei speichern
    if (modified && !DRY_RUN) {
      writeFileSync(specPath, lines.join('\n'));
    }

    if (modified) {
      stats.docsProcessed++;
    }

    console.log('');
  }

  // 4. Zusammenfassung
  console.log('Summary:');
  console.log(`  Docs processed: ${stats.docsProcessed}`);
  console.log(`  Headers migrated: ${stats.headersMigrated}`);
  console.log(`  Tasks inserted: ${stats.tasksInserted}`);
  console.log(`  Tasks updated: ${stats.tasksUpdated}`);
  if (stats.skippedNoFile > 0) {
    console.log(`  Skipped (file not found): ${stats.skippedNoFile}`);
  }

  if (DRY_RUN) {
    console.log('\n  (Dry-run - keine Änderungen gespeichert)');
  }

  // Tasks ohne Spec zählen
  const tasksWithoutSpec = tasks.filter(t => !t.spec || t.spec === '-').length;
  if (tasksWithoutSpec > 0 && VERBOSE) {
    console.log(`  Tasks without spec: ${tasksWithoutSpec}`);
  }
}

main();
