#!/usr/bin/env node
// Interactive mode for DevKit
// Provides prompts and REPL for better UX

import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVKIT_ROOT = path.resolve(__dirname, '../..');
const PLUGIN_ROOT = path.dirname(DEVKIT_ROOT);

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Interactive prompt helper
 */
export class InteractivePrompt {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
  }

  /**
   * Ask a question with optional autocomplete
   */
  async ask(question, options = {}) {
    const { defaultValue, choices, validate } = options;

    return new Promise((resolve) => {
      let promptText = `${colors.cyan}${question}${colors.reset}`;

      if (choices && choices.length > 0) {
        promptText += `\n${colors.dim}Choices: ${choices.join(', ')}${colors.reset}`;
      }

      if (defaultValue) {
        promptText += `\n${colors.dim}(default: ${defaultValue})${colors.reset}`;
      }

      promptText += '\n> ';

      this.rl.question(promptText, (answer) => {
        const value = answer.trim() || defaultValue;

        // Validate if validator provided
        if (validate) {
          const validation = validate(value);
          if (validation !== true) {
            console.log(`${colors.red}${validation}${colors.reset}`);
            resolve(this.ask(question, options));
            return;
          }
        }

        resolve(value);
      });
    });
  }

  /**
   * Confirm action (yes/no)
   */
  async confirm(question, defaultYes = true) {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await this.ask(`${question} ${suffix}`, { defaultValue: defaultYes ? 'y' : 'n' });
    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Select from list
   */
  async select(question, choices) {
    console.log(`${colors.cyan}${question}${colors.reset}`);

    choices.forEach((choice, i) => {
      console.log(`  ${colors.dim}${i + 1}.${colors.reset} ${choice}`);
    });

    const answer = await this.ask('Enter number', {
      validate: (val) => {
        const num = parseInt(val);
        if (isNaN(num) || num < 1 || num > choices.length) {
          return `Please enter a number between 1 and ${choices.length}`;
        }
        return true;
      }
    });

    return choices[parseInt(answer) - 1];
  }

  /**
   * Multi-select from list
   */
  async multiSelect(question, choices) {
    console.log(`${colors.cyan}${question}${colors.reset}`);
    console.log(`${colors.dim}Enter numbers separated by commas (e.g., 1,3,5)${colors.reset}`);

    choices.forEach((choice, i) => {
      console.log(`  ${colors.dim}${i + 1}.${colors.reset} ${choice}`);
    });

    const answer = await this.ask('Enter numbers', {
      validate: (val) => {
        const nums = val.split(',').map(n => parseInt(n.trim()));
        const invalid = nums.some(n => isNaN(n) || n < 1 || n > choices.length);
        if (invalid) {
          return `Please enter valid numbers between 1 and ${choices.length}`;
        }
        return true;
      }
    });

    return answer.split(',').map(n => choices[parseInt(n.trim()) - 1]);
  }

  /**
   * Get entity name with autocomplete suggestions
   */
  async getEntityName(entityType) {
    // Load available entities from Presets
    const presetsDir = path.join(PLUGIN_ROOT, 'Presets', entityType.charAt(0).toUpperCase() + entityType.slice(1) + 's');

    let entities = [];
    try {
      const files = await fs.readdir(presetsDir);
      entities = files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
    } catch (err) {
      // Directory doesn't exist, no suggestions
    }

    const name = await this.ask(`Enter ${entityType} name (or leave empty for new)`, {
      choices: entities.slice(0, 10), // Show first 10 as examples
      defaultValue: ''
    });

    return name || null;
  }

  close() {
    this.rl.close();
  }
}

/**
 * REPL (Read-Eval-Print Loop) for power users
 */
export class DevKitREPL {
  constructor(client) {
    this.client = client;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.blue}devkit>${colors.reset} `,
      terminal: true
    });

    this.history = [];
    this.historyIndex = -1;
  }

  async start() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}DevKit Interactive Mode${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.dim}Type 'help' for commands, 'exit' to quit${colors.reset}\n`);

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) {
        this.rl.prompt();
        return;
      }

      // Add to history
      this.history.push(input);
      this.historyIndex = this.history.length;

      // Parse command
      const [command, ...args] = input.split(/\s+/);

      try {
        await this.handleCommand(command, args);
      } catch (error) {
        console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(`\n${colors.cyan}Goodbye!${colors.reset}`);
      process.exit(0);
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log(`\n${colors.dim}Press Ctrl+C again or type 'exit' to quit${colors.reset}`);
      this.rl.prompt();
    });
  }

  async handleCommand(command, args) {
    switch (command) {
      case 'help':
      case '?':
        this.showHelp();
        break;

      case 'exit':
      case 'quit':
        this.rl.close();
        break;

      case 'reload':
        console.log(`${colors.blue}Reloading plugin...${colors.reset}`);
        await this.client.execute('reload-plugin');
        console.log(`${colors.green}✓ Plugin reloaded${colors.reset}`);
        break;

      case 'open':
      case 'edit':
        await this.handleOpen(args);
        break;

      case 'validate':
        console.log(`${colors.blue}Running validation...${colors.reset}`);
        const result = await this.client.execute('validate-ui', args);
        if (result.success) {
          console.log(`${colors.green}✓ Validation passed${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Validation failed${colors.reset}`);
        }
        break;

      case 'logs':
        const lines = args[0] || '50';
        const logResult = await this.client.execute('get-logs', [lines]);
        console.log(logResult.logs);
        break;

      case 'debug':
        await this.handleDebug(args);
        break;

      case 'history':
        this.showHistory();
        break;

      case 'clear':
        console.clear();
        break;

      default:
        // Try to execute as IPC command
        try {
          const result = await this.client.execute(command, args);
          console.log(JSON.stringify(result, null, 2));
        } catch (err) {
          console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
          console.log(`${colors.dim}Type 'help' for available commands${colors.reset}`);
        }
    }
  }

  async handleOpen(args) {
    const [entityType, ...nameParts] = args;
    const name = nameParts.join(' ');

    if (!entityType) {
      console.log(`${colors.red}Entity type required${colors.reset}`);
      console.log(`${colors.dim}Usage: open <creature|spell|item|equipment> [name]${colors.reset}`);
      return;
    }

    const command = `edit-${entityType}`;
    await this.client.execute(command, name ? [name] : []);
    console.log(`${colors.green}✓ Opened ${entityType} editor${colors.reset}`);
  }

  async handleDebug(args) {
    const [subcommand, ...rest] = args;

    if (!subcommand) {
      console.log(`${colors.red}Subcommand required${colors.reset}`);
      console.log(`${colors.dim}Usage: debug <enable|disable|marker> [args]${colors.reset}`);
      return;
    }

    switch (subcommand) {
      case 'enable':
        await this.client.execute('set-debug-config', [
          JSON.stringify({ enabled: true, logFields: ['*'], logCategories: ['*'] })
        ]);
        console.log(`${colors.green}✓ Debug logging enabled${colors.reset}`);
        break;

      case 'disable':
        await this.client.execute('set-debug-config', [
          JSON.stringify({ enabled: false })
        ]);
        console.log(`${colors.yellow}Debug logging disabled${colors.reset}`);
        break;

      case 'marker':
        const text = rest.join(' ') || `Marker ${new Date().toISOString()}`;
        await this.client.execute('log-marker', [text]);
        console.log(`${colors.cyan}✓ Marker added: ${text}${colors.reset}`);
        break;

      default:
        console.log(`${colors.red}Unknown debug subcommand: ${subcommand}${colors.reset}`);
    }
  }

  showHelp() {
    console.log(`\n${colors.bright}Available Commands:${colors.reset}`);
    console.log(`
  ${colors.green}General:${colors.reset}
    help, ?              Show this help
    exit, quit           Exit interactive mode
    clear                Clear screen
    history              Show command history

  ${colors.green}Plugin Control:${colors.reset}
    reload               Reload the plugin
    logs [n]             Show last n log lines (default: 50)
    debug enable         Enable debug logging
    debug disable        Disable debug logging
    debug marker <text>  Add log marker

  ${colors.green}UI Interaction:${colors.reset}
    open <type> [name]   Open entity editor (creature, spell, item, equipment)
    validate [mode]      Run UI validation

  ${colors.green}Examples:${colors.reset}
    ${colors.dim}open creature Adult Red Dragon${colors.reset}
    ${colors.dim}logs 100${colors.reset}
    ${colors.dim}debug marker "Testing feature X"${colors.reset}
    ${colors.dim}validate${colors.reset}
`);
  }

  showHistory() {
    console.log(`\n${colors.bright}Command History:${colors.reset}`);
    this.history.forEach((cmd, i) => {
      console.log(`  ${colors.dim}${i + 1}.${colors.reset} ${cmd}`);
    });
  }
}

/**
 * Interactive entity editor opener
 */
export async function interactiveOpen(client, entityType) {
  const prompt = new InteractivePrompt();

  try {
    const name = await prompt.getEntityName(entityType);

    if (name) {
      console.log(`${colors.blue}Opening ${entityType} editor for "${name}"...${colors.reset}`);
      await client.execute(`edit-${entityType}`, [name]);
    } else {
      const shouldCreate = await prompt.confirm('Create new entity?', true);
      if (shouldCreate) {
        console.log(`${colors.blue}Opening ${entityType} editor for new entity...${colors.reset}`);
        await client.execute(`edit-${entityType}`, []);
      }
    }
  } finally {
    prompt.close();
  }
}

/**
 * Interactive workflow selector
 */
export async function interactiveWorkflow(workflows) {
  const prompt = new InteractivePrompt();

  try {
    const workflow = await prompt.select('Select workflow:', workflows.map(w => w.name));
    const selected = workflows.find(w => w.name === workflow);

    return selected;
  } finally {
    prompt.close();
  }
}
