/**
 * Reference Update Utilities
 *
 * Self-contained module for updating file references when files are moved.
 * Supports: Markdown links, TypeScript/JS imports, JSON paths
 *
 * No external dependencies - only Node.js built-ins.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve, basename, extname } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ROOT = process.cwd();

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.claude',
  'Archive',
  '.obsidian',
  '.vscode',
  'coverage'
];

// Path alias mappings (from tsconfig.json)
const PATH_ALIASES = {
  '#types/': 'src/types/',
  '#entities/': 'src/types/entities/',
  '@/': 'src/'
};

// ============================================================================
// FILE DISCOVERY
// ============================================================================

/**
 * Checks if a path should be ignored.
 */
function shouldIgnore(name) {
  return IGNORE_PATTERNS.includes(name) || name.startsWith('.');
}

/**
 * Recursively finds all relevant files in a directory.
 *
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array
 * @returns {string[]} - Array of file paths
 */
export function findAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (shouldIgnore(entry)) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findAllFiles(fullPath, files);
    } else {
      const ext = extname(entry).toLowerCase();
      // Include: .md, .ts, .tsx, .js, .mjs, .json
      if (['.md', '.ts', '.tsx', '.js', '.mjs', '.json'].includes(ext)) {
        // Skip .d.ts and .test.ts files
        if (entry.endsWith('.d.ts') || entry.endsWith('.test.ts')) continue;
        files.push(fullPath);
      }
    }
  }

  return files;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Normalizes a path (removes leading ./, converts backslashes).
 */
function normalizePath(p) {
  return p.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Resolves a path alias to a real path.
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
 */
function toAlias(realPath) {
  const normalized = normalizePath(realPath);

  // Try more specific aliases first
  if (normalized.startsWith('src/types/entities/')) {
    return normalized.replace('src/types/entities/', '#entities/');
  }
  if (normalized.startsWith('src/types/')) {
    return normalized.replace('src/types/', '#types/');
  }
  if (normalized.startsWith('src/')) {
    return normalized.replace('src/', '@/');
  }

  return normalized;
}

/**
 * Checks if two paths point to the same file (with various extensions).
 */
function pathsMatch(path1, path2) {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);

  if (norm1 === norm2) return true;

  // Try without extensions
  const withoutExt = (p) => p.replace(/\.(ts|tsx|js|mjs|md|json)$/, '');
  if (withoutExt(norm1) === withoutExt(norm2)) return true;

  return false;
}

/**
 * Resolves an import/link path to a project-relative path.
 */
function resolveToProjectPath(refPath, fromDir) {
  // Handle aliases
  const aliasResolved = resolveAlias(refPath);
  if (aliasResolved) {
    return aliasResolved;
  }

  // Handle relative paths
  if (refPath.startsWith('.')) {
    const absolutePath = resolve(fromDir, refPath);
    return relative(PROJECT_ROOT, absolutePath);
  }

  // Already project-relative
  return refPath;
}

/**
 * Calculates a new reference path from a source file to a target file.
 * Prefers aliases for src/ files.
 */
function calculateNewRefPath(fromFile, newTargetPath, isImport = false) {
  const normalized = normalizePath(newTargetPath);

  if (isImport) {
    // Remove extension for imports
    const withoutExt = normalized.replace(/\.(ts|tsx|js|mjs)$/, '');

    // Try to use an alias
    const aliased = toAlias(withoutExt);
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
  } else {
    // Markdown links - always use relative paths
    const fromDir = dirname(fromFile);
    return relative(fromDir, resolve(PROJECT_ROOT, normalized));
  }
}

// ============================================================================
// MARKDOWN REFERENCE UPDATES
// ============================================================================

const LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Updates markdown references in a file.
 */
function updateMarkdownRefs(filePath, oldPath, newPath) {
  const content = readFileSync(filePath, 'utf-8');
  const fileDir = dirname(filePath);
  const oldNorm = normalizePath(oldPath);

  let updated = false;
  let count = 0;

  const newContent = content.replace(LINK_PATTERN, (match, text, linkPath) => {
    // Separate anchor from path
    const hashIndex = linkPath.indexOf('#');
    const pathPart = hashIndex >= 0 ? linkPath.slice(0, hashIndex) : linkPath;
    const anchor = hashIndex >= 0 ? linkPath.slice(hashIndex) : '';

    // Skip external URLs and pure anchors
    if (!pathPart || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
      return match;
    }

    // Resolve the link to a project path
    const resolvedPath = resolveToProjectPath(pathPart, fileDir);

    // Check if this link points to the old file
    if (pathsMatch(resolvedPath, oldNorm)) {
      count++;
      const newRelative = calculateNewRefPath(filePath, newPath, false);
      updated = true;
      return `[${text}](${newRelative}${anchor})`;
    }

    return match;
  });

  if (updated) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { updated, count };
}

// ============================================================================
// IMPORT/EXPORT REFERENCE UPDATES
// ============================================================================

// Matches import/export statements and dynamic imports
const IMPORT_PATTERN = /(?:(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+|import\s*\()(['"])([^'"]+)\1/g;

/**
 * Updates TypeScript/JavaScript imports in a file.
 */
function updateImports(filePath, oldPath, newPath) {
  const content = readFileSync(filePath, 'utf-8');
  const fileDir = dirname(filePath);
  const oldNorm = normalizePath(oldPath);

  let updated = false;
  let count = 0;

  const newContent = content.replace(IMPORT_PATTERN, (match, quote, importPath) => {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('#') && !importPath.startsWith('@/')) {
      return match;
    }

    // Resolve the import to a project path
    const resolvedPath = resolveToProjectPath(importPath, fileDir);

    // Check if this import points to the old file
    if (pathsMatch(resolvedPath, oldNorm)) {
      count++;
      const newImportPath = calculateNewRefPath(filePath, newPath, true);
      updated = true;
      return match.replace(importPath, newImportPath);
    }

    return match;
  });

  if (updated) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { updated, count };
}

// ============================================================================
// JSON REFERENCE UPDATES
// ============================================================================

/**
 * Updates path references in JSON files.
 * Handles: tsconfig paths, package.json main/types/exports, etc.
 */
function updateJsonRefs(filePath, oldPath, newPath) {
  const content = readFileSync(filePath, 'utf-8');
  const fileDir = dirname(filePath);
  const oldNorm = normalizePath(oldPath);
  const fileName = basename(filePath);

  let updated = false;
  let count = 0;

  // Parse JSON while preserving formatting info
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    return { updated: false, count: 0 };
  }

  // Detect indentation
  const indentMatch = content.match(/^(\s+)"/m);
  const indent = indentMatch ? indentMatch[1].length : 2;

  /**
   * Recursively updates path strings in an object.
   */
  function updatePaths(obj, key = null) {
    if (typeof obj === 'string') {
      // Check if this looks like a path
      if (obj.startsWith('./') || obj.startsWith('../') || obj.startsWith('src/') || obj.startsWith('docs/')) {
        const resolvedPath = resolveToProjectPath(obj, fileDir);
        if (pathsMatch(resolvedPath, oldNorm)) {
          count++;
          updated = true;
          // Calculate new path
          const newRelative = relative(fileDir, resolve(PROJECT_ROOT, newPath));
          return newRelative.startsWith('.') ? newRelative : './' + newRelative;
        }
      }
      // Handle tsconfig path patterns like "src/types/*"
      if (fileName.startsWith('tsconfig') && obj.includes('*')) {
        const basePath = obj.replace(/\/\*$/, '');
        const resolvedBase = resolveToProjectPath(basePath, fileDir);
        const oldBase = oldNorm.replace(/\/[^/]+$/, ''); // Remove filename
        if (resolvedBase === oldBase || pathsMatch(resolvedBase, oldBase)) {
          count++;
          updated = true;
          const newBase = normalizePath(newPath).replace(/\/[^/]+$/, '');
          return newBase + '/*';
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, i) => updatePaths(item, i));
    }

    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = updatePaths(v, k);
      }
      return result;
    }

    return obj;
  }

  const updatedJson = updatePaths(json);

  if (updated) {
    writeFileSync(filePath, JSON.stringify(updatedJson, null, indent) + '\n', 'utf-8');
  }

  return { updated, count };
}

// ============================================================================
// MAIN UPDATE FUNCTION
// ============================================================================

/**
 * Updates all references from oldPath to newPath across the project.
 *
 * @param {string} oldPath - Original file path (project-relative)
 * @param {string} newPath - New file path (project-relative)
 * @returns {{ updatedFiles: number, totalUpdates: number, changes: Array }}
 */
export function updateAllReferences(oldPath, newPath) {
  const oldNorm = normalizePath(oldPath);
  const newNorm = normalizePath(newPath);

  // Find all relevant files
  const allFiles = [
    ...findAllFiles('docs'),
    ...findAllFiles('src'),
    ...findAllFiles('scripts'),
    ...findAllFiles('presets')
  ];

  // Add root files
  const rootFiles = ['Goals.md', 'CLAUDE.md', 'README.md', 'package.json', 'tsconfig.json'];
  for (const f of rootFiles) {
    if (existsSync(f)) allFiles.push(f);
  }

  const changes = [];

  for (const filePath of allFiles) {
    // Skip the moved file itself
    if (normalizePath(filePath) === newNorm) continue;

    const ext = extname(filePath).toLowerCase();
    let result = { updated: false, count: 0 };

    if (ext === '.md') {
      result = updateMarkdownRefs(filePath, oldNorm, newNorm);
    } else if (['.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
      result = updateImports(filePath, oldNorm, newNorm);
    } else if (ext === '.json') {
      result = updateJsonRefs(filePath, oldNorm, newNorm);
    }

    if (result.updated) {
      changes.push({ file: filePath, count: result.count });
    }
  }

  return {
    updatedFiles: changes.length,
    totalUpdates: changes.reduce((sum, c) => sum + c.count, 0),
    changes
  };
}

/**
 * Updates references for a folder rename (all files in the folder).
 *
 * @param {string} oldFolder - Original folder path
 * @param {string} newFolder - New folder path
 * @returns {{ updatedFiles: number, totalUpdates: number }}
 */
export function updateFolderReferences(oldFolder, newFolder) {
  const oldNorm = normalizePath(oldFolder);
  const newNorm = normalizePath(newFolder);

  // Find all files in the new folder
  const filesInFolder = findAllFiles(newFolder);

  let totalUpdatedFiles = 0;
  let totalUpdates = 0;

  for (const newFilePath of filesInFolder) {
    const relativePath = relative(newFolder, newFilePath);
    const oldFilePath = join(oldNorm, relativePath);

    const result = updateAllReferences(oldFilePath, newFilePath);
    totalUpdatedFiles += result.updatedFiles;
    totalUpdates += result.totalUpdates;
  }

  return { updatedFiles: totalUpdatedFiles, totalUpdates };
}
