#!/usr/bin/env node
// tests/integration/lib/test-helpers.mjs
// Generic test helper library for building integration tests

import * as net from 'net';
import { randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// CORE TEST EXECUTION
// ============================================================================

/**
 * Execute any IPC command and return result
 * @param {string} command - Command name
 * @param {Array} args - Command arguments
 * @param {number} timeout - Command timeout in ms
 */
export async function executeCommand(command, args = [], timeout = 30000) {
  const VAULT_PATH = path.resolve(import.meta.dirname, '../../../../..');
  const SOCKET_PATH = path.join(VAULT_PATH, '.obsidian/plugins/salt-marcher/ipc.sock');

  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    const id = randomBytes(8).toString('hex');
    let buffer = '';

    const timeoutHandle = setTimeout(() => {
      client.destroy();
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    client.on('connect', () => {
      const request = JSON.stringify({ command, args, id }) + '\n';
      client.write(request);
    });

    client.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === id) {
            clearTimeout(timeoutHandle);
            client.end();
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Command failed'));
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
  });
}

// ============================================================================
// MODAL INTERACTIONS
// ============================================================================

/**
 * Open a create/edit modal for any entity type
 * @param {string} entityType - Type: creature, spell, item, equipment
 * @param {string} name - Optional name for editing existing entity
 */
export async function openEntityModal(entityType, name = null) {
  const command = `edit-${entityType}`;
  const args = name ? [name] : [];
  return await executeCommand(command, args);
}

/**
 * Close the currently open modal
 */
export async function closeModal() {
  return await executeCommand('close-modal');
}

/**
 * Navigate to a specific section in the modal
 */
export async function navigateToSection(sectionName) {
  return await executeCommand('navigate-to-section', [sectionName]);
}

// ============================================================================
// FIELD INTERACTIONS
// ============================================================================

/**
 * Set value for any input field
 * @param {string} selector - CSS selector for the field
 * @param {string} value - Value to set
 */
export async function setFieldValue(selector, value) {
  return await executeCommand('set-input-value', [selector, value]);
}

/**
 * Click any element (checkbox, button, etc)
 * @param {string} selector - CSS selector for element
 */
export async function clickElement(selector) {
  return await executeCommand('click-element', [selector]);
}

/**
 * Add a token to a structured tags field
 * @param {string} fieldId - Field ID
 * @param {string} token - Token to add
 */
export async function addToken(fieldId, token) {
  return await executeCommand('add-token', [fieldId, token]);
}

/**
 * Get values from a field group (e.g., ability scores)
 * @param {string} groupId - Group ID (e.g., 'str' for strength)
 */
export async function getFieldValues(groupId) {
  return await executeCommand('get-ability-values', [groupId]);
}

// ============================================================================
// REPEATING FIELDS
// ============================================================================

/**
 * Add a new repeating field entry
 * @param {string} fieldId - Repeating field ID
 */
export async function addRepeatingEntry(fieldId) {
  return await clickElement(`button[data-add-repeating='${fieldId}']`);
}

/**
 * Remove a repeating field entry
 * @param {string} fieldId - Repeating field ID
 * @param {number} index - Entry index to remove
 */
export async function removeRepeatingEntry(fieldId, index) {
  return await clickElement(`button[data-remove-repeating='${fieldId}'][data-index='${index}']`);
}

/**
 * Toggle a checkbox in a repeating field
 * @param {string} ability - Ability name (for saves/skills)
 * @param {number} index - Entry index
 */
export async function toggleRepeatingCheckbox(ability, index) {
  return await executeCommand('toggle-save-checkbox', [ability, String(index)]);
}

// ============================================================================
// VALIDATION & ASSERTIONS
// ============================================================================

/**
 * Validate UI layout (labels, steppers, grid)
 * @param {string} mode - Validation mode: all|labels|steppers
 */
export async function validateUI(mode = 'all') {
  return await executeCommand('validate-ui', [mode]);
}

/**
 * Validate grid layout
 */
export async function validateGridLayout() {
  return await executeCommand('validate-grid-layout');
}

/**
 * Assert that logs contain specific patterns
 * @param {string} testId - Test ID for log correlation
 * @param {...string} patterns - Patterns to search for
 */
export async function assertLogContains(testId, ...patterns) {
  return await executeCommand('assert-log-contains', [testId, ...patterns]);
}

/**
 * Get logs for a specific test
 * @param {string} testId - Test ID
 */
export async function getTestLogs(testId) {
  return await executeCommand('get-test-logs', [testId]);
}

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

/**
 * Start a test context with optional debug config
 * @param {string} testId - Unique test ID
 * @param {string} testName - Human-readable test name
 * @param {Object} debugConfig - Optional debug configuration
 */
export async function startTest(testId, testName, debugConfig = null) {
  if (debugConfig) {
    await executeCommand('set-debug-config', [JSON.stringify(debugConfig)]);
  }
  return await executeCommand('start-test', [testId, testName]);
}

/**
 * End the current test context
 */
export async function endTest() {
  return await executeCommand('end-test');
}

/**
 * Add a log marker for test debugging
 * @param {string} marker - Marker text
 */
export async function logMarker(marker) {
  return await executeCommand('log-marker', [marker]);
}

// ============================================================================
// PLUGIN MANAGEMENT
// ============================================================================

/**
 * Reload the plugin
 */
export async function reloadPlugin() {
  return await executeCommand('reload-plugin');
}

/**
 * Get plugin logs
 * @param {number} lines - Number of lines to retrieve
 */
export async function getPluginLogs(lines = 100) {
  return await executeCommand('get-logs', [lines]);
}

/**
 * Import preset data
 * @param {string} type - Preset type: all|creatures|spells|items|equipment
 */
export async function importPresets(type = 'all') {
  return await executeCommand('import-presets', [type]);
}

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================

/**
 * Set debug configuration
 * @param {Object} config - Debug config object
 */
export async function setDebugConfig(config) {
  return await executeCommand('set-debug-config', [JSON.stringify(config)]);
}

/**
 * Get current debug configuration
 */
export async function getDebugConfig() {
  return await executeCommand('get-debug-config');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 */
export async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a sequence of commands with automatic waiting
 * @param {Array} steps - Array of {command, args, wait} objects
 */
export async function runSequence(steps) {
  const results = [];
  for (const step of steps) {
    try {
      const result = await executeCommand(step.command, step.args || []);
      results.push({ step: step.name || step.command, success: true, result });
      if (step.wait) await wait(step.wait);
    } catch (error) {
      results.push({ step: step.name || step.command, success: false, error: error.message });
      if (!step.continueOnError) break;
    }
  }
  return results;
}

/**
 * Create a field selector helper
 * @param {string} fieldId - Field ID
 * @param {string} type - Input type (input, select, textarea)
 */
export function fieldSelector(fieldId, type = 'input') {
  return `${type}[data-field-id='${fieldId}']`;
}

/**
 * Deep compare two objects for equality
 */
export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// ============================================================================
// TEST BUILDERS
// ============================================================================

/**
 * Build a standard field test
 * @param {string} fieldId - Field ID to test
 * @param {string} value - Value to set
 * @param {Object} expected - Expected result
 */
export function buildFieldTest(fieldId, value, expected = {}) {
  return {
    name: `Set ${fieldId} to ${value}`,
    command: 'set-input-value',
    args: [fieldSelector(fieldId), value],
    wait: 200,
    expect: { success: true, ...expected }
  };
}

/**
 * Build a navigation test
 * @param {string} section - Section to navigate to
 */
export function buildNavigationTest(section) {
  return {
    name: `Navigate to ${section}`,
    command: 'navigate-to-section',
    args: [section],
    wait: 300,
    expect: { success: true }
  };
}

/**
 * Build a validation test
 * @param {string} mode - Validation mode
 */
export function buildValidationTest(mode = 'all') {
  return {
    name: `Validate UI (${mode})`,
    command: 'validate-ui',
    args: [mode],
    expect: { success: true }
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Wrap a test function with error handling and cleanup
 * @param {Function} testFn - Test function to execute
 * @param {Function} cleanup - Cleanup function to run on error
 */
export async function withErrorHandling(testFn, cleanup = null) {
  try {
    return await testFn();
  } catch (error) {
    console.error('Test failed:', error);
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Core
  executeCommand,
  wait,
  runSequence,

  // Modal
  openEntityModal,
  closeModal,
  navigateToSection,

  // Fields
  setFieldValue,
  clickElement,
  addToken,
  getFieldValues,
  fieldSelector,

  // Repeating
  addRepeatingEntry,
  removeRepeatingEntry,
  toggleRepeatingCheckbox,

  // Validation
  validateUI,
  validateGridLayout,
  assertLogContains,
  getTestLogs,

  // Lifecycle
  startTest,
  endTest,
  logMarker,

  // Plugin
  reloadPlugin,
  getPluginLogs,
  importPresets,

  // Debug
  setDebugConfig,
  getDebugConfig,

  // Builders
  buildFieldTest,
  buildNavigationTest,
  buildValidationTest,

  // Utils
  deepEqual,
  withErrorHandling
};