/**
 * Docs Tree Generator
 *
 * Generates a directory tree of docs/ and src/, and updates CLAUDE.md.
 * Used by update-refs.mjs (Bash hook) and update-docs-tree.mjs (Write hook).
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const DOCS_ROOT = 'docs';
const SRC_ROOT = 'src';
const CLAUDEMD_PATH = 'CLAUDE.md';
const MAX_COMMENT_LENGTH = 60;

// ============================================================================
// TREE GENERATION
// ============================================================================

/**
 * Extracts the first line comment from a TypeScript file.
 * Returns null if file is empty or first line is not a // comment.
 *
 * @param {string} filePath - Path to the file
 * @returns {string | null} - Comment text or null
 */
function extractFirstLineComment(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];

    if (!firstLine || !firstLine.startsWith('//')) {
      return null;
    }

    let comment = firstLine.replace(/^\/\/\s*/, '').trim();

    if (comment.length > MAX_COMMENT_LENGTH) {
      comment = comment.substring(0, MAX_COMMENT_LENGTH - 3) + '...';
    }

    return comment || null;
  } catch {
    return null;
  }
}

/**
 * Extracts the description from a docs markdown file (line 3).
 * Cleans up leading "> " and "**Label:**" patterns if present.
 *
 * @param {string} filePath - Path to the markdown file
 * @returns {string | null} - Description text or null
 */
function extractDocsDescription(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let line3 = lines[2]; // 0-indexed, so line 3 is index 2

    if (!line3) return null;

    // Remove leading "> " if present
    line3 = line3.replace(/^>\s*/, '');

    // Remove "**Label:**" pattern if present
    line3 = line3.replace(/^\*\*[^*]+\*\*\s*/, '');

    let description = line3.trim();

    if (!description) return null;

    if (description.length > MAX_COMMENT_LENGTH) {
      description = description.substring(0, MAX_COMMENT_LENGTH - 3) + '...';
    }

    return description;
  } catch {
    return null;
  }
}

/**
 * Generates a directory tree string for src/.
 * Includes .ts files with their first-line comments.
 *
 * @param {string} dir - Directory to scan
 * @param {string} indent - Current indentation
 * @returns {string} - Tree representation
 */
function generateSrcTree(dir, indent = '') {
  if (!existsSync(dir)) return '';

  let tree = '';
  const entries = readdirSync(dir).sort((a, b) => {
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
      tree += generateSrcTree(fullPath, indent + '  ');
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts')) {
      const comment = extractFirstLineComment(fullPath);
      if (comment) {
        tree += `${indent}${entry}  # ${comment}\n`;
      } else {
        tree += `${indent}${entry}\n`;
      }
    }
  }

  return tree;
}

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
    } else if (entry.endsWith('.md')) {
      const description = extractDocsDescription(fullPath);
      if (description) {
        tree += `${indent}${entry}  # ${description}\n`;
      } else {
        tree += `${indent}${entry}\n`;
      }
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

  // src/ structure (dynamic)
  tree += 'src/                   # Source code\n';
  tree += generateSrcTree(SRC_ROOT, '  ');

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
