"use strict";
// dev-tools/ipc/register-dev-commands.ts
// Registration function for development IPC commands
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDevCommands = registerDevCommands;
const dev_commands_1 = require("./dev-commands");
/**
 * Register all development commands with the IPC server
 */
function registerDevCommands(server) {
    // Modal commands
    server.registerCommand('screenshot-modal', dev_commands_1.screenshotModal);
    server.registerCommand('navigate-to-section', dev_commands_1.navigateToSection);
    // Validation commands (legacy)
    server.registerCommand('validate-grid-layout', dev_commands_1.validateGridLayout);
    server.registerCommand('debug-stepper-styles', dev_commands_1.debugStepperStyles);
    server.registerCommand('validate-ui', dev_commands_1.validateUILegacy);
    // New generic measurement commands
    server.registerCommand('measure-ui', dev_commands_1.measureUI);
    server.registerCommand('validate-ui-rule', dev_commands_1.validateUIWithRules);
    server.registerCommand('validate-ui-config', dev_commands_1.validateUIWithConfig);
}
