#!/usr/bin/env node
/**
 * Migration Script: Convert entries to new trigger structure
 *
 * This script migrates creature entries from the old structure to the new
 * modular trigger/effect structure where triggers define activation and conditions
 * while effects define what happens.
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
 * Migrate a single entry to new trigger structure
 */
function migrateEntry(entry) {
  // Skip if already has new structure
  if (entry['trigger.activation']) {
    return entry;
  }

  // Determine activation type based on category or entry type
  let activation = 'action'; // default

  if (entry.category === 'trait' || entry.entryType === 'trait') {
    activation = 'passive';
  } else if (entry.category === 'bonus') {
    activation = 'bonus';
  } else if (entry.category === 'reaction') {
    activation = 'reaction';
  } else if (entry.category === 'legendary') {
    activation = 'action'; // legendary is a modifier, not activation
  }

  // Set activation
  entry['trigger.activation'] = activation;

  // Handle legendary actions
  if (entry.category === 'legendary') {
    entry['trigger.legendaryCost'] = 1; // Default cost
  }

  // Migrate targeting information
  if (!entry['trigger.targeting']) {
    entry['trigger.targeting'] = {};

    // For attacks
    if (entry.entryType === 'attack') {
      entry['trigger.targeting'].type = 'single';
      if (entry['attack.reach']) {
        entry['trigger.targeting'].range = entry['attack.reach'];
      } else if (entry['attack.range']) {
        entry['trigger.targeting'].range = entry['attack.range'];
      }
    }
    // For saves with area
    else if (entry.entryType === 'save' && entry['save.area']) {
      const areaText = entry['save.area'];

      // Try to detect area type from text
      if (areaText.includes('cone')) {
        entry['trigger.targeting'].type = 'area';
        entry['trigger.targeting'].shape = 'cone';
        // Extract size if possible (e.g., "90-foot cone" -> "90 ft.")
        const sizeMatch = areaText.match(/(\d+)\s*-?\s*foot/i);
        if (sizeMatch) {
          entry['trigger.targeting'].size = `${sizeMatch[1]} ft.`;
        }
      } else if (areaText.includes('line')) {
        entry['trigger.targeting'].type = 'area';
        entry['trigger.targeting'].shape = 'line';
        const sizeMatch = areaText.match(/(\d+)\s*-?\s*foot/i);
        if (sizeMatch) {
          entry['trigger.targeting'].size = `${sizeMatch[1]} ft.`;
        }
      } else if (areaText.includes('radius') || areaText.includes('emanation')) {
        entry['trigger.targeting'].type = 'area';
        entry['trigger.targeting'].shape = 'emanation';
        const sizeMatch = areaText.match(/(\d+)\s*-?\s*foot/i);
        if (sizeMatch) {
          entry['trigger.targeting'].size = `${sizeMatch[1]} ft.`;
        }
      } else if (areaText.includes('sight') || areaText.includes('see')) {
        entry['trigger.targeting'].type = 'single';
        entry['trigger.targeting'].sightRequired = true;
        const rangeMatch = areaText.match(/(\d+)\s*-?\s*foot/i);
        if (rangeMatch) {
          entry['trigger.targeting'].range = `${rangeMatch[1]} ft.`;
        }
      } else {
        // Default to single target
        entry['trigger.targeting'].type = 'single';
      }
    }
    // For multiattack (affects self)
    else if (entry.entryType === 'multiattack') {
      entry['trigger.targeting'].type = 'self';
    }
    // Default
    else {
      entry['trigger.targeting'].type = 'single';
    }
  }

  // Migrate reaction triggers
  if (activation === 'reaction' && entry.text) {
    // Try to extract trigger from text
    const triggerPatterns = [
      /when (.*?)[,\.]/i,
      /if (.*?)[,\.]/i,
      /after (.*?)[,\.]/i,
      /response to (.*?)[,\.]/i,
    ];

    for (const pattern of triggerPatterns) {
      const match = entry.text.match(pattern);
      if (match) {
        entry['trigger.reactionTrigger'] = match[1];
        break;
      }
    }
  }

  // Clean up old cost field if it exists
  if (entry['trigger.cost']) {
    delete entry['trigger.cost'];
  }

  return entry;
}

/**
 * Process a single creature file
 */
function processCreatureFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  const frontmatter = parsed.attributes;

  let hasChanges = false;

  // Process main entries
  if (frontmatter.entries && Array.isArray(frontmatter.entries)) {
    frontmatter.entries = frontmatter.entries.map(entry => {
      const before = JSON.stringify(entry);
      const migrated = migrateEntry(entry);
      const after = JSON.stringify(migrated);
      if (before !== after) {
        hasChanges = true;
      }
      return migrated;
    });
  }

  // Process spellcasting entries
  if (frontmatter.spellcastingEntries && Array.isArray(frontmatter.spellcastingEntries)) {
    frontmatter.spellcastingEntries = frontmatter.spellcastingEntries.map(entry => {
      const before = JSON.stringify(entry);
      const migrated = migrateEntry(entry);
      const after = JSON.stringify(migrated);
      if (before !== after) {
        hasChanges = true;
      }
      return migrated;
    });
  }

  if (!hasChanges) {
    return false;
  }

  // Reconstruct the file
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