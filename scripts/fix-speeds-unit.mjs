#!/usr/bin/env node
// scripts/fix-speeds-unit.mjs
// Strips "ft." from already-migrated speed values

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRESETS_DIR = path.resolve(__dirname, '../Presets/Creatures');

/**
 * Strip " ft." from value
 */
function stripUnit(value) {
  if (!value) return '';
  return value.replace(/\s*ft\.?$/i, '').trim();
}

/**
 * Process a single markdown file
 */
async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Split frontmatter and body
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
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

  // Only process arrays with units in values
  if (!frontmatter.speeds || !Array.isArray(frontmatter.speeds)) {
    return { updated: false, reason: 'no array speeds' };
  }

  let changed = false;
  for (const entry of frontmatter.speeds) {
    if (entry.value && entry.value.includes('ft')) {
      const oldValue = entry.value;
      entry.value = stripUnit(entry.value);
      if (oldValue !== entry.value) {
        changed = true;
      }
    }
  }

  if (!changed) {
    return { updated: false, reason: 'no units to strip' };
  }

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

  return { updated: true };
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
 * Main function
 */
async function main() {
  console.log('🚀 Stripping units from speed values...\n');
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
      updated++;
    } else {
      if (process.env.VERBOSE) {
        console.log(`⏭️  ${relativePath} (${result.reason || 'skipped'})`);
      }
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Fix complete!`);
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
