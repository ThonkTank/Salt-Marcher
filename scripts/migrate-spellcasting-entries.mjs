#!/usr/bin/env node
/**
 * Migration Script: Separate spellcasting entries from main entries
 *
 * This script migrates spellcasting entries from the main 'entries' array
 * to a new 'spellcastingEntries' array in creature preset files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREATURES_DIR = path.join(__dirname, '..', 'Presets', 'Creatures');

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { attributes: {}, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { attributes: {}, body: content };
  }

  const yamlContent = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');

  try {
    const attributes = yaml.load(yamlContent) || {};
    return { attributes, body };
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    return { attributes: {}, body: content };
  }
}

/**
 * Process a single creature file
 */
function processCreatureFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  const frontmatter = parsed.attributes;

  // Skip if no entries
  if (!frontmatter.entries || !Array.isArray(frontmatter.entries)) {
    return false;
  }

  // Separate spellcasting entries
  const spellcastingEntries = [];
  const regularEntries = [];

  for (const entry of frontmatter.entries) {
    if (entry.entryType === 'spellcasting') {
      spellcastingEntries.push(entry);
    } else {
      regularEntries.push(entry);
    }
  }

  // Only update if there are spellcasting entries to migrate
  if (spellcastingEntries.length === 0) {
    return false;
  }

  // Update frontmatter
  frontmatter.entries = regularEntries;
  if (spellcastingEntries.length > 0) {
    frontmatter.spellcastingEntries = spellcastingEntries;
  }

  // Reconstruct the file with js-yaml
  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });

  const newContent = [
    '---',
    yamlStr.trim(),
    '---',
    parsed.body || ''
  ].join('\n');

  fs.writeFileSync(filePath, newContent);
  return true;
}

/**
 * Process all creature files
 */
function migrateAllCreatures() {
  let migratedCount = 0;
  let totalCount = 0;

  // Process all subdirectories
  const subdirs = fs.readdirSync(CREATURES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const subdir of subdirs) {
    const subdirPath = path.join(CREATURES_DIR, subdir);
    const files = fs.readdirSync(subdirPath)
      .filter(file => file.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(subdirPath, file);
      totalCount++;

      try {
        if (processCreatureFile(filePath)) {
          migratedCount++;
          console.log(`✓ Migrated: ${subdir}/${file}`);
        }
      } catch (error) {
        console.error(`✗ Error processing ${subdir}/${file}:`, error.message);
      }
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Migrated ${migratedCount} of ${totalCount} creature files`);
}

// Run migration
migrateAllCreatures();