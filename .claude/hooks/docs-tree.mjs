/**
 * Docs Tree Generator
 *
 * Generates a directory tree of docs/ and updates CLAUDE.md.
 * Used by update-refs.mjs (Bash hook) and update-docs-tree.mjs (Write hook).
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const DOCS_ROOT = 'docs';
const CLAUDEMD_PATH = 'CLAUDE.md';

// ============================================================================
// TREE GENERATION
// ============================================================================

/**
 * Generates a directory tree string for a given directory.
 * Only includes folders and filenames, sorted alphabetically.
 *
 * @param {string} dir - Directory to scan
 * @param {string} indent - Current indentation
 * @returns {string} - Tree representation
 */
function generateDocsTree(dir, indent = '') {
  if (!existsSync(dir)) return '';

  let tree = '';
  const entries = readdirSync(dir).sort((a, b) => {
    // Folders first, then files
    const aPath = join(dir, a);
    const bPath = join(dir, b);
    const aIsDir = statSync(aPath).isDirectory();
    const bIsDir = statSync(bPath).isDirectory();

    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      tree += `${indent}${entry}/\n`;
      tree += generateDocsTree(fullPath, indent + '  ');
    } else {
      tree += `${indent}${entry}\n`;
    }
  }

  return tree;
}

/**
 * Generates the full project structure for CLAUDE.md.
 * Includes src/, docs/, presets/, Archive/, and Goals.md.
 *
 * @returns {string} - Full tree representation
 */
function generateFullTree() {
  let tree = '';

  // src/ structure (static, as it changes less frequently)
  tree += 'src/                   # Source code\n';
  tree += '  core/                # Data Layer: Schemas, Types, Konstanten, Utils\n';
  tree += '  features/            # Feature layer (map, party, travel)\n';
  tree += '  infrastructure/      # Vault adapters, rendering\n';
  tree += '  application/         # SessionRunner, ViewModels\n';
  tree += '  main.ts              # Plugin entry point\n';

  // docs/ structure (dynamic)
  tree += 'docs/                  # Authoritative documentation (German)\n';
  tree += generateDocsTree(DOCS_ROOT, '  ');

  // Other directories (static)
  tree += 'presets/               # Fixture data (maps, terrains)\n';
  tree += 'Archive/               # Previous Alpha implementations - reference only\n';
  tree += 'Goals.md               # Start here: high-level vision and feature overview (German)\n';

  return tree;
}

// ============================================================================
// CLAUDE.MD UPDATE
// ============================================================================

/**
 * Updates the Projektstruktur section in CLAUDE.md with the current docs tree.
 *
 * @returns {{success: boolean, message: string}}
 */
export function updateClaudemdDocsTree() {
  try {
    if (!existsSync(CLAUDEMD_PATH)) {
      return { success: false, message: 'CLAUDE.md not found' };
    }

    const content = readFileSync(CLAUDEMD_PATH, 'utf-8');
    const tree = generateFullTree();

    // Pattern: ### Projektstruktur\n\n```\n...\n```
    const pattern = /(### Projektstruktur\n\n```\n)([\s\S]*?)(```\n)/;

    if (!pattern.test(content)) {
      return { success: false, message: 'Projektstruktur section not found in CLAUDE.md' };
    }

    const updated = content.replace(pattern, `$1${tree}$3`);

    // Only write if changed
    if (updated !== content) {
      writeFileSync(CLAUDEMD_PATH, updated, 'utf-8');
      return { success: true, message: 'CLAUDE.md updated' };
    }

    return { success: true, message: 'No changes needed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
