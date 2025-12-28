#!/usr/bin/env node
/**
 * PostToolUse Hook: Update References on File Move
 *
 * This hook is triggered after Bash tool calls.
 * It detects mv/git mv commands that move files in docs/ and
 * automatically updates all markdown references to those files.
 *
 * Stdin format (from Claude Code):
 * {
 *   "tool_input": { "command": "git mv docs/old.md docs/new.md" },
 *   "tool_result": { "exitCode": 0, ... }
 * }
 */

import { createRefUpdaterService } from '../../scripts/services/ref-updater-service.mjs';

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
    // Command failed, don't update references
    process.exit(0);
  }

  // Parse move command
  const moveInfo = parseMoveCommand(command);
  if (!moveInfo) {
    // Not a move command
    process.exit(0);
  }

  // Normalize paths
  const source = normalizePath(moveInfo.source);
  const destination = normalizePath(moveInfo.destination);

  // Only process moves from docs/
  if (!source.startsWith('docs/')) {
    process.exit(0);
  }

  // Update references
  try {
    const service = createRefUpdaterService();
    const result = service.updateReferences(source, destination);

    if (result.ok && result.value.updatedFiles > 0) {
      const { updatedFiles, totalUpdates } = result.value;
      console.log(`[update-refs] Updated ${totalUpdates} reference(s) in ${updatedFiles} file(s)`);

      // Show which files were updated
      for (const change of result.value.changes) {
        console.log(`  - ${change.file} (${change.count} link(s))`);
      }
    }
  } catch (error) {
    // Log error but don't fail the hook
    console.error(`[update-refs] Error: ${error.message}`);
  }

  process.exit(0);
}

main();
