// devkit/core/ipc/register-dev-commands.ts
// Registration function for development IPC commands

import type { IPCServer } from '../../../src/app/ipc-server';
import {
  validateGridLayout,
  debugStepperStyles,
  validateUILegacy,
  navigateToSection,
  measureUI,
  validateUIWithRules,
  validateUIWithConfig,
  clickElement,
  setInputValue,
  addTokenToField,
  toggleRepeatingCheckbox,
  getRepeatingEntryValues,
} from './commands/dev-commands';
import {
  startTest,
  endTest,
  logMarker,
  setDebugConfig,
  getDebugConfig,
  getTestLogs,
  assertLogContains,
} from './commands/test-commands';
import {
  getFieldState,
  dumpFieldStates,
  getModalData,
} from './commands/field-inspection-commands';
import { dumpDOM } from './commands/dom-dump-command';
import { inspectUI } from './commands/ui-inspect-command';

/**
 * Register all development commands with the IPC server
 */
export function registerDevCommands(server: IPCServer): void {
  // Modal commands
  server.registerCommand('navigate-to-section', navigateToSection);
  server.registerCommand('click-element', clickElement);
  server.registerCommand('set-input-value', setInputValue);
  server.registerCommand('add-token', addTokenToField);

  // Repeating field commands
  server.registerCommand('toggle-save-checkbox', toggleRepeatingCheckbox);
  server.registerCommand('get-ability-values', getRepeatingEntryValues);

  // Validation commands (legacy)
  server.registerCommand('validate-grid-layout', validateGridLayout);
  server.registerCommand('debug-stepper-styles', debugStepperStyles);
  server.registerCommand('validate-ui', validateUILegacy);

  // New generic measurement commands
  server.registerCommand('measure-ui', measureUI);
  server.registerCommand('validate-ui-rule', validateUIWithRules);
  server.registerCommand('validate-ui-config', validateUIWithConfig);

  // Test lifecycle commands
  server.registerCommand('start-test', startTest);
  server.registerCommand('end-test', endTest);
  server.registerCommand('log-marker', logMarker);

  // Debug configuration commands
  server.registerCommand('set-debug-config', setDebugConfig);
  server.registerCommand('get-debug-config', getDebugConfig);

  // Test analysis commands
  server.registerCommand('get-test-logs', getTestLogs);
  server.registerCommand('assert-log-contains', assertLogContains);

  // Field inspection commands
  server.registerCommand('get-field-state', getFieldState);
  server.registerCommand('dump-field-states', dumpFieldStates);
  server.registerCommand('get-modal-data', getModalData);

  // DOM inspection commands
  server.registerCommand('dump-dom', dumpDOM);
  server.registerCommand('inspect-ui', inspectUI);
}