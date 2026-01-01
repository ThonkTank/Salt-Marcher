#!/usr/bin/env node
/**
 * PreToolUse Hook: Blockiert manuelle Task-Edits
 *
 * Blockiert Edit/Write wenn:
 * 1. Ziel ist Development-Roadmap.md
 * 2. old_string/new_string/content enthält Task-Tabellen-Pattern
 *
 * Exit-Codes:
 * - 0: Erlaubt (Tool wird ausgeführt)
 * - 1: Blockiert (Tool wird NICHT ausgeführt)
 */

import { readFileSync } from 'fs';

// Task-Tabellen-Patterns erkennen
const TASK_PATTERNS = [
  /^\s*\|\s*#?\d+\s*\|/m,           // | #123 | oder | 123 |
  /^\s*\|\s*[⬜🟢🔶⚠️📋⛔🔒✅]\s*\|/m,  // Status-Emojis in Tabelle
  /^\/\/\s*TASKS:/m,                // TypeScript // TASKS: Header
  /^##\s*TASKS/m,                   // Markdown ## TASKS Header
];

const ROADMAP_PATH = 'docs/architecture/Development-Roadmap.md';

/**
 * Prüft ob ein Edit/Write auf Task-Daten zielt
 */
function isTaskEdit(input) {
  const filePath = input?.file_path || '';
  const content = input?.content || input?.old_string || input?.new_string || '';

  // 1. Roadmap direkt editieren = immer blockieren
  if (filePath.includes(ROADMAP_PATH)) {
    return {
      blocked: true,
      reason: 'Development-Roadmap.md darf nicht direkt editiert werden',
    };
  }

  // 2. Task-Tabellen-Pattern in content
  for (const pattern of TASK_PATTERNS) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: 'Task-Tabellen dürfen nicht manuell editiert werden',
      };
    }
  }

  return { blocked: false };
}

async function main() {
  let rawInput;
  try {
    rawInput = readFileSync(0, 'utf-8');
  } catch {
    // Kein stdin = erlauben
    process.exit(0);
  }

  if (!rawInput.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(rawInput);
  } catch {
    // Ungültiges JSON = erlauben
    process.exit(0);
  }

  const result = isTaskEdit(input?.tool_input);

  if (result.blocked) {
    console.log(`[block-task-edits] ⛔ BLOCKIERT: ${result.reason}`);
    console.log('[block-task-edits] Nutze stattdessen:');
    console.log('  node scripts/task/task.mjs show <ID>     # Task-Details abrufen');
    console.log('  node scripts/task/task.mjs edit <ID> ... # Task ändern');
    process.exit(1); // Non-zero = blockiert
  }

  process.exit(0); // Erlaubt
}

main().catch((err) => {
  console.error('[block-task-edits] Fehler:', err.message);
  process.exit(0); // Bei Fehlern nicht blockieren (fail-open)
});
