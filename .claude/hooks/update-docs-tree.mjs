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

  // Only process files in docs/
  // Handle both absolute and relative paths
  const normalizedPath = filePath.replace(/^.*\/salt-marcher\//, '').replace(/^\.\//, '');
  if (!normalizedPath.startsWith('docs/')) {
    process.exit(0);
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
