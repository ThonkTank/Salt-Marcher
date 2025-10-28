#!/usr/bin/env node
// Git hooks management for DevKit

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVKIT_ROOT = path.resolve(__dirname, '../..');
const PLUGIN_ROOT = path.dirname(DEVKIT_ROOT);
const HOOKS_SOURCE = path.join(DEVKIT_ROOT, 'hooks');
const HOOKS_DEST = path.join(PLUGIN_ROOT, '.git/hooks');

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Git hooks manager
 */
export class HooksManager {
  /**
   * Install pre-commit hook
   */
  async install() {
    console.log(`${colors.cyan}Installing Git Hooks${colors.reset}\n`);

    try {
      // Check if .git directory exists
      try {
        await fs.access(path.join(PLUGIN_ROOT, '.git'));
      } catch (err) {
        console.log(`${colors.red}✗ Not a git repository${colors.reset}`);
        console.log(`${colors.dim}Run 'git init' first${colors.reset}`);
        return { success: false };
      }

      // Create hooks directory if it doesn't exist
      await fs.mkdir(HOOKS_DEST, { recursive: true });

      // Install pre-commit hook
      const sourceHook = path.join(HOOKS_SOURCE, 'pre-commit');
      const destHook = path.join(HOOKS_DEST, 'pre-commit');

      await fs.copyFile(sourceHook, destHook);
      await fs.chmod(destHook, 0o755); // Make executable

      console.log(`${colors.green}✓${colors.reset} Installed pre-commit hook`);

      // Check for configuration file
      const configPath = path.join(PLUGIN_ROOT, '.devkitrc.json');
      let config = {};

      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configContent);
      } catch (err) {
        // Create default config
        config = {
          precommit_tests: true,
          precommit_ui_validation: false,
          precommit_lint: false
        };
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(`${colors.green}✓${colors.reset} Created default configuration`);
      }

      console.log(`\n${colors.cyan}Configuration:${colors.reset}`);
      console.log(`  Run tests: ${config.precommit_tests ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);
      console.log(`  UI validation: ${config.precommit_ui_validation ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);
      console.log(`  Linting: ${config.precommit_lint ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);

      console.log(`\n${colors.dim}Edit .devkitrc.json to customize${colors.reset}`);

      return { success: true };
    } catch (error) {
      console.log(`${colors.red}✗ Installation failed: ${error.message}${colors.reset}`);
      return { success: false };
    }
  }

  /**
   * Uninstall pre-commit hook
   */
  async uninstall() {
    console.log(`${colors.cyan}Uninstalling Git Hooks${colors.reset}\n`);

    try {
      const destHook = path.join(HOOKS_DEST, 'pre-commit');

      try {
        await fs.unlink(destHook);
        console.log(`${colors.green}✓${colors.reset} Removed pre-commit hook`);
        return { success: true };
      } catch (err) {
        console.log(`${colors.yellow}⚠ Hook not installed${colors.reset}`);
        return { success: false };
      }
    } catch (error) {
      console.log(`${colors.red}✗ Uninstallation failed: ${error.message}${colors.reset}`);
      return { success: false };
    }
  }

  /**
   * Show hook status
   */
  async status() {
    console.log(`${colors.cyan}Git Hooks Status${colors.reset}\n`);

    const destHook = path.join(HOOKS_DEST, 'pre-commit');

    try {
      await fs.access(destHook);
      const stats = await fs.stat(destHook);
      const isExecutable = (stats.mode & 0o111) !== 0;

      console.log(`${colors.green}✓${colors.reset} Pre-commit hook installed`);
      console.log(`  Executable: ${isExecutable ? colors.green + 'yes' : colors.red + 'no'}${colors.reset}`);

      // Show configuration
      const configPath = path.join(PLUGIN_ROOT, '.devkitrc.json');
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        console.log(`\n${colors.cyan}Configuration:${colors.reset}`);
        console.log(`  Run tests: ${config.precommit_tests ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);
        console.log(`  UI validation: ${config.precommit_ui_validation ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);
        console.log(`  Linting: ${config.precommit_lint ? colors.green + 'enabled' : colors.dim + 'disabled'}${colors.reset}`);
      } catch (err) {
        console.log(`\n${colors.yellow}⚠ No configuration file found${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.red}✗${colors.reset} Pre-commit hook not installed`);
      console.log(`${colors.dim}Run 'devkit hooks install' to install${colors.reset}`);
    }
  }

  /**
   * Configure hook settings
   */
  async configure() {
    const { InteractivePrompt } = await import('./interactive.mjs');
    const prompt = new InteractivePrompt();

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Configure Pre-commit Hooks${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const configPath = path.join(PLUGIN_ROOT, '.devkitrc.json');
    let config = {};

    // Load existing config
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (err) {
      // Use defaults
      config = {
        precommit_tests: true,
        precommit_ui_validation: false,
        precommit_lint: false
      };
    }

    // Prompt for settings
    config.precommit_tests = await prompt.confirm(
      'Run unit tests before commit?',
      config.precommit_tests ?? true
    );

    config.precommit_ui_validation = await prompt.confirm(
      'Run UI validation before commit?',
      config.precommit_ui_validation ?? false
    );

    config.precommit_lint = await prompt.confirm(
      'Run linter before commit?',
      config.precommit_lint ?? false
    );

    // Save configuration
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(`\n${colors.green}✓${colors.reset} Configuration saved to .devkitrc.json`);

    prompt.close();
    return { success: true };
  }
}
