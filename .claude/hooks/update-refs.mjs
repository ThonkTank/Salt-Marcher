#!/usr/bin/env node
/**
 * PostToolUse Hook: Update References and Docs Tree
 *
 * This hook is triggered after Bash tool calls.
 * It handles two tasks:
 *
 * 1. Reference Updates: When files are moved in docs/, updates all markdown
 *    links that reference those files.
 *
 * 2. Docs Tree Updates: When docs/ structure changes (mv, rm, mkdir),
 *    regenerates the Projektstruktur section in CLAUDE.md.
 *
 * Supported commands:
 * - mv/git mv: Move files or folders
 * - rm: Delete files or folders
 * - mkdir: Create folders
 *
 * Stdin format (from Claude Code):
 * {
 *   "tool_input": { "command": "git mv docs/old.md docs/new.md" },
 *   "tool_result": { "exitCode": 0, ... }
 * }
 */

import { existsSync, statSync } from 'fs';
import { updateAllReferences, updateFolderReferences } from './ref-utils.mjs';
import { updateClaudemdDocsTree } from './docs-tree.mjs';
import { recordDelete } from './hook-state.mjs';

// ============================================================================
// COMMAND DETECTION
// ============================================================================

// Directories to track for reference updates
const TRACKED_DIRS = ['docs/', 'src/', 'scripts/', 'presets/'];

/**
 * Checks if a command affects tracked directories.
 * Returns the type of command if it does, null otherwise.
 *
 * @param {string} command - The bash command
 * @returns {'mv' | 'rm' | 'mkdir' | null}
 */
function getDocsAffectingCommand(command) {
  if (!command) return null;

  const affectsTrackedDir = TRACKED_DIRS.some(dir => command.includes(dir));

  // Check for mv/git mv
  if (/\b(git\s+)?mv\b/.test(command) && affectsTrackedDir) {
    return 'mv';
  }

  // Check for rm
  if (/\brm\b/.test(command) && affectsTrackedDir) {
    return 'rm';
  }

  // Check for mkdir
  if (/\bmkdir\b/.test(command) && affectsTrackedDir) {
    return 'mkdir';
  }

  return null;
}

// ============================================================================
// MOVE COMMAND PARSING
// ============================================================================

/**
 * Parses mv or git mv commands to extract source and destination paths.
 *
 * Handles:
 * - mv source dest
 * - mv -i source dest (with flags)
 * - git mv source dest
 * - Quoted paths: mv "path with spaces" "dest"
 * - Single-quoted paths: mv 'source' 'dest'
 *
 * @param {string} command - The bash command to parse
 * @returns {{source: string, destination: string} | null}
 */
function parseMoveCommand(command) {
  if (!command) return null;

  // Pattern for git mv: git mv [options] source dest
  const gitMvPattern = /git\s+mv\s+(?:-[a-zA-Z]+\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;

  // Pattern for mv: mv [options] source dest
  const mvPattern = /\bmv\s+(?:-[a-zA-Z]+\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;

  // Try git mv first
  let match = command.match(gitMvPattern);
  if (match) {
    const source = match[1] || match[2] || match[3];
    const destination = match[4] || match[5] || match[6];
    return { source, destination };
  }

  // Try regular mv
  match = command.match(mvPattern);
  if (match) {
    const source = match[1] || match[2] || match[3];
    const destination = match[4] || match[5] || match[6];
    return { source, destination };
  }

  return null;
}

/**
 * Normalizes a path (removes leading ./).
 *
 * @param {string} p - Path to normalize
 * @returns {string}
 */
function normalizePath(p) {
  return p.replace(/^\.\//, '');
}

// ============================================================================
// RM COMMAND PARSING
// ============================================================================

/**
 * Parses rm commands to extract deleted paths.
 *
 * Handles:
 * - rm file
 * - rm -f file
 * - rm -rf folder/
 * - rm "path with spaces"
 * - rm 'path with spaces'
 *
 * @param {string} command - The bash command to parse
 * @returns {string[]} - Array of deleted paths
 */
function parseRmCommand(command) {
  if (!command) return [];

  // Match rm command with optional flags and path(s)
  // Pattern: rm [flags] path(s)
  const rmMatch = command.match(/\brm\s+(.+)$/);
  if (!rmMatch) return [];

  const argsString = rmMatch[1];
  const paths = [];

  // Tokenize: handle quoted strings and unquoted words
  const tokenRegex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match;

  while ((match = tokenRegex.exec(argsString)) !== null) {
    const token = match[1] || match[2] || match[3];

    // Skip flags (start with -)
    if (token.startsWith('-')) continue;

    // Add path
    paths.push(normalizePath(token));
  }

  return paths;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Read stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  // Parse JSON input
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    // Invalid JSON - silently exit
    process.exit(0);
  }

  // Extract command
  const command = input?.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  // Check if command succeeded (exitCode 0)
  const exitCode = input?.tool_result?.exitCode;
  if (exitCode !== 0) {
    // Command failed, don't process
    process.exit(0);
  }

  // Check if command affects docs/
  const commandType = getDocsAffectingCommand(command);
  if (!commandType) {
    process.exit(0);
  }

  // Handle rm commands (record deletions for rename detection)
  if (commandType === 'rm') {
    const deletedPaths = parseRmCommand(command);
    for (const path of deletedPaths) {
      // Track relevant file types in tracked directories
      const isTrackedDir = TRACKED_DIRS.some(dir => path.startsWith(dir));
      const isRelevantFile = /\.(md|ts|tsx|js|mjs|json)$/.test(path);

      if (isTrackedDir && isRelevantFile) {
        recordDelete(path);
        console.log(`[update-refs] Recorded deletion: ${path}`);
      }
    }
  }

  // Handle move commands (update references)
  if (commandType === 'mv') {
    const moveInfo = parseMoveCommand(command);
    if (moveInfo) {
      const source = normalizePath(moveInfo.source);
      const destination = normalizePath(moveInfo.destination);

      try {
        // Check if destination is a folder (folder rename)
        if (existsSync(destination) && statSync(destination).isDirectory()) {
          // Folder rename: update all references for files in the folder
          const result = updateFolderReferences(source, destination);

          if (result.totalUpdates > 0) {
            console.log(`[update-refs] Folder rename: Updated ${result.totalUpdates} reference(s) in ${result.updatedFiles} file(s)`);
          }
        } else {
          // Single file move
          const result = updateAllReferences(source, destination);

          if (result.updatedFiles > 0) {
            console.log(`[update-refs] Updated ${result.totalUpdates} reference(s) in ${result.updatedFiles} file(s)`);

            for (const change of result.changes) {
              console.log(`  - ${change.file} (${change.count} ref(s))`);
            }
          }
        }
      } catch (error) {
        console.error(`[update-refs] Error: ${error.message}`);
      }
    }
  }

  // Update CLAUDE.md docs tree for any docs-affecting command
  try {
    const result = updateClaudemdDocsTree();
    if (result.success && result.message !== 'No changes needed') {
      console.log(`[docs-tree] ${result.message}`);
    }
  } catch (error) {
    console.error(`[docs-tree] Error: ${error.message}`);
  }

  process.exit(0);
}

main();
