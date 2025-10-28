#!/usr/bin/env node
// Fix token fields (passivesList, sensesList, languagesList) to use new object format
// OLD: passivesList: ["Passive Perception 20"]
// NEW: passivesList: [{skill: "Perception", value: "20"}]

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = join(__dirname, '../../..');
const VAULT_ROOT = join(PLUGIN_ROOT, '../../..');
const CREATURES_DIR = process.argv[2] || join(VAULT_ROOT, 'SaltMarcher/Creatures');

let filesProcessed = 0;
let passivesListFixed = 0;
let sensesListFixed = 0;
let languagesListFixed = 0;

/**
 * Parse passivesList from old format to new format
 * "Passive Perception 20" → {skill: "Perception", value: "20"}
 */
function parsePassivesList(line) {
  const match = line.match(/passivesList:\s*\[(.*)\]/);
  if (!match) return null;

  const content = match[1];
  const items = content.match(/"([^"]+)"/g);
  if (!items) return null;

  const parsed = items.map(item => {
    const text = item.replace(/"/g, '');
    const passiveMatch = text.match(/^Passive\s+(\w+)\s+(\d+)$/i);
    if (passiveMatch) {
      return { skill: passiveMatch[1], value: passiveMatch[2] };
    }
    // Fallback
    return { skill: "Perception", value: text.replace(/\D/g, '') || "10" };
  });

  return parsed;
}

/**
 * Parse sensesList from old format to new format
 * "darkvision 120 ft." → {type: "darkvision", range: "120"}
 */
function parseSensesList(line) {
  const match = line.match(/sensesList:\s*\[(.*)\]/);
  if (!match) return null;

  const content = match[1];
  const items = content.match(/"([^"]+)"/g);
  if (!items) return null;

  const parsed = items.map(item => {
    const text = item.replace(/"/g, '');
    const senseMatch = text.match(/^(\w+)\s+(\d+)\s*ft\.?$/i);
    if (senseMatch) {
      return { type: senseMatch[1].toLowerCase(), range: senseMatch[2] };
    }
    // No range - just type
    return { type: text.toLowerCase(), range: "" };
  });

  return parsed;
}

/**
 * Parse languagesList from old format to new format
 * "Deep Speech" → {value: "Deep Speech"}
 */
function parseLanguagesList(line) {
  const match = line.match(/languagesList:\s*\[(.*)\]/);
  if (!match) return null;

  const content = match[1];
  const items = content.match(/"([^"]+)"/g);
  if (!items) return null;

  const parsed = items.map(item => {
    const text = item.replace(/"/g, '');
    return { value: text };
  });

  return parsed;
}

/**
 * Convert parsed array to YAML format
 */
function toYAML(fieldName, items, indent = '') {
  if (!items || items.length === 0) return `${fieldName}: []`;

  let yaml = `${fieldName}:\n`;
  for (const item of items) {
    yaml += `${indent}  -`;
    const keys = Object.keys(item);
    if (keys.length === 1) {
      yaml += ` ${keys[0]}: "${item[keys[0]]}"\n`;
    } else {
      yaml += '\n';
      for (const key of keys) {
        if (item[key]) {
          yaml += `${indent}    ${key}: "${item[key]}"\n`;
        }
      }
    }
  }
  return yaml.trimEnd();
}

/**
 * Process a single markdown file
 */
function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Process passivesList
  if (content.includes('passivesList: [')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('passivesList: [')) {
        const parsed = parsePassivesList(lines[i]);
        if (parsed) {
          lines[i] = toYAML('passivesList', parsed);
          modified = true;
          passivesListFixed++;
        }
        break;
      }
    }
    content = lines.join('\n');
  }

  // Process sensesList
  if (content.includes('sensesList: [')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('sensesList: [')) {
        const parsed = parseSensesList(lines[i]);
        if (parsed) {
          lines[i] = toYAML('sensesList', parsed);
          modified = true;
          sensesListFixed++;
        }
        break;
      }
    }
    content = lines.join('\n');
  }

  // Process languagesList
  if (content.includes('languagesList: [')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('languagesList: [')) {
        const parsed = parseLanguagesList(lines[i]);
        if (parsed) {
          lines[i] = toYAML('languagesList', parsed);
          modified = true;
          languagesListFixed++;
        }
        break;
      }
    }
    content = lines.join('\n');
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    filesProcessed++;
  }
}

/**
 * Recursively process all markdown files in directory
 */
function processDirectory(dir) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.endsWith('.md')) {
      processFile(fullPath);
    }
  }
}

// Main
console.log('Fixing token field formats in creature presets...\n');
processDirectory(CREATURES_DIR);

console.log(`\n✓ Fixed ${filesProcessed} files:`);
console.log(`  - passivesList: ${passivesListFixed} files`);
console.log(`  - sensesList: ${sensesListFixed} files`);
console.log(`  - languagesList: ${languagesListFixed} files`);
