#!/usr/bin/env node
// scripts/rename-presets.mjs
// Rename preset files to match their content names with proper capitalization

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRESETS_DIR = path.resolve(__dirname, '../Presets');

/**
 * Slugify with case preservation (mirrors src/features/data-manager/storage/storage.ts)
 */
function preserveCaseSlugify(value) {
  const trimmed = value.trim();
  const replaced = trimmed
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return replaced || "entry";
}

/**
 * Extract frontmatter from markdown file
 * Only extracts root-level fields, ignores nested structures
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    // Skip lines that start with whitespace (nested fields)
    if (line.startsWith(' ') || line.startsWith('\t') || line.startsWith('-')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

/**
 * Recursively find all .md files in a directory
 */
function findMarkdownFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Rename preset file to match content name
 */
function renamePresetFile(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter || !frontmatter.name) {
    console.log(`⚠️  Skipping ${filePath}: No name in frontmatter`);
    return { renamed: false, reason: 'no-name' };
  }

  const currentFilename = path.basename(filePath);
  const newFilename = preserveCaseSlugify(frontmatter.name) + '.md';

  if (currentFilename === newFilename) {
    return { renamed: false, reason: 'same-name' };
  }

  const newPath = path.join(path.dirname(filePath), newFilename);

  // Check if target already exists
  if (fs.existsSync(newPath)) {
    console.log(`❌ Cannot rename ${currentFilename} → ${newFilename}: Target already exists`);
    return { renamed: false, reason: 'target-exists', currentFilename, newFilename };
  }

  if (dryRun) {
    console.log(`🔍 Would rename: ${currentFilename} → ${newFilename}`);
    return { renamed: false, reason: 'dry-run', currentFilename, newFilename };
  }

  fs.renameSync(filePath, newPath);
  console.log(`✅ Renamed: ${currentFilename} → ${newFilename}`);
  return { renamed: true, currentFilename, newFilename };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const category = args.find(arg => !arg.startsWith('--'));

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: rename-presets.mjs [category] [--dry-run]');
    console.log('');
    console.log('Categories: creatures, spells, items, equipment, terrains, regions, calendars');
    console.log('If no category specified, processes all categories');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run    Show what would be renamed without actually renaming');
    console.log('');
    console.log('Examples:');
    console.log('  rename-presets.mjs --dry-run');
    console.log('  rename-presets.mjs creatures');
    console.log('  rename-presets.mjs creatures --dry-run');
    process.exit(0);
  }

  const categoryDirs = {
    creatures: 'Creatures',
    spells: 'Spells',
    items: 'Items',
    equipment: 'Equipment',
    terrains: 'Terrains',
    regions: 'Regions',
    calendars: 'Calendars',
  };

  let targetDirs = [];

  if (category) {
    const dirName = categoryDirs[category.toLowerCase()];
    if (!dirName) {
      console.error(`❌ Unknown category: ${category}`);
      console.error('Valid categories:', Object.keys(categoryDirs).join(', '));
      process.exit(1);
    }
    targetDirs = [path.join(PRESETS_DIR, dirName)];
  } else {
    targetDirs = Object.values(categoryDirs).map(dir => path.join(PRESETS_DIR, dir));
  }

  console.log(dryRun ? '🔍 DRY RUN MODE - No files will be renamed\n' : '');

  let totalRenamed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory not found: ${dir}`);
      continue;
    }

    const categoryName = path.basename(dir);
    console.log(`\n📁 Processing ${categoryName}...`);

    const files = findMarkdownFiles(dir);
    console.log(`Found ${files.length} files\n`);

    for (const file of files) {
      const result = renamePresetFile(file, dryRun);

      if (result.renamed) {
        totalRenamed++;
      } else if (result.reason === 'target-exists') {
        totalErrors++;
      } else if (result.reason !== 'same-name') {
        totalSkipped++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Renamed: ${totalRenamed}`);
  console.log(`⚠️  Skipped: ${totalSkipped}`);
  console.log(`❌ Errors:  ${totalErrors}`);

  if (dryRun && totalRenamed > 0) {
    console.log('\nRun without --dry-run to actually rename files');
  }
}

main();
