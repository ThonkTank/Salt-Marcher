#!/usr/bin/env node
/**
 * PostToolUse Hook: Update Docs Tree on Write
 *
 * This hook is triggered after Write tool calls.
 * When a file in docs/ is created or modified, it regenerates
 * the Projektstruktur section in CLAUDE.md.
 *
 * Stdin format (from Claude Code):
 * {
 *   "tool_input": { "file_path": "/path/to/docs/file.md", "content": "..." },
 *   "tool_result": { ... }
 * }
 */

import { updateClaudemdDocsTree } from './docs-tree.mjs';
import { findMatchingDelete, cleanupExpiredDeletes } from './hook-state.mjs';
import { updateAllReferences } from './ref-utils.mjs';

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
    process.exit(0);
  }

  // Extract file path
  const filePath = input?.tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  // Tracked directories and file types
  const TRACKED_DIRS = ['docs/', 'src/', 'scripts/', 'presets/'];
  const RELEVANT_EXTENSIONS = /\.(md|ts|tsx|js|mjs|json)$/;

  // Handle both absolute and relative paths
  const normalizedPath = filePath.replace(/^.*\/salt-marcher\//, '').replace(/^\.\//, '');

  // Only process files in tracked directories with relevant extensions
  const isTrackedDir = TRACKED_DIRS.some(dir => normalizedPath.startsWith(dir));
  const isRelevantFile = RELEVANT_EXTENSIONS.test(normalizedPath);

  if (!isTrackedDir || !isRelevantFile) {
    process.exit(0);
  }

  // Check if this is a rename (matching a recent delete)
  cleanupExpiredDeletes();
  const deletedFile = findMatchingDelete(normalizedPath);

  if (deletedFile) {
    try {
      const result = updateAllReferences(deletedFile.path, normalizedPath);

      if (result.updatedFiles > 0) {
        console.log(`[update-refs] Rename detected: ${deletedFile.path} -> ${normalizedPath}`);
        console.log(`[update-refs] Updated ${result.totalUpdates} reference(s) in ${result.updatedFiles} file(s)`);

        for (const change of result.changes) {
          console.log(`  - ${change.file} (${change.count} ref(s))`);
        }
      }
    } catch (error) {
      console.error(`[update-refs] Rename update error: ${error.message}`);
    }
  }

  // Update CLAUDE.md docs tree
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
