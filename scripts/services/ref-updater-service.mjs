/**
 * Reference Updater Service
 *
 * Updates markdown references when docs/ files are moved or renamed.
 * Used by:
 * 1. PostToolUse hook (.claude/hooks/update-refs.mjs) - automatic on mv/git mv
 * 2. CLI command (scan-refs) - manual scan and fix of broken references
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve, basename } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';

const DOCS_ROOT = 'docs';
const PROJECT_ROOT = process.cwd();

// Markdown link pattern: [text](path) or [text](path#anchor)
const LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

// ============================================================================
// FILE DISCOVERY
// ============================================================================

/**
 * Recursively finds all markdown files in a directory.
 *
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array
 * @returns {string[]} - Array of file paths
 */
function findAllMarkdownFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findAllMarkdownFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
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
 * Checks if a link path matches the old file path.
 *
 * @param {string} linkPath - The path from the markdown link
 * @param {string} oldPath - The old file path (normalized)
 * @param {string} fromDir - Directory of the file containing the link
 * @returns {boolean}
 */
function isMatchingPath(linkPath, oldPath, fromDir) {
  // Normalize the link path
  const normalizedLink = normalizePath(linkPath);

  // 1. Direct match with absolute-style path (docs/domain/Creature.md)
  if (normalizedLink === oldPath) return true;

  // 2. Resolve relative path and compare
  try {
    const resolvedLink = resolve(fromDir, normalizedLink);
    const resolvedOld = resolve(PROJECT_ROOT, oldPath);
    if (resolvedLink === resolvedOld) return true;
  } catch {
    // Invalid path
  }

  // 3. Check filename match for simple cases (Creature.md == docs/entities/creature.md)
  // Case-insensitive filename comparison
  const linkBasename = basename(normalizedLink).toLowerCase();
  const oldBasename = basename(oldPath).toLowerCase();
  if (linkBasename === oldBasename) {
    // Additional check: resolve and compare
    try {
      const resolvedLink = resolve(fromDir, normalizedLink);
      const resolvedOld = resolve(PROJECT_ROOT, oldPath);
      // Check if they resolve to the same location (case-insensitive)
      if (resolvedLink.toLowerCase() === resolvedOld.toLowerCase()) return true;
    } catch {
      // Invalid path
    }
  }

  return false;
}

/**
 * Calculates the new relative path from a file to the new location.
 *
 * @param {string} fromFile - File containing the link
 * @param {string} newPath - New file path (project-relative)
 * @returns {string}
 */
function calculateNewRelativePath(fromFile, newPath) {
  const fromDir = dirname(fromFile);
  const newAbsolute = resolve(PROJECT_ROOT, newPath);
  return relative(fromDir, newAbsolute);
}

// ============================================================================
// REFERENCE UPDATE LOGIC
// ============================================================================

/**
 * Updates references in a single file.
 *
 * @param {string} filePath - Path to the file to update
 * @param {string} oldPath - Old file path (normalized)
 * @param {string} newPath - New file path (normalized)
 * @param {boolean} dryRun - If true, don't write changes
 * @returns {{updated: boolean, count: number, matches: Array}}
 */
function updateFileReferences(filePath, oldPath, newPath, dryRun) {
  const content = readFileSync(filePath, 'utf-8');
  const fileDir = dirname(filePath);

  let updated = false;
  let count = 0;
  const matches = [];

  // Find line numbers for matches (for reporting)
  const lines = content.split('\n');
  const findLineNumber = (match) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) return i + 1;
    }
    return -1;
  };

  const newContent = content.replace(LINK_PATTERN, (match, text, linkPath) => {
    // Separate anchor from path
    const hashIndex = linkPath.indexOf('#');
    const pathPart = hashIndex >= 0 ? linkPath.slice(0, hashIndex) : linkPath;
    const anchor = hashIndex >= 0 ? linkPath.slice(hashIndex) : '';

    // Skip external URLs, empty paths, and pure anchors
    if (!pathPart || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
      return match;
    }

    // Check if this link points to the old file
    if (isMatchingPath(pathPart, oldPath, fileDir)) {
      count++;
      const newRelative = calculateNewRelativePath(filePath, newPath);
      const newLink = `[${text}](${newRelative}${anchor})`;

      matches.push({
        old: match,
        new: newLink,
        line: findLineNumber(match)
      });

      updated = true;
      return newLink;
    }

    return match;
  });

  if (updated && !dryRun) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { updated, count, matches };
}

// ============================================================================
// BROKEN REFERENCE DETECTION
// ============================================================================

/**
 * Checks if a file has a specific anchor (section heading).
 *
 * @param {string} content - File content
 * @param {string} anchor - Anchor to find (without #)
 * @returns {boolean}
 */
function hasAnchor(content, anchor) {
  // GitHub-style anchor: lowercase, spaces → dashes, remove special chars
  const normalizedAnchor = anchor.toLowerCase();

  const lines = content.split('\n');
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[1].trim();
      // Generate anchor from heading
      const generatedAnchor = headingText
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      if (generatedAnchor === normalizedAnchor) return true;
      // Also check exact match (some systems preserve case)
      if (headingText.toLowerCase().replace(/\s+/g, '-') === normalizedAnchor) return true;
    }
  }

  return false;
}

/**
 * Scans all docs for broken references.
 *
 * @returns {import('../core/result.mjs').Result}
 */
function scanBrokenReferences() {
  const brokenRefs = [];

  const mdFiles = findAllMarkdownFiles(DOCS_ROOT);
  // Also scan root files
  const rootFiles = ['Goals.md', 'CLAUDE.md', 'README.md'].filter(f => existsSync(f));
  const allFiles = [...mdFiles, ...rootFiles];

  for (const filePath of allFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const fileDir = dirname(filePath);
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const linkMatches = [...line.matchAll(LINK_PATTERN)];

      for (const match of linkMatches) {
        const [fullMatch, , linkPath] = match;

        // Separate anchor from path
        const hashIndex = linkPath.indexOf('#');
        const pathPart = hashIndex >= 0 ? linkPath.slice(0, hashIndex) : linkPath;
        const anchor = hashIndex >= 0 ? linkPath.slice(hashIndex + 1) : null;

        // Skip external URLs and pure anchors
        if (!pathPart || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
          continue;
        }

        // Resolve the path
        const resolvedPath = resolve(fileDir, pathPart);

        // Check if file exists
        if (!existsSync(resolvedPath)) {
          brokenRefs.push({
            file: filePath,
            line: lineNum + 1,
            link: fullMatch,
            target: pathPart,
            reason: 'FILE_NOT_FOUND'
          });
        } else if (anchor) {
          // File exists, check anchor
          try {
            const targetContent = readFileSync(resolvedPath, 'utf-8');
            if (!hasAnchor(targetContent, anchor)) {
              brokenRefs.push({
                file: filePath,
                line: lineNum + 1,
                link: fullMatch,
                target: `${pathPart}#${anchor}`,
                reason: 'ANCHOR_NOT_FOUND'
              });
            }
          } catch {
            // Can't read file
          }
        }
      }
    }
  }

  return ok({
    brokenRefs,
    totalScanned: allFiles.length
  });
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Creates the ref-updater service instance.
 *
 * @returns {object} - Service with updateReferences and scanBrokenReferences
 */
export function createRefUpdaterService() {
  return {
    /**
     * Updates all references from oldPath to newPath across docs/.
     *
     * @param {string} oldPath - Original file path (e.g., "docs/domain/Creature.md")
     * @param {string} newPath - New file path (e.g., "docs/entities/creature.md")
     * @param {object} opts - Options { dryRun: boolean }
     * @returns {import('../core/result.mjs').Result}
     */
    updateReferences(oldPath, newPath, opts = {}) {
      const { dryRun = false } = opts;
      const changes = [];

      // Normalize paths
      const oldNorm = normalizePath(oldPath);
      const newNorm = normalizePath(newPath);

      // Validate old path was in docs/
      if (!oldNorm.startsWith('docs/')) {
        return ok({
          skipped: true,
          reason: 'not_in_docs',
          oldPath: oldNorm
        });
      }

      // Find all markdown files (in docs/ and root)
      const mdFiles = findAllMarkdownFiles(DOCS_ROOT);
      const rootFiles = ['Goals.md', 'CLAUDE.md', 'README.md'].filter(f => existsSync(f));
      const allFiles = [...mdFiles, ...rootFiles];

      for (const filePath of allFiles) {
        // Skip the moved file itself
        if (normalizePath(filePath) === newNorm) continue;

        const result = updateFileReferences(filePath, oldNorm, newNorm, dryRun);
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
    },

    scanBrokenReferences
  };
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Parses CLI arguments for scan-refs command.
 *
 * @param {string[]} argv - Command arguments
 * @returns {object} - Parsed options
 */
export function parseArgs(argv) {
  const opts = {
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '-q' || arg === '--quiet') opts.quiet = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
  }

  return opts;
}

/**
 * Executes scan-refs command.
 *
 * @param {object} opts - Parsed options
 * @returns {import('../core/result.mjs').Result}
 */
export function execute(opts) {
  const service = createRefUpdaterService();
  const result = service.scanBrokenReferences();

  if (!result.ok) return result;

  const value = result.value;

  // Format output for CLI
  if (!opts.json && !opts.quiet) {
    if (value.brokenRefs.length === 0) {
      console.log('Keine kaputten Referenzen gefunden.');
    } else {
      console.log(`Gefunden: ${value.brokenRefs.length} kaputte Referenz(en)\n`);

      for (const ref of value.brokenRefs) {
        console.log(`  ${ref.file}:${ref.line}`);
        console.log(`    ${ref.link}`);
        console.log(`    ${ref.reason}`);
        console.log();
      }
    }

    console.log(`\nGescannt: ${value.totalScanned} Datei(en)`);
  }

  return result;
}

/**
 * Shows help for scan-refs command.
 *
 * @returns {string}
 */
export function showHelp() {
  return `
Scan-Refs Command - Kaputte Markdown-Referenzen finden

USAGE:
  node scripts/task.mjs scan-refs [options]

OPTIONS:
  --json             JSON-Ausgabe
  -q, --quiet        Keine Ausgabe
  -h, --help         Diese Hilfe anzeigen

AUSGABE:
  Listet jede Datei mit kaputten Referenzen:
    docs/features/Travel.md:15
      [Creature](../domain/Creature.md)
      FILE_NOT_FOUND

FEHLERTYPEN:
  - FILE_NOT_FOUND: Zieldatei existiert nicht
  - ANCHOR_NOT_FOUND: Datei existiert, aber Überschrift fehlt

HINWEISE:
  - Scannt docs/ und Root-Dateien (Goals.md, CLAUDE.md, README.md)
  - Externe URLs (http/https) werden ignoriert
  - Der PostToolUse Hook aktualisiert Links automatisch bei mv/git mv
`;
}
