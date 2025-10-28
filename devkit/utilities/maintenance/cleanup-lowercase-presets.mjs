#!/usr/bin/env node
// scripts/cleanup-lowercase-presets.mjs
// Remove duplicate lowercase preset files after capitalization update

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_PATH = path.resolve(__dirname, '../../../..');

/**
 * Find and remove duplicate lowercase files
 */
function cleanupDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let deletedCount = 0;

  for (const entry of files) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      deletedCount += cleanupDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Check if this is a lowercase file that has a capitalized version
      const basename = entry.name.slice(0, -3); // Remove .md
      const files_in_dir = fs.readdirSync(dir);

      // Check if there's a file with the same name but different capitalization
      const hasDuplicate = files_in_dir.some(f =>
        f !== entry.name &&
        f.toLowerCase() === entry.name.toLowerCase() &&
        f.endsWith('.md')
      );

      if (hasDuplicate && entry.name === entry.name.toLowerCase()) {
        // This is the lowercase version and a capitalized version exists
        console.log(`Deleting: ${path.relative(VAULT_PATH, fullPath)}`);
        fs.unlinkSync(fullPath);
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: cleanup-lowercase-presets.mjs [--dry-run]');
  console.log('');
  console.log('Removes duplicate lowercase preset files from the vault');
  console.log('when capitalized versions exist.');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run    Show what would be deleted without actually deleting');
  process.exit(0);
}

const directories = [
  path.join(VAULT_PATH, 'SaltMarcher/Creatures'),
  path.join(VAULT_PATH, 'SaltMarcher/Spells'),
  path.join(VAULT_PATH, 'SaltMarcher/Items'),
  path.join(VAULT_PATH, 'SaltMarcher/Equipment'),
];

console.log(dryRun ? '🔍 DRY RUN MODE\n' : '');

let totalDeleted = 0;
for (const dir of directories) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    continue;
  }

  const categoryName = path.basename(dir);
  console.log(`\n📁 Cleaning ${categoryName}...`);

  const count = cleanupDirectory(dir);
  totalDeleted += count;

  console.log(`Deleted ${count} duplicate files`);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Total deleted: ${totalDeleted}`);

if (dryRun && totalDeleted > 0) {
  console.log('\nRun without --dry-run to actually delete files');
}
