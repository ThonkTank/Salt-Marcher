/**
 * Import Updater Service
 *
 * Updates TypeScript/JavaScript imports when src/ files are moved or renamed.
 * Converts relative imports to path aliases where possible.
 *
 * Path Aliases (from tsconfig.json):
 * - #types/* → src/types/*
 * - @/* → src/*
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve, basename, extname } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';

const SRC_ROOT = 'src';
const SCRIPTS_ROOT = 'scripts';
const PROJECT_ROOT = process.cwd();

// Path alias mappings (from tsconfig.json)
const PATH_ALIASES = {
  '#types/': 'src/types/',
  '@/': 'src/'
};

// Import pattern: captures the import path in quotes
// Matches: import X from 'path', import { X } from 'path', import type { X } from 'path'
// Also matches: export { X } from 'path', export * from 'path'
// Also matches: import('path')
const IMPORT_PATTERN = /(?:(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+|import\s*\()(['"])([^'"]+)\1/g;

// ============================================================================
// FILE DISCOVERY
// ============================================================================

/**
 * Recursively finds all TypeScript/JavaScript files in a directory.
 *
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array
 * @returns {string[]} - Array of file paths
 */
function findAllSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    // Skip node_modules and hidden directories
    if (entry === 'node_modules' || entry.startsWith('.')) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findAllSourceFiles(fullPath, files);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Normalizes a path (removes leading ./, converts backslashes).
 *
 * @param {string} p - Path to normalize
 * @returns {string}
 */
function normalizePath(p) {
  return p.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Resolves a path alias to a real path.
 *
 * @param {string} importPath - The import path (e.g., '#types/common/Result')
 * @returns {string | null} - The resolved path or null if not an alias
 */
function resolveAlias(importPath) {
  for (const [alias, target] of Object.entries(PATH_ALIASES)) {
    if (importPath.startsWith(alias)) {
      return importPath.replace(alias, target);
    }
  }
  return null;
}

/**
 * Converts a real path to a path alias if possible.
 *
 * @param {string} realPath - The real path (e.g., 'src/types/common/Result')
 * @returns {string} - The aliased path or original if no alias matches
 */
function toAlias(realPath) {
  const normalized = normalizePath(realPath);

  // Try more specific alias first (#types/)
  if (normalized.startsWith('src/types/')) {
    return normalized.replace('src/types/', '#types/');
  }

  // Then general alias (@/)
  if (normalized.startsWith('src/')) {
    return normalized.replace('src/', '@/');
  }

  return normalized;
}

/**
 * Resolves an import path to a real file path.
 *
 * @param {string} importPath - The import path from the source file
 * @param {string} fromDir - Directory of the file containing the import
 * @returns {string | null} - The resolved real path (project-relative) or null
 */
function resolveImportPath(importPath, fromDir) {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('#') && !importPath.startsWith('@/')) {
    return null;
  }

  let targetPath;

  // Handle aliases
  const aliasResolved = resolveAlias(importPath);
  if (aliasResolved) {
    targetPath = resolve(PROJECT_ROOT, aliasResolved);
  } else {
    // Handle relative imports
    targetPath = resolve(fromDir, importPath);
  }

  // Try with various extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

  for (const ext of extensions) {
    const fullPath = targetPath + ext;
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      return relative(PROJECT_ROOT, fullPath);
    }
  }

  return null;
}

/**
 * Checks if an import path matches the old file path.
 *
 * @param {string} importPath - The import path from the source file
 * @param {string} oldPath - The old file path (normalized, project-relative)
 * @param {string} fromDir - Directory of the file containing the import
 * @returns {boolean}
 */
function isMatchingPath(importPath, oldPath, fromDir) {
  const resolved = resolveImportPath(importPath, fromDir);
  if (!resolved) return false;

  const normalizedResolved = normalizePath(resolved);
  const normalizedOld = normalizePath(oldPath);

  // Direct match
  if (normalizedResolved === normalizedOld) return true;

  // Match without extension
  const withoutExt = (p) => p.replace(/\.(ts|tsx|js|mjs)$/, '');
  if (withoutExt(normalizedResolved) === withoutExt(normalizedOld)) return true;

  return false;
}

/**
 * Calculates the new import path for a moved file.
 * Prefers path aliases over relative paths.
 *
 * @param {string} fromFile - File containing the import
 * @param {string} newPath - New file path (project-relative)
 * @returns {string}
 */
function calculateNewImportPath(fromFile, newPath) {
  const normalized = normalizePath(newPath);

  // Remove extension for import
  const withoutExt = normalized.replace(/\.(ts|tsx|js|mjs)$/, '');

  // Try to use an alias
  const aliased = toAlias(withoutExt);

  // If aliased successfully, use it
  if (aliased !== withoutExt) {
    return aliased;
  }

  // Fall back to relative path
  const fromDir = dirname(fromFile);
  let relativePath = relative(fromDir, resolve(PROJECT_ROOT, withoutExt));

  // Ensure relative path starts with ./
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

// ============================================================================
// IMPORT UPDATE LOGIC
// ============================================================================

/**
 * Updates imports in a single file.
 *
 * @param {string} filePath - Path to the file to update
 * @param {string} oldPath - Old file path (normalized)
 * @param {string} newPath - New file path (normalized)
 * @param {boolean} dryRun - If true, don't write changes
 * @returns {{updated: boolean, count: number, matches: Array}}
 */
function updateFileImports(filePath, oldPath, newPath, dryRun) {
  const content = readFileSync(filePath, 'utf-8');
  const fileDir = dirname(filePath);

  let updated = false;
  let count = 0;
  const matches = [];

  // Find line numbers for matches (for reporting)
  const lines = content.split('\n');
  const findLineNumber = (importPath) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(importPath)) return i + 1;
    }
    return -1;
  };

  const newContent = content.replace(IMPORT_PATTERN, (match, quote, importPath) => {
    // Check if this import points to the old file
    if (isMatchingPath(importPath, oldPath, fileDir)) {
      count++;
      const newImportPath = calculateNewImportPath(filePath, newPath);

      matches.push({
        old: importPath,
        new: newImportPath,
        line: findLineNumber(importPath)
      });

      updated = true;
      return match.replace(importPath, newImportPath);
    }

    return match;
  });

  if (updated && !dryRun) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { updated, count, matches };
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Creates the import-updater service instance.
 *
 * @returns {object} - Service with updateImports method
 */
export function createImportUpdaterService() {
  return {
    /**
     * Updates all imports from oldPath to newPath across src/ and scripts/.
     *
     * @param {string} oldPath - Original file path (e.g., "src/types/old.ts")
     * @param {string} newPath - New file path (e.g., "src/core/new.ts")
     * @param {object} opts - Options { dryRun: boolean }
     * @returns {import('../core/result.mjs').Result}
     */
    updateImports(oldPath, newPath, opts = {}) {
      const { dryRun = false } = opts;
      const changes = [];

      // Normalize paths
      const oldNorm = normalizePath(oldPath);
      const newNorm = normalizePath(newPath);

      // Validate old path was in src/
      if (!oldNorm.startsWith('src/')) {
        return ok({
          skipped: true,
          reason: 'not_in_src',
          oldPath: oldNorm
        });
      }

      // Find all source files
      const srcFiles = findAllSourceFiles(SRC_ROOT);
      const scriptFiles = findAllSourceFiles(SCRIPTS_ROOT);
      const allFiles = [...srcFiles, ...scriptFiles];

      for (const filePath of allFiles) {
        // Skip the moved file itself
        if (normalizePath(filePath) === newNorm) continue;

        const result = updateFileImports(filePath, oldNorm, newNorm, dryRun);
        if (result.updated) {
          changes.push({
            file: filePath,
            count: result.count,
            matches: result.matches
          });
        }
      }

      return ok({
        updatedFiles: changes.length,
        totalUpdates: changes.reduce((sum, c) => sum + c.count, 0),
        changes,
        dryRun
      });
    }
  };
}
