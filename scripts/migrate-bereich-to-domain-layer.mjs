#!/usr/bin/env node
/**
 * Once-Off Migration: Bereich → Domain + Layer
 *
 * Migriert alle Task-Tabellen vom 9-Spalten-Format (mit Bereich)
 * zum neuen 10-Spalten-Format (mit Domain + Layer).
 *
 * Transformationen:
 * - Header: "| Bereich |" → "| Domain | Layer |"
 * - Daten: Layer-Spalte mit "-" einfügen
 *
 * Usage:
 *   node scripts/migrate-bereich-to-domain-layer.mjs           # Migration ausführen
 *   node scripts/migrate-bereich-to-domain-layer.mjs --dry-run # Nur Vorschau
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = join(__dirname, '..', 'docs');
const ROADMAP_PATH = join(DOCS_PATH, 'architecture', 'Development-Roadmap.md');

// CLI
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-n');

// Neue Header/Separator
const NEW_HEADER = '| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |';
const NEW_SEPARATOR = '|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|';

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Prüft ob eine Zeile ein alter 9-Spalten-Header ist
 */
function isOldHeader(line) {
  return /\|\s*#\s*\|\s*Status\s*\|\s*Bereich\s*\|/i.test(line);
}

/**
 * Prüft ob eine Zeile ein Separator ist
 */
function isSeparator(line) {
  return /^\|[\s:|-]+\|$/.test(line);
}

/**
 * Prüft ob eine Zeile eine Task-Datenzeile ist (9 Spalten, altes Format)
 * Format: | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 */
function isOldDataLine(line) {
  // Muss mit | beginnen und eine Nummer haben
  if (!line.startsWith('|')) return false;

  const cells = line.split('|').slice(1, -1);
  if (cells.length !== 9) return false;

  // Erste Zelle muss eine Task-ID sein (Zahl oder alphanumerisch wie 428b)
  const firstCell = cells[0].trim();
  return /^\d+[a-z]?$/i.test(firstCell);
}

/**
 * Migriert eine alte Datenzeile zum neuen Format
 * Alt:  | # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 * Neu:  | # | Status | Domain  | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 */
function migrateDataLine(line) {
  const cells = line.split('|');
  // cells[0] = '' (vor erstem |)
  // cells[1] = #
  // cells[2] = Status
  // cells[3] = Bereich (wird zu Domain)
  // cells[4] = Beschreibung
  // ... rest
  // cells[10] = '' (nach letztem |)

  // Layer-Spalte einfügen nach Domain (Index 3)
  cells.splice(4, 0, ' - ');

  return cells.join('|');
}

/**
 * Migriert eine einzelne Datei
 */
function migrateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  let headersMigrated = 0;
  let linesMigrated = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Header migrieren
    if (isOldHeader(line)) {
      lines[i] = NEW_HEADER;
      headersMigrated++;
      modified = true;

      // Nächste Zeile sollte Separator sein
      if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
        lines[i + 1] = NEW_SEPARATOR;
      }
      continue;
    }

    // Datenzeilen migrieren (nur nach einem migrierten Header)
    if (isOldDataLine(line)) {
      lines[i] = migrateDataLine(line);
      linesMigrated++;
      modified = true;
    }
  }

  return {
    modified,
    headersMigrated,
    linesMigrated,
    content: lines.join('\n')
  };
}

/**
 * Findet alle Markdown-Dateien rekursiv
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

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('Migrating Bereich → Domain + Layer...\n');

  if (DRY_RUN) {
    console.log('(Dry-run mode - keine Änderungen werden gespeichert)\n');
  }

  const stats = {
    filesProcessed: 0,
    headersMigrated: 0,
    linesMigrated: 0
  };

  // Alle Markdown-Dateien in docs/ finden
  const files = findMarkdownFiles(DOCS_PATH);

  for (const filePath of files) {
    const relativePath = filePath.replace(join(__dirname, '..') + '/', '');
    const result = migrateFile(filePath);

    if (result.modified) {
      console.log(`${relativePath}:`);
      if (result.headersMigrated > 0) {
        console.log(`  ⚙ ${result.headersMigrated} Header migriert`);
      }
      if (result.linesMigrated > 0) {
        console.log(`  ⚙ ${result.linesMigrated} Zeilen migriert`);
      }

      if (!DRY_RUN) {
        writeFileSync(filePath, result.content);
      }

      stats.filesProcessed++;
      stats.headersMigrated += result.headersMigrated;
      stats.linesMigrated += result.linesMigrated;
    }
  }

  // Zusammenfassung
  console.log('\nSummary:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Headers migrated: ${stats.headersMigrated}`);
  console.log(`  Data lines migrated: ${stats.linesMigrated}`);

  if (DRY_RUN) {
    console.log('\n(Dry-run - keine Änderungen gespeichert)');
  } else {
    console.log('\n✅ Migration abgeschlossen');
  }
}

main();
