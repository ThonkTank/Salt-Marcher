#!/usr/bin/env node
// scripts/migrate-speeds-format.mjs
// Migrates creature speeds from object format to array format

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRESETS_DIR = path.resolve(__dirname, '../Presets/Creatures');

// Known speed types in order
const SPEED_TYPES = ['walk', 'burrow', 'climb', 'fly', 'swim'];

/**
 * Strip " ft." or "ft." from speed value since UI adds it via valueConfig.unit
 * @param {string} value - Speed value like "30 ft." or "60ft."
 * @returns {string} Stripped value like "30" or "60"
 */
function stripUnit(value) {
  if (!value) return '';
  // Remove various forms: " ft.", "ft.", " ft", "ft"
  return value.replace(/\s*ft\.?$/i, '').trim();
}

/**
 * Convert old speeds object format to new array format
 * @param {object} speeds - Old format: {walk: {distance: "30 ft."}, fly: {distance: "60 ft.", hover: true}}
 * @returns {array} New format: [{type: "walk", value: "30"}, {type: "fly", value: "60", hover: true}]
 */
function migrateSpeedsFormat(speeds) {
  if (!speeds || typeof speeds !== 'object') {
    return undefined;
  }

  // Already in new format (array)
  if (Array.isArray(speeds)) {
    return speeds;
  }

  // Convert object to array
  const result = [];

  for (const type of SPEED_TYPES) {
    const speedEntry = speeds[type];
    if (!speedEntry) continue;

    const rawValue = speedEntry.distance || speedEntry.value || "";
    const entry = {
      type: type,
      value: stripUnit(rawValue),  // Strip unit since UI adds it
    };

    // Preserve hover flag for fly speed
    if (type === 'fly' && speedEntry.hover === true) {
      entry.hover = true;
    }

    result.push(entry);
  }

  // Handle extras if present
  if (speeds.extras && Array.isArray(speeds.extras)) {
    for (const extra of speeds.extras) {
      if (extra.label && extra.distance) {
        result.push({
          type: extra.label,
          value: stripUnit(extra.distance),  // Strip unit since UI adds it
          ...(extra.note ? { note: extra.note } : {}),
        });
      }
    }
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Process a single markdown file
 */
async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Split frontmatter and body
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    console.log(`⏭️  Skipping ${path.basename(filePath)} (no frontmatter)`);
    return { updated: false };
  }

  const [, frontmatterText, body] = frontmatterMatch;

  // Parse frontmatter
  let frontmatter;
  try {
    frontmatter = yaml.load(frontmatterText);
  } catch (error) {
    console.error(`❌ Error parsing ${path.basename(filePath)}:`, error.message);
    return { updated: false, error: error.message };
  }

  // Check if speeds needs migration
  if (!frontmatter.speeds || Array.isArray(frontmatter.speeds)) {
    return { updated: false, reason: 'already migrated or no speeds' };
  }

  // Migrate speeds format
  const oldSpeeds = frontmatter.speeds;
  const newSpeeds = migrateSpeedsFormat(oldSpeeds);

  if (!newSpeeds) {
    return { updated: false, reason: 'no valid speeds to migrate' };
  }

  frontmatter.speeds = newSpeeds;

  // Serialize back to YAML
  const newFrontmatterText = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  const newContent = `---\n${newFrontmatterText}---\n${body}`;

  // Write back
  await fs.writeFile(filePath, newContent, 'utf-8');

  return {
    updated: true,
    old: oldSpeeds,
    new: newSpeeds,
  };
}

/**
 * Recursively find all .md files in a directory
 */
async function findMarkdownFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting speeds format migration...\n');
  console.log(`📁 Scanning: ${PRESETS_DIR}\n`);

  const files = await findMarkdownFiles(PRESETS_DIR);
  console.log(`📄 Found ${files.length} markdown files\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const relativePath = path.relative(PRESETS_DIR, file);
    const result = await processFile(file);

    if (result.error) {
      console.error(`❌ ${relativePath}: ${result.error}`);
      errors++;
    } else if (result.updated) {
      console.log(`✅ ${relativePath}`);
      if (process.env.VERBOSE) {
        console.log(`   Old: ${JSON.stringify(result.old)}`);
        console.log(`   New: ${JSON.stringify(result.new)}`);
      }
      updated++;
    } else {
      if (process.env.VERBOSE) {
        console.log(`⏭️  ${relativePath} (${result.reason || 'skipped'})`);
      }
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log('='.repeat(60));

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
