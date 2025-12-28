#!/usr/bin/env node
/**
 * Hook State Manager
 *
 * Manages ephemeral state between hook invocations for detecting
 * Delete+Create operations as renames.
 *
 * State is stored in .claude/.hook-state.json and automatically expires
 * after 60 seconds.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, basename, join } from 'path';

// ============================================================================
// CONSTANTS
// ============================================================================

const STATE_FILE = join(process.cwd(), '.claude/.hook-state.json');
const EXPIRY_MS = 60_000; // 60 seconds

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Loads the hook state from disk.
 * Returns empty state if file doesn't exist or is corrupted.
 *
 * @returns {{ deletedFiles: Array<{ path: string, timestamp: number }> }}
 */
export function loadState() {
  try {
    if (!existsSync(STATE_FILE)) {
      return { deletedFiles: [] };
    }

    const content = readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(content);

    // Validate structure
    if (!state || !Array.isArray(state.deletedFiles)) {
      return { deletedFiles: [] };
    }

    return state;
  } catch {
    // Corrupted or unreadable file - start fresh
    return { deletedFiles: [] };
  }
}

/**
 * Saves the hook state to disk.
 *
 * @param {{ deletedFiles: Array<{ path: string, timestamp: number }> }} state
 */
export function saveState(state) {
  try {
    // Ensure .claude directory exists
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[hook-state] Failed to save state: ${error.message}`);
  }
}

/**
 * Removes expired entries from the state.
 * An entry expires after EXPIRY_MS milliseconds.
 */
export function cleanupExpiredDeletes() {
  const state = loadState();
  const now = Date.now();

  const validFiles = state.deletedFiles.filter(
    (entry) => now - entry.timestamp < EXPIRY_MS
  );

  if (validFiles.length !== state.deletedFiles.length) {
    saveState({ deletedFiles: validFiles });
  }
}

/**
 * Records a file deletion for potential rename matching.
 *
 * @param {string} path - The path of the deleted file (relative, e.g., "docs/old.md")
 */
export function recordDelete(path) {
  const state = loadState();
  const now = Date.now();

  // Remove expired entries
  const validFiles = state.deletedFiles.filter(
    (entry) => now - entry.timestamp < EXPIRY_MS
  );

  // Check if this path already exists (update timestamp if so)
  const existingIndex = validFiles.findIndex((entry) => entry.path === path);
  if (existingIndex !== -1) {
    validFiles[existingIndex].timestamp = now;
  } else {
    validFiles.push({ path, timestamp: now });
  }

  saveState({ deletedFiles: validFiles });
}

/**
 * Finds a matching deleted file for a newly created file.
 * Matches by basename (case-insensitive).
 *
 * @param {string} newPath - The path of the newly created file
 * @returns {{ path: string, timestamp: number } | null} - The matching deleted file or null
 */
export function findMatchingDelete(newPath) {
  const state = loadState();
  const now = Date.now();
  const newBasename = basename(newPath).toLowerCase();

  // Filter to valid (non-expired) entries
  const validFiles = state.deletedFiles.filter(
    (entry) => now - entry.timestamp < EXPIRY_MS
  );

  // Find all matches by basename
  const matches = validFiles.filter(
    (entry) => basename(entry.path).toLowerCase() === newBasename
  );

  if (matches.length === 0) {
    return null;
  }

  // Return the most recent match
  const match = matches.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));

  // Remove the matched entry from state
  const remainingFiles = validFiles.filter((entry) => entry.path !== match.path);
  saveState({ deletedFiles: remainingFiles });

  return match;
}

/**
 * Clears all state (useful for testing).
 */
export function clearState() {
  saveState({ deletedFiles: [] });
}
