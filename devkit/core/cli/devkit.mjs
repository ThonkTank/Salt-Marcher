#!/usr/bin/env node
// Salt Marcher DevKit - Node.js CLI Implementation

import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs/promises';
import yaml from 'js-yaml';
import { watch } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { InteractivePrompt, DevKitREPL, interactiveOpen } from './interactive.mjs';
import { WorkflowRunner, createWorkflow } from './workflows.mjs';
import { BackupManager } from './backup.mjs';
import { ScaffoldGenerator } from './scaffolding.mjs';
import { HooksManager } from './hooks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVKIT_ROOT = path.resolve(__dirname, '../..');  // devkit/core/cli -> devkit
const PLUGIN_ROOT = path.dirname(DEVKIT_ROOT);
const VAULT_ROOT = path.resolve(PLUGIN_ROOT, '../../..');

// IPC Configuration
const SOCKET_PATH = path.join(VAULT_ROOT, '.obsidian/plugins/salt-marcher/ipc.sock');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

// ============================================================================
// IPC Client
// ============================================================================

class IPCClient {
  async execute(command, args = [], timeout = 30000) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(SOCKET_PATH);
      const id = randomBytes(8).toString('hex');
      let buffer = '';

      const timeoutHandle = setTimeout(() => {
        client.destroy();
        reject(new Error(`Command timeout: ${command} (${timeout}ms)`));
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
        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          reject(new Error('Plugin not running. Is Obsidian open with Salt Marcher loaded?'));
        } else {
          reject(err);
        }
      });
    });
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

class TestCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case 'run':
        return await this.runTestSuite(rest[0]);

      case 'generate':
        return await this.generateTests(rest[0], rest[1]);

      case 'validate':
        return await this.validateTests();

      case 'watch':
        return await this.watchMode(rest);

      default:
        // Pass through as IPC command
        return await this.client.execute(subcommand, rest);
    }
  }

  async runTestSuite(suite) {
    console.log(`${colors.blue}Running test suite: ${suite}${colors.reset}`);

    // Load test runner
    const testRunnerPath = path.join(DEVKIT_ROOT, 'testing/integration/test-runner.mjs');
    const { default: runner } = await import(testRunnerPath);

    const testPath = path.join(DEVKIT_ROOT, 'testing/integration/cases', `${suite}.yaml`);
    return await runner.runTest(testPath);
  }

  async generateTests(entityType, outputDir) {
    console.log(`${colors.blue}Generating tests for: ${entityType}${colors.reset}`);

    const generatorPath = path.join(DEVKIT_ROOT, 'testing/integration/test-generator.mjs');
    const { generateTestSuite } = await import(generatorPath);

    const output = outputDir || path.join(DEVKIT_ROOT, 'testing/integration/cases/generated');
    await fs.mkdir(output, { recursive: true });

    // Load CreateSpec
    const specPath = path.join(PLUGIN_ROOT, `src/workmodes/library/${entityType}/create-spec.ts`);
    // Note: Would need to parse TypeScript or have specs exported as JSON

    console.log(`Generated tests in: ${output}`);
  }

  async validateTests() {
    const result = await this.client.execute('validate-ui', ['all']);
    if (result.success) {
      console.log(`${colors.green}✓ Validation passed${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Validation failed${colors.reset}`);
    }
    return result;
  }

  async watchMode(args) {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  Watch Mode - Monitoring for changes...${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Load configuration
    const configPath = path.join(PLUGIN_ROOT, '.devkitrc.json');
    let config = { test: { watch: { patterns: ['src/**/*.ts', 'devkit/testing/**/*.yaml'] } } };

    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (err) {
      console.log(`${colors.yellow}No config found, using defaults${colors.reset}`);
    }

    const watchPatterns = config.test?.watch?.patterns || ['src', 'devkit/testing'];
    const testSuite = args[0] || 'all';

    console.log(`${colors.blue}Watching:${colors.reset} ${watchPatterns.join(', ')}`);
    console.log(`${colors.blue}Test suite:${colors.reset} ${testSuite}`);
    console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);

    // Debounce mechanism
    let debounceTimer = null;
    let isRunning = false;

    const runTests = async (changedFile) => {
      if (isRunning) return;
      isRunning = true;

      // Clear screen
      console.clear();
      console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.cyan}  File changed: ${colors.reset}${path.relative(PLUGIN_ROOT, changedFile)}`);
      console.log(`${colors.cyan}  Running tests at ${new Date().toLocaleTimeString()}${colors.reset}`);
      console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

      try {
        if (testSuite === 'all') {
          // Run all integration tests
          const testRunnerPath = path.join(DEVKIT_ROOT, 'testing/integration/test-runner.mjs');
          const testCasesDir = path.join(DEVKIT_ROOT, 'testing/integration/cases');

          const files = await fs.readdir(testCasesDir);
          const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

          console.log(`${colors.blue}Running ${yamlFiles.length} test files...${colors.reset}\n`);

          // Import and run tests directly
          const { spawn } = await import('child_process');
          const child = spawn('node', [testRunnerPath, 'all'], { stdio: 'inherit' });

          await new Promise((resolve) => {
            child.on('close', resolve);
          });
        } else {
          await this.runTestSuite(testSuite);
        }
      } catch (err) {
        console.log(`${colors.red}✗ Test run failed: ${err.message}${colors.reset}`);
      }

      console.log(`\n${colors.cyan}Waiting for changes...${colors.reset}`);
      isRunning = false;
    };

    const handleChange = (filename) => {
      if (!filename) return;

      // Debounce: wait 500ms after last change
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runTests(filename);
      }, 500);
    };

    // Watch directories
    const watchers = [];

    for (const pattern of watchPatterns) {
      // Simple pattern matching - watch the base directory
      const basePath = pattern.split('/**')[0].split('*')[0];
      const watchPath = path.join(PLUGIN_ROOT, basePath);

      try {
        // Check if path exists
        await fs.access(watchPath);

        const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (!filename) return;

          // Filter based on pattern
          const fullPath = path.join(watchPath, filename);
          const shouldWatch =
            (pattern.includes('**/*.ts') && filename.endsWith('.ts')) ||
            (pattern.includes('**/*.yaml') && (filename.endsWith('.yaml') || filename.endsWith('.yml'))) ||
            !pattern.includes('*');

          if (shouldWatch) {
            handleChange(fullPath);
          }
        });

        watchers.push(watcher);
        console.log(`${colors.green}✓ Watching: ${colors.reset}${watchPath}`);
      } catch (err) {
        console.log(`${colors.yellow}⚠ Cannot watch: ${colors.reset}${watchPath} (${err.message})`);
      }
    }

    console.log();

    // Run tests once on start
    await runTests('Initial run');

    // Keep process alive
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        console.log(`\n\n${colors.cyan}Stopping watch mode...${colors.reset}`);
        watchers.forEach(w => w.close());
        resolve();
      });
    });
  }
}

class DebugCommand {
  constructor(client) {
    this.client = client;
    this.configPath = path.join(PLUGIN_ROOT, '.claude/debug.json');
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case 'enable':
        return await this.enableDebug(rest);

      case 'disable':
        return await this.disableDebug();

      case 'logs':
        return await this.getLogs(rest[0]);

      case 'marker':
        return await this.addMarker(rest.join(' '));

      case 'analyze':
        return await this.analyzeLogs(rest[0]);

      case 'config':
        return await this.showConfig();

      case 'field-state':
        return await this.getFieldState(rest[0]);

      case 'dump-fields':
        return await this.dumpFields(rest[0]);

      case 'field':
        return await this.debugField(rest);

      default:
        console.log(`${colors.red}Unknown debug command: ${subcommand}${colors.reset}`);
        console.log(`${colors.dim}Available: enable, disable, logs, marker, analyze, config, field-state, dump-fields, field${colors.reset}`);
    }
  }

  async enableDebug(options) {
    const config = { enabled: true };

    // Parse options
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      switch (opt) {
        case '--fields':
          config.logFields = options[++i]?.split(',') || ['*'];
          break;
        case '--categories':
          config.logCategories = options[++i]?.split(',') || ['*'];
          break;
        case '--all':
          config.logAll = true;
          config.logFields = ['*'];
          config.logCategories = ['*'];
          break;
      }
    }

    // Save config
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

    // Apply to plugin
    await this.client.execute('set-debug-config', [JSON.stringify(config)]);

    console.log(`${colors.green}Debug logging enabled${colors.reset}`);
    console.log('Config:', config);
  }

  async disableDebug() {
    const config = { enabled: false };
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    await this.client.execute('set-debug-config', [JSON.stringify(config)]);
    console.log(`${colors.yellow}Debug logging disabled${colors.reset}`);
  }

  async getLogs(lines = 100) {
    const result = await this.client.execute('get-logs', [lines]);
    if (result.logs) {
      console.log(result.logs);
    }
    return result;
  }

  async addMarker(text) {
    const marker = text || `=== MARKER ${new Date().toISOString()} ===`;
    await this.client.execute('log-marker', [marker]);
    console.log(`${colors.cyan}Added marker: ${marker}${colors.reset}`);
  }

  async analyzeLogs(logFile) {
    const logPath = logFile || path.join(VAULT_ROOT, 'CONSOLE_LOG.txt');
    const content = await fs.readFile(logPath, 'utf-8');

    // Analyze patterns
    const patterns = {
      errors: /ERROR|FAIL|Exception/gi,
      warnings: /WARN|Warning/gi,
      undefined: /undefined|null reference/gi,
      performance: /took \d+ms|slow|timeout/gi
    };

    console.log(`${colors.blue}Log Analysis:${colors.reset}`);
    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  ${type}: ${matches.length} occurrences`);
      }
    }

    // Find test markers
    const testMarkers = content.match(/\[TEST:.*?\]/g);
    if (testMarkers) {
      console.log(`\n${colors.blue}Test Markers Found:${colors.reset}`);
      const uniqueMarkers = [...new Set(testMarkers)];
      uniqueMarkers.forEach(m => console.log(`  ${m}`));
    }
  }

  async showConfig() {
    try {
      const config = await fs.readFile(this.configPath, 'utf-8');
      console.log(`${colors.blue}Current Debug Config:${colors.reset}`);
      console.log(config);
    } catch (err) {
      console.log(`${colors.yellow}No debug config found${colors.reset}`);
    }
  }

  async getFieldState(fieldId) {
    if (!fieldId) {
      console.log(`${colors.red}Field ID required${colors.reset}`);
      console.log(`${colors.dim}Usage: devkit debug field-state <fieldId>${colors.reset}`);
      console.log(`${colors.dim}Example: devkit debug field-state saveMod${colors.reset}`);
      return;
    }

    console.log(`${colors.blue}Inspecting field: ${fieldId}${colors.reset}\n`);

    try {
      const result = await this.client.execute('get-field-state', [fieldId]);

      if (!result.found) {
        console.log(`${colors.yellow}Field not found in current modal${colors.reset}`);
        console.log(`${colors.dim}Make sure a modal is open with this field${colors.reset}`);
        return;
      }

      const state = result.state;

      console.log(`${colors.cyan}Field State:${colors.reset}`);
      console.log(`  ${colors.green}Field ID:${colors.reset}       ${state.id}`);
      console.log(`  ${colors.green}Type:${colors.reset}           ${state.type}`);
      console.log(`  ${colors.green}Label:${colors.reset}          ${state.label || '(none)'}`);
      console.log(`  ${colors.green}Visible:${colors.reset}        ${state.visible ? '✓ Yes' : '✗ No'}`);
      console.log(`  ${colors.green}Value:${colors.reset}          ${JSON.stringify(state.value)}`);
      console.log(`  ${colors.green}Has Handle:${colors.reset}     ${state.hasHandle ? '✓ Yes' : '✗ No'}`);
      console.log(`  ${colors.green}Has Update Fn:${colors.reset}  ${state.hasUpdate ? '✓ Yes' : '✗ No'}`);

      if (state.spec) {
        console.log(`\n${colors.cyan}Field Spec:${colors.reset}`);
        console.log(`  ${colors.green}Required:${colors.reset}       ${state.spec.required ? 'Yes' : 'No'}`);
        console.log(`  ${colors.green}Has visibleIf:${colors.reset}  ${state.spec.hasVisibleIf ? 'Yes' : 'No'}`);
        console.log(`  ${colors.green}Has init:${colors.reset}       ${state.spec.hasInit ? 'Yes' : 'No'}`);

        if (state.spec.config) {
          console.log(`  ${colors.green}Config Keys:${colors.reset}    ${Object.keys(state.spec.config).join(', ')}`);
        }
      }

      if (state.container) {
        console.log(`\n${colors.cyan}DOM State:${colors.reset}`);
        console.log(`  ${colors.green}Has Container:${colors.reset}  ${state.container.exists ? 'Yes' : 'No'}`);
        console.log(`  ${colors.green}Classes:${colors.reset}        ${state.container.classes?.join(', ') || '(none)'}`);
        console.log(`  ${colors.green}Width:${colors.reset}          ${state.container.width}px`);
        console.log(`  ${colors.green}Height:${colors.reset}         ${state.container.height}px`);
      }

      if (state.errors && state.errors.length > 0) {
        console.log(`\n${colors.red}Validation Errors:${colors.reset}`);
        state.errors.forEach(err => console.log(`  - ${err}`));
      }

    } catch (err) {
      if (err.message.includes('not running')) {
        console.log(`${colors.red}Plugin not running${colors.reset}`);
        console.log(`${colors.dim}Make sure Obsidian is open with Salt Marcher loaded${colors.reset}`);
      } else {
        console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
      }
    }
  }

  /**
   * Find field definition location in codebase
   */
  async findFieldLocation(fieldId, entityType) {
    try {
      const { execSync } = await import('child_process');

      // Search in entity-specific create-spec files first
      let searchPath = 'src/workmodes/library/';
      if (entityType) {
        searchPath = `src/workmodes/library/${entityType}s/create-spec.ts`;
      }

      // Use ripgrep to find field definition
      const result = execSync(
        `rg "id: \\"${fieldId}\\"" ${searchPath} -n --no-heading`,
        { encoding: 'utf-8', cwd: PLUGIN_ROOT }
      ).trim();

      if (result) {
        const [fileAndLine] = result.split('\n');
        const [file, line] = fileAndLine.split(':');

        // Try to determine field type
        const typeResult = execSync(
          `rg "id: \\"${fieldId}\\"" ${file} -A 2 | grep "type:"`,
          { encoding: 'utf-8', cwd: PLUGIN_ROOT }
        ).trim();

        let type = null;
        if (typeResult) {
          const match = typeResult.match(/type:\s*["']([^"']+)["']/);
          if (match) type = match[1];
        }

        return { file: file.replace(PLUGIN_ROOT + '/', ''), line, type };
      }
    } catch (err) {
      // Field not found or rg not available
      return null;
    }
  }

  /**
   * Find which section a field belongs to
   */
  async findFieldSection(fieldId, entityType) {
    try {
      if (!entityType) return null;

      const specPath = path.join(PLUGIN_ROOT, `src/workmodes/library/${entityType}s/create-spec.ts`);
      const content = await fs.readFile(specPath, 'utf-8');

      // Find sections in browse config
      // Pattern: { id: "sectionId", ..., fieldIds: ["field1", "field2"] }
      const sectionPattern = /{\s*id:\s*["']([^"']+)["'][^}]*?fieldIds:\s*\[(.*?)\]/gs;
      let match;

      while ((match = sectionPattern.exec(content)) !== null) {
        const sectionId = match[1];
        const fieldIdsStr = match[2];

        // Check if this section contains our field
        if (fieldIdsStr.includes(`"${fieldId}"`) || fieldIdsStr.includes(`'${fieldId}'`)) {
          return sectionId;
        }
      }

      return null;
    } catch (err) {
      // Could not determine section
      return null;
    }
  }

  /**
   * Determine rendering pipeline based on field type
   */
  getRenderingPipeline(fieldState) {
    // Try to infer field type from container classes or field manager data
    let fieldType = null;

    if (fieldState.fieldManager?.type) {
      fieldType = fieldState.fieldManager.type;
    } else if (fieldState.chips) {
      fieldType = 'tokens';
    } else if (fieldState.input) {
      fieldType = fieldState.input.type === 'number' ? 'number' : 'text';
    }

    if (!fieldType) return null;

    const pipelines = {
      'tokens': [
        'create-spec.ts (field definition)',
        'modal.ts (field initialization)',
        'renderer-tokens.ts (chip rendering)',
        'token-field-core-new.ts (segment handling)',
        'DOM (chips with .sm-cc-chip)'
      ],
      'text': [
        'create-spec.ts (field definition)',
        'modal.ts (field initialization)',
        'renderer-text.ts (input rendering)',
        'DOM (input element)'
      ],
      'number': [
        'create-spec.ts (field definition)',
        'modal.ts (field initialization)',
        'renderer-number.ts (stepper rendering)',
        'DOM (number input + buttons)'
      ],
      'select': [
        'create-spec.ts (field definition)',
        'modal.ts (field initialization)',
        'renderer-select.ts (dropdown rendering)',
        'DOM (select element)'
      ],
      'textarea': [
        'create-spec.ts (field definition)',
        'modal.ts (field initialization)',
        'renderer-textarea.ts (textarea rendering)',
        'DOM (textarea element)'
      ]
    };

    return pipelines[fieldType] || [
      'create-spec.ts (field definition)',
      'modal.ts (field initialization)',
      `renderer-${fieldType}.ts (rendering)`,
      'DOM'
    ];
  }

  /**
   * Integrated field debugger - opens entity, inspects field, generates report
   * Usage: devkit debug field <fieldId> --creature <name>
   */
  async debugField(args) {
    const params = {};
    let fieldId = null;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.substring(2);
        params[key] = args[++i];
      } else if (!fieldId) {
        fieldId = arg;
      }
    }

    if (!fieldId) {
      console.log(`${colors.red}Field ID required${colors.reset}`);
      console.log(`${colors.dim}Usage: devkit debug field <fieldId> [--creature <name>] [--spell <name>] [--item <name>]${colors.reset}`);
      console.log(`${colors.dim}Example: devkit debug field passivesList --creature aboleth${colors.reset}`);
      return;
    }

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  Field Debugger: ${fieldId}${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    try {
      // Step 1: Open entity if specified
      let entityType = null;
      if (params.creature || params.spell || params.item || params.equipment) {
        entityType = params.creature ? 'creature' : params.spell ? 'spell' : params.item ? 'item' : 'equipment';
        const entityName = params[entityType];

        console.log(`${colors.blue}[1/7] Opening ${entityType}: ${entityName}${colors.reset}`);
        await this.client.execute(`edit-${entityType}`, [entityName]);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for modal to open and render

        // Auto-navigate to field's section if possible
        const section = await this.findFieldSection(fieldId, entityType);
        if (section) {
          console.log(`${colors.dim}    Navigating to section: ${section}${colors.reset}`);
          try {
            await this.client.execute('navigate-to-section', [section]);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for section to render
          } catch (err) {
            console.log(`${colors.dim}    (Navigation failed: ${err.message})${colors.reset}`);
          }
        }
      } else {
        console.log(`${colors.blue}[1/6] Using current modal${colors.reset}`);
      }

      // Step 2: Get field state
      console.log(`${colors.blue}[2/6] Inspecting field state${colors.reset}`);
      const fieldState = await this.client.execute('get-field-state', [fieldId]);

      // Step 3: Find code location
      console.log(`${colors.blue}[3/6] Finding code location${colors.reset}`);
      const codeLocation = await this.findFieldLocation(fieldId, entityType);

      // Step 4: Determine rendering pipeline
      console.log(`${colors.blue}[4/6] Analyzing rendering pipeline${colors.reset}`);
      const pipeline = this.getRenderingPipeline(fieldState);

      // Step 5: Get modal data
      console.log(`${colors.blue}[5/6] Getting modal data${colors.reset}`);
      const modalData = await this.client.execute('get-modal-data', []);

      // Step 6: Get recent logs
      console.log(`${colors.blue}[6/6] Collecting logs${colors.reset}\n`);
      const logsResult = await this.client.execute('get-logs', ['100']);
      const relevantLogs = logsResult.logs?.split('\n')
        .filter(line => line.includes(fieldId) || line.includes('TokenRenderer'))
        .slice(-10);

      // Generate Report
      console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.cyan}  Field Debug Report${colors.reset}`);
      console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

      // Code Location
      if (codeLocation) {
        console.log(`${colors.yellow}Code Location:${colors.reset}`);
        console.log(`  ${codeLocation.file}:${codeLocation.line}`);
        if (codeLocation.type) {
          console.log(`  Type: ${codeLocation.type}`);
        }
        console.log();
      }

      // Rendering Pipeline
      if (pipeline) {
        console.log(`${colors.yellow}Rendering Pipeline:${colors.reset}`);
        pipeline.forEach((step, i) => {
          const arrow = i < pipeline.length - 1 ? ' →' : '';
          console.log(`  ${step}${arrow}`);
        });
        console.log();
      }

      // Field State
      console.log(`${colors.yellow}Field State:${colors.reset}`);
      console.log(`  ID: ${fieldState.fieldId || fieldId}`);
      console.log(`  Exists: ${fieldState.exists ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
      if (fieldState.container) {
        console.log(`  Visible: ${fieldState.container.visible ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
        console.log(`  Classes: ${fieldState.container.classes.join(', ')}`);
      }
      if (fieldState.input) {
        console.log(`  Input Type: ${fieldState.input.type}`);
        console.log(`  Value: ${JSON.stringify(fieldState.input.value)}`);
        console.log(`  Disabled: ${fieldState.input.disabled ? 'Yes' : 'No'}`);
      }
      if (fieldState.chips && fieldState.chips.length > 0) {
        console.log(`  Chips: ${fieldState.chips.length} found`);
        fieldState.chips.forEach((chip, i) => {
          console.log(`    [${i}] ${chip.text} ${chip.editable ? colors.green + '(editable)' : colors.red + '(not editable)'}${colors.reset}`);
        });
      }

      // Modal Data
      console.log(`\n${colors.yellow}Modal Data:${colors.reset}`);
      if (modalData[fieldId] !== undefined) {
        console.log(`  Field value in data: ${JSON.stringify(modalData[fieldId], null, 2)}`);
      } else {
        console.log(`  ${colors.red}Field not found in modal data${colors.reset}`);
      }

      // Logs
      if (relevantLogs && relevantLogs.length > 0) {
        console.log(`\n${colors.yellow}Relevant Logs (last 10):${colors.reset}`);
        relevantLogs.forEach(log => console.log(`  ${log}`));
      }

      // Diagnosis
      console.log(`\n${colors.yellow}Diagnosis:${colors.reset}`);
      if (!fieldState.exists) {
        console.log(`  ${colors.red}✗ Field does not exist in DOM${colors.reset}`);
        console.log(`    → Check field ID in create-spec.ts`);
        console.log(`    → Verify field is in correct section`);
      } else if (fieldState.container && !fieldState.container.visible) {
        console.log(`  ${colors.red}✗ Field exists but is not visible${colors.reset}`);
        console.log(`    → Check visibleIf conditions`);
        console.log(`    → Check CSS display/visibility`);
      } else if (fieldState.chips && fieldState.chips.length > 0) {
        const hasNonEditableChips = fieldState.chips.some(c => !c.editable);
        if (hasNonEditableChips) {
          console.log(`  ${colors.red}✗ Chips are not editable${colors.reset}`);
          console.log(`    → Check if chipTemplate is used (prevents inline editing)`);
          console.log(`    → Verify fieldDef.editable is true in config`);
          console.log(`    → Check if click handlers are attached`);
        } else {
          console.log(`  ${colors.green}✓ Chips are editable${colors.reset}`);
        }
      }

      console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    } catch (err) {
      console.error(`${colors.red}Error during field debugging: ${err.message}${colors.reset}`);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
    }
  }

  async dumpFields(modalType) {
    console.log(`${colors.blue}Dumping all field states...${colors.reset}\n`);

    try {
      const result = await this.client.execute('dump-field-states', modalType ? [modalType] : []);

      if (!result.fields || result.fields.length === 0) {
        console.log(`${colors.yellow}No fields found${colors.reset}`);
        console.log(`${colors.dim}Make sure a modal is open${colors.reset}`);
        return;
      }

      console.log(`${colors.green}Found ${result.fields.length} fields:${colors.reset}\n`);

      // Group by section if available
      const sections = {};
      result.fields.forEach(field => {
        const section = field.section || 'default';
        if (!sections[section]) {
          sections[section] = [];
        }
        sections[section].push(field);
      });

      for (const [section, fields] of Object.entries(sections)) {
        if (section !== 'default') {
          console.log(`${colors.cyan}[${section}]${colors.reset}`);
        }

        fields.forEach(field => {
          const visibleMark = field.visible ? colors.green + '✓' : colors.red + '✗';
          const valueMark = field.value !== undefined ? '●' : '○';
          console.log(`  ${visibleMark} ${field.id}${colors.reset} (${field.type}) ${valueMark}`);

          if (field.value !== undefined) {
            const valueStr = typeof field.value === 'string' ? field.value : JSON.stringify(field.value);
            const truncated = valueStr.length > 50 ? valueStr.substring(0, 50) + '...' : valueStr;
            console.log(`    ${colors.dim}= ${truncated}${colors.reset}`);
          }
        });
        console.log();
      }

      // Write JSON dump to file
      const dumpPath = path.join(DEVKIT_ROOT, 'validation/dumps', `fields-${Date.now()}.json`);
      await fs.mkdir(path.dirname(dumpPath), { recursive: true });
      await fs.writeFile(dumpPath, JSON.stringify(result, null, 2));
      console.log(`${colors.dim}Full dump saved to: ${path.relative(PLUGIN_ROOT, dumpPath)}${colors.reset}`);

    } catch (err) {
      if (err.message.includes('not running')) {
        console.log(`${colors.red}Plugin not running${colors.reset}`);
        console.log(`${colors.dim}Make sure Obsidian is open with Salt Marcher loaded${colors.reset}`);
      } else {
        console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
      }
    }
  }

  get help() {
    return `
Usage: devkit debug <command> [options]

Debug and logging utilities

Commands:
  enable [options]      Enable debug logging
    --fields <list>     Comma-separated field IDs to log
    --categories <list> Comma-separated categories to log
    --all               Log everything
  disable               Disable debug logging
  logs [n]              Show last n log lines (default: 100)
  marker <text>         Add a marker to logs
  analyze [file]        Analyze log patterns
  config                Show current debug config
  field-state <id>      Inspect field state in current modal
  dump-fields [type]    Dump all field states to JSON

Examples:
  devkit debug enable --fields "saveMod,saveProf"
  devkit debug logs 200
  devkit debug field-state saveMod
  devkit debug dump-fields creature
`;
  }
}

class UICommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case 'open':
        return await this.openModal(rest[0], rest[1]);

      case 'validate':
        return await this.validate(rest);

      case 'measure':
        return await this.measure(rest[0]);

      case 'find':
        return await this.findElement(rest[0]);

      case 'dump':
        return await this.dumpDOM(rest[0], rest[1]);

      case 'inspect':
        return await this.inspectUI(rest[0], rest[1]);

      default:
        console.log(`${colors.red}Unknown UI command: ${subcommand}${colors.reset}`);
    }
  }

  async openModal(entityType, name) {
    const command = `edit-${entityType}`;

    // If no name provided, use interactive mode
    if (!name) {
      return await interactiveOpen(this.client, entityType);
    }

    const args = [name];
    console.log(`${colors.blue}Opening ${entityType} editor for "${name}"${colors.reset}`);
    return await this.client.execute(command, args);
  }

  async validate(options) {
    const mode = options[0] || 'all';
    console.log(`${colors.blue}Running UI validation (${mode})${colors.reset}`);

    const result = await this.client.execute('validate-ui', [mode]);

    if (result.success) {
      console.log(`${colors.green}✓ All validations passed${colors.reset}`);
      if (result.details) {
        console.log('\nDetails:', result.details);
      }
    } else {
      console.log(`${colors.red}✗ Validation failed${colors.reset}`);
      if (result.errors) {
        result.errors.forEach(err => {
          console.log(`  - ${err}`);
        });
      }
    }

    // Generate report if requested
    if (options.includes('--report')) {
      const reportPath = path.join(DEVKIT_ROOT, 'validation/reports', `validation-${Date.now()}.html`);
      await this.generateReport(result, reportPath);
      console.log(`\n${colors.cyan}Report saved: ${reportPath}${colors.reset}`);
    }

    return result;
  }

  async measure(selector) {
    if (!selector) {
      console.log(`${colors.red}Selector required${colors.reset}`);
      return;
    }

    const result = await this.client.execute('measure-elements', [selector]);
    if (result.measurements) {
      console.log(`${colors.blue}Measurements for "${selector}":${colors.reset}`);
      console.log(JSON.stringify(result.measurements, null, 2));
    }
    return result;
  }

  async dumpDOM(selector, maxDepth) {
    const sel = selector || '.sm-cc-entry-list';
    const depth = maxDepth || '5';

    console.log(`${colors.blue}Dumping DOM for "${sel}" (depth: ${depth})${colors.reset}\n`);

    const result = await this.client.execute('dump-dom', [sel, depth]);

    if (result.success && result.ascii) {
      console.log(result.ascii);
    } else if (result.error) {
      console.log(`${colors.red}Error: ${result.error}${colors.reset}`);
    } else {
      console.log(`${colors.red}Error: Command failed${colors.reset}`);
    }

    return result;
  }

  async inspectUI(selector, maxDepth) {
    const sel = selector || '.sm-cc-entry-head';
    const depth = maxDepth || '2';

    console.log(`${colors.blue}Inspecting UI layout for "${sel}" (depth: ${depth})${colors.reset}\n`);

    const result = await this.client.execute('inspect-ui', [sel, depth]);

    // IPC wraps the result in a 'data' field
    const data = result.data || result;

    if (data.success && data.report) {
      console.log(data.report);
    } else if (data.error) {
      console.log(`${colors.red}Error: ${data.error}${colors.reset}`);
    } else {
      console.log(`${colors.red}Error: Command failed${colors.reset}`);
    }

    return result;
  }

  async inspect() {
    console.log(`${colors.blue}Inspecting current DOM state...${colors.reset}`);
    const result = await this.client.execute('get-dom-tree');
    if (result.tree) {
      console.log(result.tree);
    }
    return result;
  }

  async findElement(selector) {
    if (!selector) {
      console.log(`${colors.red}Selector required${colors.reset}`);
      return;
    }

    const result = await this.client.execute('find-element', [selector]);
    if (result.found) {
      console.log(`${colors.green}✓ Found: ${result.count} element(s)${colors.reset}`);
      if (result.elements) {
        result.elements.forEach((el, i) => {
          console.log(`  [${i}] ${el.tag} ${el.attributes}`);
        });
      }
    } else {
      console.log(`${colors.red}✗ Not found: ${selector}${colors.reset}`);
    }
    return result;
  }

  async generateReport(validationResult, outputPath) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>UI Validation Report</title>
    <style>
        body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; }
        .success { color: #16a34a; }
        .error { color: #dc2626; }
        .warning { color: #ca8a04; }
        .metric { background: #f3f4f6; padding: 10px; margin: 10px 0; border-radius: 5px; }
        pre { background: #1f2937; color: #f3f4f6; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>UI Validation Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>

    <h2>Summary</h2>
    <div class="metric">
        Status: <span class="${validationResult.success ? 'success' : 'error'}">
            ${validationResult.success ? 'PASSED' : 'FAILED'}
        </span>
    </div>

    <h2>Details</h2>
    <pre>${JSON.stringify(validationResult, null, 2)}</pre>
</body>
</html>`;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html);
  }
}

class MigrateCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    const [type, ...options] = args;

    if (!type) {
      return await this.listMigrations();
    }

    const flags = {
      dryRun: options.includes('--dry-run'),
      backup: !options.includes('--no-backup'),
      validate: !options.includes('--no-validate')
    };

    console.log(`${colors.blue}Running migration: ${type}${colors.reset}`);
    console.log('Options:', flags);

    // Import migration script
    const migrationPath = path.join(DEVKIT_ROOT, 'migration/migrations', `migrate-${type}.mjs`);

    try {
      const { default: migrate } = await import(migrationPath);
      const result = await migrate(flags);

      if (result.success) {
        console.log(`${colors.green}✓ Migration completed successfully${colors.reset}`);
        if (result.stats) {
          console.log('Statistics:', result.stats);
        }
      } else {
        console.log(`${colors.red}✗ Migration failed${colors.reset}`);
        if (result.error) {
          console.log('Error:', result.error);
        }
      }

      return result;
    } catch (err) {
      console.log(`${colors.red}Migration not found: ${type}${colors.reset}`);
      console.log('Available migrations:');
      await this.listMigrations();
    }
  }

  async listMigrations() {
    const migrationsDir = path.join(DEVKIT_ROOT, 'migration/migrations');

    try {
      const files = await fs.readdir(migrationsDir);

      const migrations = files
        .filter(f => f.startsWith('migrate-') && f.endsWith('.mjs'))
        .map(f => f.replace('migrate-', '').replace('.mjs', ''));

      console.log(`${colors.blue}Available migrations:${colors.reset}`);
      migrations.forEach(m => console.log(`  - ${m}`));

      return migrations;
    } catch (err) {
      console.log(`${colors.yellow}No migrations found${colors.reset}`);
      return [];
    }
  }
}

// ============================================================================
// Main CLI
// ============================================================================

class WorkflowCommand {
  constructor(client) {
    this.client = client;
    this.runner = new WorkflowRunner(client);
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case 'list':
        return await this.runner.list();

      case 'run':
        const workflowName = rest[0];
        if (!workflowName) {
          // Interactive selection
          const workflow = await this.runner.selectWorkflow();
          if (workflow) {
            const variables = await this.runner.collectVariables(workflow);
            return await this.runner.run(workflow.name, variables);
          }
        } else {
          return await this.runner.run(workflowName);
        }
        break;

      case 'create':
        return await createWorkflow();

      default:
        console.log(`${colors.yellow}Usage: devkit workflow <list|run|create>${colors.reset}`);
    }
  }
}

class BackupCommand {
  constructor() {
    this.manager = new BackupManager();
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    switch (subcommand) {
      case 'create':
        const name = rest.join(' ') || 'manual';
        return await this.manager.create(name);

      case 'list':
        return await this.manager.displayList();

      case 'restore':
        const backupId = rest[0];
        if (!backupId) {
          console.log(`${colors.red}Backup ID required${colors.reset}`);
          return;
        }
        const force = rest.includes('--force');
        const dryRun = rest.includes('--dry-run');
        return await this.manager.restore(backupId, { force, dryRun });

      case 'delete':
        const deleteId = rest[0];
        if (!deleteId) {
          console.log(`${colors.red}Backup ID required${colors.reset}`);
          return;
        }
        const forceDelete = rest.includes('--force');
        return await this.manager.delete(deleteId, { force: forceDelete });

      default:
        console.log(`${colors.yellow}Usage: devkit backup <create|list|restore|delete>${colors.reset}`);
    }
  }
}

class GenerateCommand {
  constructor() {
    this.generator = new ScaffoldGenerator();
  }

  async handle(args) {
    const [generatorType, ...rest] = args;

    if (!generatorType) {
      // Interactive mode - select generator type
      return await this.generator.run();
    }

    // Direct generation by type
    switch (generatorType) {
      case 'entity':
        return await this.generator.generateEntity();
      case 'ipc-command':
      case 'ipc':
        return await this.generator.generateIpcCommand();
      case 'cli-command':
      case 'cli':
        return await this.generator.generateCliCommand();
      case 'migration':
        return await this.generator.generateMigration();
      case 'test':
        return await this.generator.generateTest();
      default:
        console.log(`${colors.red}Unknown generator type: ${generatorType}${colors.reset}`);
        console.log(`${colors.dim}Available types: entity, ipc-command, cli-command, migration, test${colors.reset}`);
        console.log(`${colors.dim}Or run 'devkit generate' for interactive mode${colors.reset}`);
    }
  }

  get help() {
    return `
Usage: devkit generate [type]

Generate code from templates

Generator Types:
  entity         New entity type with CreateSpec
  ipc-command    IPC command for plugin
  cli-command    CLI command for DevKit
  migration      Migration script
  test           Test file

Options:
  --help         Show this help message

Examples:
  devkit generate                    # Interactive mode
  devkit generate entity             # Generate entity boilerplate
  devkit generate ipc-command        # Generate IPC command
  devkit generate migration          # Generate migration script
`;
  }
}

class HooksCommand {
  constructor() {
    this.manager = new HooksManager();
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    if (!subcommand) {
      console.log(`${colors.yellow}Usage: devkit hooks <install|uninstall|status|configure>${colors.reset}`);
      return;
    }

    switch (subcommand) {
      case 'install':
        return await this.manager.install();
      case 'uninstall':
        return await this.manager.uninstall();
      case 'status':
        return await this.manager.status();
      case 'configure':
      case 'config':
        return await this.manager.configure();
      default:
        console.log(`${colors.red}Unknown hooks command: ${subcommand}${colors.reset}`);
        console.log(`${colors.dim}Available: install, uninstall, status, configure${colors.reset}`);
    }
  }

  get help() {
    return `
Usage: devkit hooks <command>

Manage Git pre-commit hooks

Commands:
  install        Install pre-commit hooks
  uninstall      Remove pre-commit hooks
  status         Show hook installation status
  configure      Configure hook settings

Options:
  --help         Show this help message

Examples:
  devkit hooks install               # Install pre-commit hooks
  devkit hooks status                # Check if hooks are installed
  devkit hooks configure             # Change hook settings
  devkit hooks uninstall             # Remove hooks
`;
  }
}

class DataCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    const [subcommand, ...rest] = args;

    if (!subcommand) {
      console.log(`${colors.yellow}Usage: devkit data <inspect|sync|validate>${colors.reset}`);
      return;
    }

    switch (subcommand) {
      case 'inspect':
        return await this.inspect(rest[0], rest[1]);
      case 'sync':
        return await this.sync(rest[0], rest.slice(1));
      case 'validate':
        return await this.validate(rest[0]);
      default:
        console.log(`${colors.red}Unknown data command: ${subcommand}${colors.reset}`);
        console.log(`${colors.dim}Available: inspect, sync, validate${colors.reset}`);
    }
  }

  async inspect(entityType, name) {
    if (!entityType || !name) {
      console.log(`${colors.red}Usage: devkit data inspect <type> <name>${colors.reset}`);
      console.log(`${colors.dim}Example: devkit data inspect creature aboleth${colors.reset}`);
      return;
    }

    console.log(`${colors.blue}Inspecting ${entityType}: ${name}${colors.reset}\n`);

    try {
      // Load preset data
      const presetPath = path.join(PLUGIN_ROOT, 'Presets', this.capitalizeFirst(entityType) + 's');
      const presetFile = await this.findFile(presetPath, name);

      // Load vault data
      const vaultPath = path.join(VAULT_ROOT, 'SaltMarcher', this.capitalizeFirst(entityType) + 's');
      const vaultFile = await this.findFile(vaultPath, name);

      if (!presetFile && !vaultFile) {
        console.log(`${colors.red}✗ Not found in presets or vault${colors.reset}`);
        return;
      }

      // Read and parse both files
      const presetData = presetFile ? await this.parseMarkdownFile(presetFile) : null;
      const vaultData = vaultFile ? await this.parseMarkdownFile(vaultFile) : null;

      // Display results
      if (presetFile) {
        console.log(`${colors.green}Preset:${colors.reset} ${path.relative(PLUGIN_ROOT, presetFile)}`);
      } else {
        console.log(`${colors.yellow}Preset: Not found${colors.reset}`);
      }

      if (vaultFile) {
        console.log(`${colors.green}Vault:${colors.reset}  ${path.relative(VAULT_ROOT, vaultFile)}`);
      } else {
        console.log(`${colors.yellow}Vault:  Not found${colors.reset}`);
      }

      // Compare if both exist
      if (presetData && vaultData) {
        console.log(`\n${colors.cyan}Comparing...${colors.reset}\n`);
        const diffs = this.compareData(presetData, vaultData);

        if (diffs.length === 0) {
          console.log(`${colors.green}✓ Identical${colors.reset}`);
        } else {
          console.log(`${colors.yellow}Differences found:${colors.reset}\n`);
          diffs.forEach(diff => {
            console.log(`  ${colors.yellow}${diff.path}${colors.reset}`);
            console.log(`    Preset: ${colors.dim}${JSON.stringify(diff.preset)}${colors.reset}`);
            console.log(`    Vault:  ${colors.dim}${JSON.stringify(diff.vault)}${colors.reset}`);
          });
        }
      } else if (presetData) {
        console.log(`\n${colors.yellow}Only in preset (not imported to vault yet)${colors.reset}`);
      } else if (vaultData) {
        console.log(`\n${colors.yellow}Only in vault (custom/modified)${colors.reset}`);
      }

    } catch (err) {
      console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    }
  }

  async sync(entityType, options) {
    if (!entityType) {
      console.log(`${colors.red}Usage: devkit data sync <type> [--preview|--force]${colors.reset}`);
      console.log(`${colors.dim}Example: devkit data sync creatures --preview${colors.reset}`);
      return;
    }

    const preview = options.includes('--preview') || options.includes('--dry-run');
    const force = options.includes('--force');

    console.log(`${colors.blue}Syncing ${entityType} from presets to vault...${colors.reset}\n`);

    if (preview) {
      console.log(`${colors.cyan}[PREVIEW MODE - no changes will be made]${colors.reset}\n`);
    }

    try {
      const presetPath = path.join(PLUGIN_ROOT, 'Presets', this.capitalizeFirst(entityType));
      const vaultPath = path.join(VAULT_ROOT, 'SaltMarcher', this.capitalizeFirst(entityType));

      // Get all preset files
      const presetFiles = await this.getAllMarkdownFiles(presetPath);
      console.log(`Found ${presetFiles.length} preset files\n`);

      let copied = 0;
      let skipped = 0;
      let updated = 0;

      for (const presetFile of presetFiles) {
        const relativePath = path.relative(presetPath, presetFile);
        const vaultFile = path.join(vaultPath, relativePath);
        const vaultFileExists = await fs.access(vaultFile).then(() => true).catch(() => false);

        if (!vaultFileExists) {
          console.log(`${colors.green}+ ${relativePath}${colors.reset}`);
          if (!preview) {
            await fs.mkdir(path.dirname(vaultFile), { recursive: true });
            await fs.copyFile(presetFile, vaultFile);
          }
          copied++;
        } else if (force) {
          console.log(`${colors.yellow}↻ ${relativePath}${colors.reset}`);
          if (!preview) {
            await fs.copyFile(presetFile, vaultFile);
          }
          updated++;
        } else {
          console.log(`${colors.dim}  ${relativePath} (exists, use --force to overwrite)${colors.reset}`);
          skipped++;
        }
      }

      console.log(`\n${colors.cyan}Summary:${colors.reset}`);
      console.log(`  ${colors.green}Copied: ${copied}${colors.reset}`);
      console.log(`  ${colors.yellow}Updated: ${updated}${colors.reset}`);
      console.log(`  ${colors.dim}Skipped: ${skipped}${colors.reset}`);

      if (preview) {
        console.log(`\n${colors.blue}Run without --preview to apply changes${colors.reset}`);
      }

    } catch (err) {
      console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    }
  }

  async validate(entityType) {
    if (!entityType) {
      console.log(`${colors.red}Entity type required${colors.reset}`);
      console.log(`${colors.dim}Usage: devkit data validate <type>${colors.reset}`);
      console.log(`${colors.dim}Example: devkit data validate creatures${colors.reset}`);
      return;
    }

    console.log(`${colors.blue}Validating ${entityType} presets...${colors.reset}\n`);

    try {
      const presetPath = path.join(PLUGIN_ROOT, 'Presets', this.capitalizeFirst(entityType));
      const files = await this.getAllMarkdownFiles(presetPath);

      if (files.length === 0) {
        console.log(`${colors.yellow}No preset files found${colors.reset}`);
        return;
      }

      console.log(`${colors.dim}Validating ${files.length} files...${colors.reset}\n`);

      let errors = 0;
      let warnings = 0;
      const issues = [];

      // Define validation rules by entity type
      const rules = this.getValidationRules(entityType);

      for (const file of files) {
        const relativePath = path.relative(presetPath, file);
        const data = await this.parseMarkdownFile(file);

        // Check required fields
        for (const field of rules.required) {
          if (!(field in data) || data[field] === null || data[field] === undefined) {
            issues.push({
              file: relativePath,
              severity: 'error',
              message: `Missing required field: ${field}`
            });
            errors++;
          }
        }

        // Check field types
        for (const [field, expectedType] of Object.entries(rules.types || {})) {
          if (field in data && data[field] !== null) {
            const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
            if (actualType !== expectedType) {
              issues.push({
                file: relativePath,
                severity: 'warning',
                message: `Field '${field}' should be ${expectedType}, got ${actualType}`
              });
              warnings++;
            }
          }
        }

        // Check for old format indicators
        if (rules.oldFormatChecks) {
          for (const [indicator, message] of Object.entries(rules.oldFormatChecks)) {
            const content = await fs.readFile(file, 'utf-8');
            if (content.includes(indicator)) {
              issues.push({
                file: relativePath,
                severity: 'warning',
                message
              });
              warnings++;
            }
          }
        }

        // Custom validations
        if (rules.custom) {
          for (const validator of rules.custom) {
            const result = validator(data, relativePath);
            if (result) {
              issues.push(result);
              if (result.severity === 'error') errors++;
              else warnings++;
            }
          }
        }
      }

      // Display results
      if (issues.length === 0) {
        console.log(`${colors.green}✓ All ${files.length} files passed validation${colors.reset}\n`);
      } else {
        console.log(`${colors.yellow}Found ${errors} error(s) and ${warnings} warning(s):${colors.reset}\n`);

        // Group by file
        const byFile = {};
        issues.forEach(issue => {
          if (!byFile[issue.file]) {
            byFile[issue.file] = [];
          }
          byFile[issue.file].push(issue);
        });

        for (const [file, fileIssues] of Object.entries(byFile)) {
          console.log(`${colors.cyan}${file}${colors.reset}`);
          fileIssues.forEach(issue => {
            const color = issue.severity === 'error' ? colors.red : colors.yellow;
            const mark = issue.severity === 'error' ? '✗' : '⚠';
            console.log(`  ${color}${mark} ${issue.message}${colors.reset}`);
          });
          console.log();
        }

        // Summary
        console.log(`${colors.cyan}Summary:${colors.reset}`);
        console.log(`  Files checked: ${files.length}`);
        console.log(`  ${colors.red}Errors: ${errors}${colors.reset}`);
        console.log(`  ${colors.yellow}Warnings: ${warnings}${colors.reset}`);
      }

    } catch (err) {
      console.error(`${colors.red}Validation failed: ${err.message}${colors.reset}`);
    }
  }

  getValidationRules(entityType) {
    const commonRules = {
      required: ['smType', 'name'],
      types: {
        smType: 'string',
        name: 'string'
      }
    };

    switch (entityType.toLowerCase()) {
      case 'creatures':
        return {
          ...commonRules,
          required: [...commonRules.required, 'size', 'type', 'ac', 'hp', 'abilities', 'pb'],
          types: {
            ...commonRules.types,
            size: 'string',
            type: 'string',
            ac: 'string',
            hp: 'string',
            abilities: 'array',
            pb: 'string'
          },
          oldFormatChecks: {
            'ability:': 'Using old format (ability:) instead of new format (key:)'
          },
          custom: [
            (data, file) => {
              // Check abilities format
              if (Array.isArray(data.abilities)) {
                for (const ability of data.abilities) {
                  if (typeof ability === 'object' && 'ability' in ability && !('key' in ability)) {
                    return {
                      file,
                      severity: 'error',
                      message: 'Abilities use old format with "ability" key instead of "key"'
                    };
                  }
                }
              }
              return null;
            }
          ]
        };

      case 'spells':
        return {
          ...commonRules,
          required: [...commonRules.required, 'level', 'school'],
          types: {
            ...commonRules.types,
            level: 'number',
            school: 'string'
          }
        };

      case 'items':
      case 'equipment':
        return {
          ...commonRules,
          required: [...commonRules.required, 'rarity'],
          types: {
            ...commonRules.types,
            rarity: 'string'
          }
        };

      default:
        return commonRules;
    }
  }

  // Helper methods
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async findFile(dir, name) {
    try {
      const files = await fs.readdir(dir, { recursive: true, withFileTypes: true });
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const fileName = file.name.replace('.md', '').toLowerCase();
          if (fileName === normalizedName || fileName === name.toLowerCase()) {
            return path.join(file.path || dir, file.name);
          }
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async getAllMarkdownFiles(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.getAllMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Directory doesn't exist
    }
    return files;
  }

  async parseMarkdownFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract frontmatter (YAML between --- markers)
    if (lines[0] !== '---') return {};

    let i = 1;
    let yamlContent = '';
    while (i < lines.length && lines[i] !== '---') {
      yamlContent += lines[i] + '\n';
      i++;
    }

    // Simple YAML parsing (good enough for inspection)
    const data = {};
    const yamlLines = yamlContent.split('\n');
    let currentKey = null;
    let currentArray = null;
    let indent = 0;

    for (const line of yamlLines) {
      if (!line.trim()) continue;

      const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
      if (match) {
        const lineIndent = match[1].length;
        const key = match[2].trim();
        const value = match[3].trim();

        if (lineIndent === 0) {
          currentKey = key;
          currentArray = null;
          if (value) {
            data[key] = value.replace(/^["']|["']$/g, '');
          } else {
            data[key] = null;
          }
        } else if (currentKey) {
          if (data[currentKey] === null) {
            data[currentKey] = {};
          }
          if (typeof data[currentKey] === 'object' && !Array.isArray(data[currentKey])) {
            data[currentKey][key] = value.replace(/^["']|["']$/g, '');
          }
        }
      } else if (line.trim().startsWith('-')) {
        if (currentKey && data[currentKey] === null) {
          data[currentKey] = [];
          currentArray = data[currentKey];
        }
        if (currentArray) {
          const value = line.trim().substring(1).trim();
          currentArray.push(value.replace(/^["']|["']$/g, ''));
        }
      }
    }

    return data;
  }

  compareData(preset, vault, path = '') {
    const diffs = [];

    // Compare top-level keys
    const allKeys = new Set([...Object.keys(preset), ...Object.keys(vault)]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in preset)) {
        diffs.push({ path: currentPath, preset: undefined, vault: vault[key] });
      } else if (!(key in vault)) {
        diffs.push({ path: currentPath, preset: preset[key], vault: undefined });
      } else if (typeof preset[key] !== typeof vault[key]) {
        diffs.push({ path: currentPath, preset: preset[key], vault: vault[key] });
      } else if (typeof preset[key] === 'object' && preset[key] !== null) {
        // Recursive comparison for objects/arrays
        const subDiffs = this.compareData(preset[key], vault[key], currentPath);
        diffs.push(...subDiffs);
      } else if (preset[key] !== vault[key]) {
        diffs.push({ path: currentPath, preset: preset[key], vault: vault[key] });
      }
    }

    return diffs;
  }

  get help() {
    return `
Usage: devkit data <command> [options]

Manage preset and vault data

Commands:
  inspect <type> <name>   Show preset vs vault comparison with diff
  sync <type> [options]   Import/update vault files from presets
  validate [type]         Validate preset data against schemas

Options:
  --preview, --dry-run    Preview changes without applying
  --force                 Overwrite existing files

Examples:
  devkit data inspect creature aboleth     # Compare preset and vault
  devkit data sync creatures --preview     # Preview import
  devkit data sync creatures --force       # Force update all files
  devkit data validate creatures           # Validate creature presets
`;
  }
}

class StateCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    if (!args || args.length === 0) {
      return await this.list([]);
    }

    if (args.includes('--help') || args.includes('-h')) {
      console.log(this.help);
      return;
    }

    const [first, ...rest] = args;
    const hasSubcommand = first && !first.startsWith('-');
    const command = hasSubcommand ? first : 'list';
    const commandArgs = hasSubcommand ? rest : args;

    switch (command) {
      case 'list':
        return await this.list(commandArgs);
      case 'inspect':
        return await this.inspect(commandArgs);
      default:
        console.log(`${colors.red}Unknown state command: ${command}${colors.reset}`);
        console.log(`${colors.dim}Run 'devkit state --help' for usage${colors.reset}`);
    }
  }

  parseFlags(args) {
    const flags = {
      json: false,
    };
    const rest = [];

    for (const arg of args) {
      if (arg === '--json') {
        flags.json = true;
      } else {
        rest.push(arg);
      }
    }

    return { ...flags, rest };
  }

  async list(args) {
    const { json, rest } = this.parseFlags(args);

    if (rest.length > 0) {
      console.log(`${colors.yellow}Ignoring unexpected arguments: ${rest.join(', ')}${colors.reset}`);
    }

    try {
      const result = await this.client.execute('state-list', []);
      const payload = result?.data ?? result ?? {};
      if (json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      const stores = payload.stores || [];
      const stats = payload.stats || {};
      const eventBus = payload.eventBus || {};

      console.log(`${colors.cyan}Registered Stores:${colors.reset}`);
      if (stores.length === 0) {
        console.log(`  ${colors.dim}(no stores registered)${colors.reset}`);
      }

      for (const store of stores) {
        this.printStoreSummary(store);
      }

      console.log(`\n${colors.cyan}Stats:${colors.reset}`);
      console.log(`  Total: ${stats.totalStores ?? stores.length}`);
      console.log(`  Persistent: ${stats.persistentStores ?? 0}`);
      console.log(`  Writable: ${stats.writableStores ?? 0}`);
      console.log(`  Readable: ${stats.readableStores ?? 0}`);

      if (eventBus && typeof eventBus.totalSubscriptions === 'number') {
        console.log(`\n${colors.cyan}Event Bus:${colors.reset}`);
        console.log(`  Subscriptions: ${eventBus.totalSubscriptions}`);
        if (Array.isArray(eventBus.topics)) {
          for (const topic of eventBus.topics) {
            if (!topic || topic.subscriptions === 0) continue;
            console.log(`    ${topic.topic}: ${topic.subscriptions}`);
          }
        }
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  async inspect(args) {
    const { json, rest } = this.parseFlags(args);
    const [storeName] = rest;

    if (!storeName) {
      console.log(`${colors.red}Store name required${colors.reset}`);
      console.log(`${colors.dim}Usage: devkit state inspect <name> [--json]${colors.reset}`);
      console.log(`${colors.dim}Example: devkit state inspect encounter-xp${colors.reset}`);
      return;
    }

    try {
      const result = await this.client.execute('state-inspect', [storeName]);
      const payload = result?.data ?? result ?? {};

      if (json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      if (!payload.found) {
        console.log(`${colors.yellow}Store "${storeName}" not found${colors.reset}`);
        return;
      }

      console.log(`${colors.cyan}Store: ${colors.reset}${colors.green}${payload.name}${colors.reset}`);
      console.log(`  Type: ${payload.type} (${(payload.capabilities || []).join(', ') || 'readable'})`);
      console.log(`  Writable: ${payload.isWritable ? 'Yes' : 'No'}`);
      console.log(`  Persistent: ${payload.isPersistent ? 'Yes' : 'No'}`);
      if (payload.isPersistent) {
        if (typeof payload.isDirty === 'boolean') {
          console.log(`  Dirty: ${payload.isDirty ? `${colors.red}Yes${colors.reset}` : 'No'}`);
        }
        if (payload.storageKey) {
          console.log(`  Storage Key: ${payload.storageKey}`);
        }
      }
      if (payload.valueType) {
        console.log(`  Value Type: ${payload.valueType}`);
      }
      if (payload.valueError) {
        console.log(`  Value Error: ${colors.red}${payload.valueError}${colors.reset}`);
      } else if (payload.valuePreview) {
        console.log(`  Value Preview: ${colors.dim}${this.truncate(payload.valuePreview, 160)}${colors.reset}`);
      }

      if (payload.metadata) {
        this.printJson('Metadata', payload.metadata);
      }

      if (!payload.valueError && typeof payload.value !== 'undefined') {
        this.printJson('Value', payload.value);
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  printStoreSummary(store) {
    console.log(`\n${colors.green}${store.name}${colors.reset}`);
    console.log(`  Type: ${store.type} (${(store.capabilities || []).join(', ') || 'readable'})`);
    console.log(`  Writable: ${store.isWritable ? 'Yes' : 'No'}`);
    console.log(`  Persistent: ${store.isPersistent ? 'Yes' : 'No'}`);
    if (store.isPersistent) {
      if (typeof store.isDirty === 'boolean') {
        console.log(`  Dirty: ${store.isDirty ? `${colors.red}Yes${colors.reset}` : 'No'}`);
      }
      if (store.storageKey) {
        console.log(`  Storage Key: ${store.storageKey}`);
      }
    }
    if (store.valueError) {
      console.log(`  Value Error: ${colors.red}${store.valueError}${colors.reset}`);
    } else if (store.valuePreview) {
      console.log(`  Value Preview: ${colors.dim}${this.truncate(store.valuePreview, 120)}${colors.reset}`);
    }
  }

  printJson(label, value) {
    try {
      const json = JSON.stringify(value, null, 2);
      console.log(`  ${label}:`);
      json.split('\n').forEach(line => {
        console.log(`    ${colors.dim}${line}${colors.reset}`);
      });
    } catch (err) {
      console.log(`  ${label}: ${colors.red}[unserializable: ${err.message}]${colors.reset}`);
    }
  }

  truncate(text, length) {
    if (!text) return text;
    if (text.length <= length) return text;
    return `${text.slice(0, length - 1)}…`;
  }

  handleError(err) {
    const message = err?.message || String(err);
    const code = err?.code;
    if (
      message.includes('not running') ||
      message.includes('ENOENT') ||
      message.includes('ECONNREFUSED') ||
      message.includes('EPERM') ||
      code === 'ENOENT' ||
      code === 'ECONNREFUSED' ||
      code === 'EPERM'
    ) {
      console.log(`${colors.red}Plugin not running${colors.reset}`);
      console.log(`${colors.dim}Make sure Obsidian is open with Salt Marcher loaded${colors.reset}`);
    } else {
      console.error(`${colors.red}Error: ${message}${colors.reset}`);
      if (process.env.DEBUG && err?.stack) {
        console.error(err.stack);
      }
    }
  }

  get help() {
    return `
Usage: devkit state <command> [options]

Inspect stores managed by the state layer

Commands:
  list [--json]            List registered stores with metadata
  inspect <name> [--json]  Inspect a single store and dump its value

Options:
  --json                   Output raw JSON result

Examples:
  devkit state list
  devkit state list --json
  devkit state inspect party
  devkit state inspect encounter-xp --json
`;
  }
}

class LintCommand {
  async handle(args) {
    const [subcommand] = args;

    if (!subcommand || subcommand === 'help') {
      console.log(`${colors.yellow}Usage: devkit lint tags${colors.reset}`);
      return;
    }

    switch (subcommand) {
      case 'tags':
        return await this.lintTags();
      default:
        console.log(`${colors.red}Unknown lint command: ${subcommand}${colors.reset}`);
        console.log(`${colors.dim}Available: tags${colors.reset}`);
    }
  }

  async lintTags() {
    const docPath = path.join(PLUGIN_ROOT, 'docs', 'TAGS.md');
    let docContent = '';
    try {
      docContent = await fs.readFile(docPath, 'utf8');
    } catch (err) {
      console.log(`${colors.red}✗ docs/TAGS.md nicht gefunden (${err.message})${colors.reset}`);
      process.exitCode = 1;
      return;
    }

    const allowed = new Set();
    for (const line of docContent.split('\n')) {
      const match = line.match(/^\|\s*([^|]+?)\s*\|/);
      if (!match) continue;
      const tag = match[1].trim();
      if (!tag || tag.toLowerCase() === 'tag' || /^-+$/.test(tag)) continue;
      allowed.add(tag.toLowerCase());
    }

    if (!allowed.size) {
      console.log(`${colors.yellow}⚠ Keine Tags in docs/TAGS.md gefunden – übersprungen${colors.reset}`);
      return;
    }

    const fields = ['typeTags', 'tags', 'categories', 'category', 'schools', 'school', 'terrainTags', 'regionTags'];
    const roots = [path.join(PLUGIN_ROOT, 'Presets')];
    const issues = [];

    for (const root of roots) {
      await this.scanDirectory(root, fields, allowed, issues);
    }

    if (!issues.length) {
      console.log(`${colors.green}✓ Keine unbekannten Tags gefunden${colors.reset}`);
      return;
    }

    console.log(`${colors.red}✗ Unbekannte Tags gefunden:${colors.reset}`);
    for (const issue of issues) {
      console.log(`  ${colors.yellow}${issue.tag}${colors.reset} in ${colors.cyan}${path.relative(PLUGIN_ROOT, issue.file)}${colors.reset} (${issue.field})`);
    }
    process.exitCode = 1;
  }

  async scanDirectory(dir, fields, allowed, issues) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.scanDirectory(full, fields, allowed, issues);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          await this.inspectFile(full, fields, allowed, issues);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(`${colors.yellow}⚠ Konnte Verzeichnis nicht lesen: ${dir} (${err.message})${colors.reset}`);
      }
    }
  }

  async inspectFile(file, fields, allowed, issues) {
    let content;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch (err) {
      console.log(`${colors.yellow}⚠ Konnte Datei nicht lesen: ${file} (${err.message})${colors.reset}`);
      return;
    }

    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return;

    let data;
    try {
      data = yaml.load(match[1]);
    } catch (err) {
      console.log(`${colors.yellow}⚠ Ungültiges Frontmatter: ${file} (${err.message})${colors.reset}`);
      return;
    }

    if (!data || typeof data !== 'object') return;

    for (const field of fields) {
      if (!(field in data)) continue;
      const raw = data[field];
      if (Array.isArray(raw)) {
        for (const value of raw) {
          const tag = this.normalizeTag(value);
          if (tag && !allowed.has(tag)) {
            issues.push({ file, field, tag: value.value ?? value });
          }
        }
      } else if (raw && typeof raw === 'object' && Array.isArray(raw.value)) {
        for (const value of raw.value) {
          const tag = this.normalizeTag(value);
          if (tag && !allowed.has(tag)) {
            issues.push({ file, field, tag: value.value ?? value });
          }
        }
      } else {
        const tag = this.normalizeTag(raw);
        if (tag && !allowed.has(tag)) {
          issues.push({ file, field, tag: raw });
        }
      }
    }
  }

  normalizeTag(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'object' && typeof value.value === 'string') return value.value.trim().toLowerCase();
    return null;
  }
}

class SchemaCommand {
  async handle(args) {
    const [subcommand] = args;

    if (!subcommand || subcommand === 'help') {
      console.log(`${colors.yellow}Usage: devkit schema validate${colors.reset}`);
      return;
    }

    switch (subcommand) {
      case 'validate':
        return await this.validate();
      default:
        console.log(`${colors.red}Unknown schema command: ${subcommand}${colors.reset}`);
        console.log(`${colors.dim}Available: validate${colors.reset}`);
    }
  }

  async validate() {
    const schemaFile = path.join(PLUGIN_ROOT, 'src/domain/schemas.ts');
    let source;
    try {
      source = await fs.readFile(schemaFile, 'utf8');
    } catch (err) {
      console.log(`${colors.red}✗ src/domain/schemas.ts nicht gefunden (${err.message})${colors.reset}`);
      process.exitCode = 1;
      return;
    }

    const ts = await import('typescript');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2020,
        target: ts.ScriptTarget.ES2020
      }
    });

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
    const schemaModule = await import(moduleUrl);
    const definitions = schemaModule.SCHEMA_DEFINITIONS ?? [];

    let inspected = 0;
    let failures = 0;

    for (const def of definitions) {
      const result = await this.validateDefinition(def);
      inspected += result.inspected;
      failures += result.errors;
    }

    if (failures === 0) {
      console.log(`${colors.green}✓ Schema validation succeeded for ${inspected} document(s).${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Schema validation failed: ${failures} error(s).${colors.reset}`);
      process.exitCode = 1;
    }
  }

  async validateDefinition(def) {
    let errors = 0;
    let inspected = 0;

    for (const location of def.locations ?? []) {
      const root = path.resolve(PLUGIN_ROOT, location.root ?? '');
      if (!(await this.pathExists(root))) {
        if (!location.optional) {
          console.log(`${colors.yellow}⚠ ${def.name}: Pfad nicht gefunden (${location.root})${colors.reset}`);
        }
        continue;
      }

      const files = await this.collectMarkdownFiles(root);
      for (const file of files) {
        const doc = await this.readFrontmatter(file);
        inspected += 1;
        const issues = def.validate(doc) ?? [];
        if (!issues.length) continue;
        errors += issues.length;
        for (const issue of issues) {
          console.log(`${colors.red}${def.name}: ${path.relative(PLUGIN_ROOT, file)}${colors.reset}`);
          console.log(`  ${colors.yellow}${issue.field}${colors.reset} → ${issue.message}`);
        }
      }
    }

    return { errors, inspected };
  }

  async collectMarkdownFiles(root) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.collectMarkdownFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(full);
      }
    }
    return files;
  }

  async readFrontmatter(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: raw, filePath };
    }

    const [, yamlBlock, body] = match;
    let frontmatter = {};
    try {
      const parsed = yaml.load(yamlBlock);
      if (parsed && typeof parsed === 'object') {
        frontmatter = parsed;
      }
    } catch (err) {
      console.log(`${colors.yellow}⚠ Ungültiges Frontmatter in ${path.relative(PLUGIN_ROOT, filePath)}: ${err.message}${colors.reset}`);
    }
    return { frontmatter, body: body ?? '', filePath };
  }

  async pathExists(target) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }
}

class DoctorCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  DevKit Health Check${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    let issues = 0;

    // 1. Check IPC Server
    console.log(`${colors.blue}1. Checking IPC Server...${colors.reset}`);
    try {
      await this.client.execute('ping', [], 2000);
      console.log(`   ${colors.green}✓ IPC server is running${colors.reset}`);
    } catch (err) {
      console.log(`   ${colors.red}✗ IPC server not responding${colors.reset}`);
      console.log(`   ${colors.dim}  Is Obsidian running with Salt Marcher loaded?${colors.reset}`);
      issues++;
    }

    // 2. Check Build Script Paths
    console.log(`\n${colors.blue}2. Checking Build Script Paths...${colors.reset}`);
    const buildScriptPath = path.join(PLUGIN_ROOT, 'generate-preset-data.mjs');
    try {
      const scriptContent = await fs.readFile(buildScriptPath, 'utf-8');

      // Extract paths from script
      const presetsDirMatch = scriptContent.match(/CREATURES_PRESETS_DIR\s*=\s*path\.join\([^)]+\)/);
      const outputFileMatch = scriptContent.match(/OUTPUT_FILE\s*=\s*path\.join\([^)]+\)/);

      // Check if paths exist
      const presetsDir = path.join(PLUGIN_ROOT, 'Presets');
      const outputFile = path.join(PLUGIN_ROOT, 'Presets/lib/preset-data.ts');

      const presetsDirExists = await fs.access(presetsDir).then(() => true).catch(() => false);
      const outputDirExists = await fs.access(path.dirname(outputFile)).then(() => true).catch(() => false);

      if (presetsDirExists) {
        console.log(`   ${colors.green}✓ Presets directory exists${colors.reset}`);
      } else {
        console.log(`   ${colors.red}✗ Presets directory not found${colors.reset}`);
        issues++;
      }

      if (outputDirExists) {
        console.log(`   ${colors.green}✓ Output directory exists${colors.reset}`);
      } else {
        console.log(`   ${colors.yellow}⚠ Output directory not found (will be created on build)${colors.reset}`);
      }
    } catch (err) {
      console.log(`   ${colors.red}✗ Build script not found${colors.reset}`);
      issues++;
    }

    // 3. Check Parser Script Paths
    console.log(`\n${colors.blue}3. Checking Parser Script Paths...${colors.reset}`);
    const parserPath = path.join(PLUGIN_ROOT, 'devkit/utilities/conversions/convert-references.mjs');
    try {
      await fs.access(parserPath);
      console.log(`   ${colors.green}✓ Parser script exists${colors.reset}`);

      // Check reference directory
      const referencesDir = path.join(PLUGIN_ROOT, 'References/rulebooks/Statblocks/Creatures');
      const refExists = await fs.access(referencesDir).then(() => true).catch(() => false);

      if (refExists) {
        console.log(`   ${colors.green}✓ References directory exists${colors.reset}`);
      } else {
        console.log(`   ${colors.yellow}⚠ References directory not found${colors.reset}`);
      }
    } catch (err) {
      console.log(`   ${colors.red}✗ Parser script not found${colors.reset}`);
      issues++;
    }

    // 4. Check Preset Data Format
    console.log(`\n${colors.blue}4. Checking Preset Data Format...${colors.reset}`);
    try {
      const presetsDir = path.join(PLUGIN_ROOT, 'Presets/Creatures');
      const files = await fs.readdir(presetsDir, { recursive: true });
      const mdFiles = files.filter(f => f.endsWith && f.endsWith('.md'));

      if (mdFiles.length > 0) {
        // Sample a few files
        let oldFormat = 0;
        let newFormat = 0;
        const sampleSize = Math.min(5, mdFiles.length);

        for (let i = 0; i < sampleSize; i++) {
          const file = path.join(presetsDir, mdFiles[i]);
          try {
            const content = await fs.readFile(file, 'utf-8');
            if (content.includes('ability:')) {
              oldFormat++;
            } else if (content.includes('key:')) {
              newFormat++;
            }
          } catch (err) {
            // Skip
          }
        }

        console.log(`   ${colors.dim}Sampled ${sampleSize} files:${colors.reset}`);
        if (newFormat > 0) {
          console.log(`   ${colors.green}✓ ${newFormat} files use new format (key:)${colors.reset}`);
        }
        if (oldFormat > 0) {
          console.log(`   ${colors.yellow}⚠ ${oldFormat} files use old format (ability:)${colors.reset}`);
          console.log(`   ${colors.dim}  Run: node devkit/utilities/conversions/convert-references.mjs${colors.reset}`);
        }
      }
    } catch (err) {
      console.log(`   ${colors.yellow}⚠ Could not check preset format${colors.reset}`);
    }

    // 5. Check Vault Data
    console.log(`\n${colors.blue}5. Checking Vault Data...${colors.reset}`);
    try {
      const vaultDir = path.join(VAULT_ROOT, 'SaltMarcher/Creatures');
      const vaultExists = await fs.access(vaultDir).then(() => true).catch(() => false);

      if (vaultExists) {
        const files = await fs.readdir(vaultDir, { recursive: true });
        const mdFiles = files.filter(f => f.endsWith && f.endsWith('.md'));
        console.log(`   ${colors.green}✓ Found ${mdFiles.length} creature files in vault${colors.reset}`);
      } else {
        console.log(`   ${colors.yellow}⚠ Vault creatures directory not found${colors.reset}`);
      }
    } catch (err) {
      console.log(`   ${colors.yellow}⚠ Could not access vault data${colors.reset}`);
    }

    // Summary
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    if (issues === 0) {
      console.log(`${colors.green}✓ All checks passed!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}Found ${issues} issue(s)${colors.reset}\n`);
    }
  }

  get help() {
    return `
Usage: devkit doctor

Run health checks on DevKit setup

Checks:
  - IPC server connection
  - Build script path configuration
  - Parser script availability
  - Preset data format
  - Vault data accessibility

Example:
  devkit doctor    # Run all health checks
`;
  }
}

class PluginCommand {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    const [subcommand] = args;

    if (!subcommand || subcommand === 'reload') {
      return await this.reload();
    } else if (subcommand === 'watch') {
      return await this.watchMode();
    } else {
      console.log(`${colors.red}Unknown plugin command: ${subcommand}${colors.reset}`);
      console.log(`${colors.dim}Available: reload, watch${colors.reset}`);
      process.exit(1);
    }
  }

  async reload() {
    try {
      await this.client.execute('reload-plugin');
      console.log(`${colors.green}✓ Plugin reloaded${colors.reset}`);
    } catch (err) {
      throw err;
    }
  }

  async watchMode() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  Hot Reload Mode${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    console.log(`${colors.blue}Watching: ${colors.reset}main.js`);
    console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);

    const mainJsPath = path.join(PLUGIN_ROOT, 'main.js');
    let reloading = false;

    // Check if file exists
    try {
      await fs.access(mainJsPath);
    } catch (err) {
      console.error(`${colors.red}Error: main.js not found${colors.reset}`);
      console.error(`${colors.dim}Run 'npm run build' first${colors.reset}`);
      process.exit(1);
    }

    const watcher = watch(mainJsPath, async (event, filename) => {
      if (reloading) return;
      reloading = true;

      try {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${colors.yellow}[${timestamp}] File changed, reloading...${colors.reset}`);

        await this.client.execute('reload-plugin');
        console.log(`${colors.green}[${timestamp}] ✓ Plugin reloaded${colors.reset}\n`);
      } catch (err) {
        console.error(`${colors.red}Reload failed: ${err.message}${colors.reset}\n`);
      } finally {
        reloading = false;
      }
    });

    // Handle cleanup
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}Stopping watch mode...${colors.reset}`);
      watcher.close();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }

  get help() {
    return `
Usage: devkit reload [command]

Reload the plugin

Commands:
  (none)      Reload plugin once
  watch       Watch main.js and auto-reload on changes

Examples:
  devkit reload         # Reload plugin once
  devkit reload watch   # Start hot reload mode
`;
  }
}

class DevKitCLI {
  constructor() {
    this.client = new IPCClient();
    this.commands = {
      test: new TestCommand(this.client),
      debug: new DebugCommand(this.client),
      ui: new UICommand(this.client),
      plugin: new PluginCommand(this.client),
      migrate: new MigrateCommand(this.client),
      workflow: new WorkflowCommand(this.client),
      backup: new BackupCommand(),
      generate: new GenerateCommand(),
      hooks: new HooksCommand(),
      lint: new LintCommand(),
      schema: new SchemaCommand(),
      data: new DataCommand(this.client),
      state: new StateCommand(this.client),
      doctor: new DoctorCommand(this.client),
      // Backwards compatibility alias
      reload: new PluginCommand(this.client)
    };
  }

  showHelp() {
    console.log(`
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.bright}Salt Marcher DevKit${colors.reset}
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.yellow}Usage:${colors.reset} devkit [command] [options]

${colors.yellow}Commands:${colors.reset}

  ${colors.green}Core Commands:${colors.reset}
    test          Run tests (unit, integration, contracts)
    debug         Manage debug logging
    ui            Open and validate UI components
    plugin        Plugin control (reload, watch)
    migrate       Run data migrations
    data          Manage preset and vault data
    state         Inspect global state stores
    doctor        Run DevKit health checks

  ${colors.green}Development Tools:${colors.reset}
    workflow      Run automated workflows
    backup        Backup and restore vault data
    generate      Generate code from templates
    hooks         Manage Git pre-commit hooks
    lint          Validate project metadata (e.g. tags)
    schema        Validate structured document schemas

  ${colors.green}Utilities:${colors.reset}
    reload        Reload plugin (use 'reload watch' for auto-reload)
    logs [n]      View recent plugin logs (default: 100)
    validate      Validate UI fields

${colors.yellow}Options:${colors.reset}
    --help, -h    Show this help message
    --verbose     Show detailed output
    --dry-run     Preview changes without executing
    --force       Skip confirmations

${colors.yellow}Examples:${colors.reset}
    devkit                               # Start interactive REPL
    devkit doctor                        # Check DevKit health
    devkit reload watch                  # Auto-reload on file changes
    devkit test                          # Run all tests
    devkit data inspect creature aboleth # Compare preset vs vault
    devkit data sync creatures --force   # Update vault from presets
    devkit debug field-state saveMod     # Inspect field state
    devkit state list                    # Show registered stores
    devkit ui open creature Dragon       # Open creature editor

${colors.yellow}Documentation:${colors.reset}
    Quick Reference:  devkit/QUICK_REFERENCE.md
    Features:         devkit/FEATURES_V3.md
    Full Docs:        devkit/docs/

For command-specific help, run: devkit [command] --help
`);
  }

  async run() {
    const [,, command, ...args] = process.argv;

    // If no command, start REPL
    if (!command) {
      const repl = new DevKitREPL(this.client);
      await repl.start();
      return;
    }

    // Handle help
    if (command === 'help' || command === '--help' || command === '-h') {
      this.showHelp();
      process.exit(0);
    }

    // Handle utility shortcuts (map to structured commands)
    const shortcuts = {
      'reload': ['reload-plugin'],
      'logs': ['get-logs', args[0] || '100'],
      'validate': ['validate-ui', args[0] || 'all']
    };

    if (shortcuts[command]) {
      try {
        const [ipcCommand, ...ipcArgs] = shortcuts[command];
        const result = await this.client.execute(ipcCommand, ipcArgs);

        if (command === 'reload') {
          console.log(`${colors.green}✓ Plugin reloaded${colors.reset}`);
        } else if (command === 'logs' && result.logs) {
          console.log(result.logs);
        } else if (command === 'validate') {
          if (result.success) {
            console.log(`${colors.green}✓ All validations passed${colors.reset}`);
          } else {
            console.log(`${colors.red}✗ Validation failed${colors.reset}`);
            if (result.errors) {
              result.errors.forEach(err => console.log(`  - ${err}`));
            }
          }
        } else if (result.data) {
          console.log(result.data);
        }

        process.exit(0);
      } catch (err) {
        console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
        process.exit(1);
      }
    }

    // Handle direct IPC commands (with hyphens)
    if (command.includes('-')) {
      try {
        const result = await this.client.execute(command, args);
        if (result.data) {
          console.log(result.data);
        }
        process.exit(0);
      } catch (err) {
        console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
        process.exit(1);
      }
    }

    // Handle structured commands
    const handler = this.commands[command];
    if (!handler) {
      console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
      console.log(`${colors.dim}Run 'devkit --help' for available commands${colors.reset}`);
      process.exit(1);
    }

    try {
      await handler.handle(args);
      process.exit(0);
    } catch (err) {
      console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      process.exit(1);
    }
  }
}

// Run CLI
const cli = new DevKitCLI();
cli.run().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
