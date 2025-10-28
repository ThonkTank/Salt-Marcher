#!/usr/bin/env node
// Workflow automation system for DevKit

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { InteractivePrompt } from './interactive.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVKIT_ROOT = path.resolve(__dirname, '../..');
const WORKFLOWS_FILE = path.join(DEVKIT_ROOT, 'workflows/workflows.json');

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

export class WorkflowRunner {
  constructor(client) {
    this.client = client;
    this.prompt = new InteractivePrompt();
    this.variables = {};
  }

  /**
   * Load workflows from file
   */
  async loadWorkflows() {
    try {
      const content = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
      const data = JSON.parse(content);
      return data.workflows;
    } catch (err) {
      console.log(`${colors.yellow}No workflows file found${colors.reset}`);
      return [];
    }
  }

  /**
   * List available workflows
   */
  async list() {
    const workflows = await this.loadWorkflows();

    if (workflows.length === 0) {
      console.log(`${colors.yellow}No workflows available${colors.reset}`);
      return;
    }

    console.log(`${colors.cyan}Available Workflows:${colors.reset}\n`);
    workflows.forEach((w, i) => {
      console.log(`  ${colors.bright}${i + 1}. ${w.name}${colors.reset}`);
      console.log(`     ${colors.dim}${w.description}${colors.reset}`);
    });
  }

  /**
   * Run a workflow by name
   */
  async run(workflowName, variables = {}) {
    const workflows = await this.loadWorkflows();
    const workflow = workflows.find(w => w.name === workflowName);

    if (!workflow) {
      console.log(`${colors.red}Workflow not found: ${workflowName}${colors.reset}`);
      console.log(`${colors.dim}Run 'devkit workflow list' to see available workflows${colors.reset}`);
      return;
    }

    this.variables = variables;

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Running Workflow: ${workflow.name}${colors.reset}`);
    console.log(`${colors.dim}${workflow.description}${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    let success = true;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepNum = `[${i + 1}/${workflow.steps.length}]`;

      console.log(`${colors.blue}${stepNum}${colors.reset} ${step.name}`);

      try {
        const result = await this.executeStep(step);

        if (result === false && !step.optional) {
          success = false;
          console.log(`${colors.red}✗ Step failed: ${step.name}${colors.reset}`);
          break;
        }

        if (step.wait) {
          await this.wait(step.wait);
        }

        console.log(`${colors.green}✓${colors.reset} ${step.name}\n`);
      } catch (error) {
        if (step.optional) {
          console.log(`${colors.yellow}⚠ Optional step failed: ${error.message}${colors.reset}\n`);
        } else {
          success = false;
          console.log(`${colors.red}✗ Step failed: ${error.message}${colors.reset}\n`);
          break;
        }
      }
    }

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    if (success) {
      console.log(`${colors.green}${colors.bright}✅ Workflow completed successfully${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ Workflow failed${colors.reset}`);
    }
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    this.prompt.close();
    return success;
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(step) {
    // Substitute variables in command and args
    const command = this.substitute(step.command);
    const args = (step.args || []).map(arg => this.substitute(arg));

    switch (step.type) {
      case 'pause':
        return await this.handlePause(step);

      case 'confirm':
        return await this.handleConfirm(step);

      case 'git':
        return await this.handleGit(step);

      case 'npm':
        return await this.handleNpm(step);

      case 'background':
        return await this.handleBackground(step);

      case 'custom':
        return await this.handleCustom(step);

      default:
        // IPC command
        return await this.handleIPC(command, args, step);
    }
  }

  async handlePause(step) {
    await this.prompt.ask(step.message || 'Press Enter to continue...');
    return true;
  }

  async handleConfirm(step) {
    const confirmed = await this.prompt.confirm(step.message || 'Continue?', true);
    if (!confirmed) {
      throw new Error('User cancelled');
    }
    return true;
  }

  async handleGit(step) {
    const args = (step.args || []).map(arg => this.substitute(arg));
    return await this.runCommand('git', [step.command, ...args]);
  }

  async handleNpm(step) {
    const args = (step.args || []).map(arg => this.substitute(arg));
    return await this.runCommand('npm', [step.command, ...args]);
  }

  async handleBackground(step) {
    const script = this.substitute(step.script);
    console.log(`${colors.dim}Starting in background: ${script}${colors.reset}`);
    // Note: Actual background process handling would go here
    return true;
  }

  async handleCustom(step) {
    const script = this.substitute(step.script);
    const [command, ...args] = script.split(/\s+/);
    return await this.runCommand(command, args);
  }

  async handleIPC(command, args, step) {
    const result = await this.client.execute(command, args);

    if (step.save) {
      // Save result to file
      const filepath = this.substitute(step.save);
      await fs.writeFile(filepath, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      console.log(`${colors.dim}Saved to: ${filepath}${colors.reset}`);
    }

    return result.success !== false;
  }

  /**
   * Run shell command
   */
  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Substitute variables in string
   */
  substitute(str) {
    if (typeof str !== 'string') return str;

    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Special variables
      if (varName === 'DATE') {
        return new Date().toISOString().split('T')[0];
      }
      if (varName === 'DATETIME') {
        return new Date().toISOString().replace(/[:.]/g, '-');
      }

      // User-provided variables
      return this.variables[varName] || match;
    });
  }

  /**
   * Wait for specified duration
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Interactive workflow selection
   */
  async selectWorkflow() {
    const workflows = await this.loadWorkflows();

    if (workflows.length === 0) {
      console.log(`${colors.yellow}No workflows available${colors.reset}`);
      return null;
    }

    const choices = workflows.map(w => `${w.name} - ${w.description}`);
    const selection = await this.prompt.select('Select workflow:', choices);
    const workflowName = selection.split(' - ')[0];

    return workflows.find(w => w.name === workflowName);
  }

  /**
   * Collect variables from user
   */
  async collectVariables(workflow) {
    const variables = {};

    // Extract variables from workflow
    const varPattern = /\$\{([A-Z_]+)\}/g;
    const foundVars = new Set();

    JSON.stringify(workflow).match(varPattern)?.forEach(match => {
      const varName = match.slice(2, -1);
      if (!['DATE', 'DATETIME'].includes(varName)) {
        foundVars.add(varName);
      }
    });

    // Prompt for each variable
    for (const varName of foundVars) {
      const value = await this.prompt.ask(`Enter value for ${varName}:`);
      variables[varName] = value;
    }

    return variables;
  }
}

/**
 * Create a new workflow interactively
 */
export async function createWorkflow() {
  const prompt = new InteractivePrompt();

  const name = await prompt.ask('Workflow name (lowercase-with-dashes):');
  const description = await prompt.ask('Workflow description:');

  const workflow = {
    name,
    description,
    steps: []
  };

  console.log(`\n${colors.cyan}Adding steps (type 'done' when finished)${colors.reset}\n`);

  while (true) {
    const stepName = await prompt.ask('Step name (or "done"):');

    if (stepName.toLowerCase() === 'done') {
      break;
    }

    const stepType = await prompt.select('Step type:', [
      'ipc-command',
      'git',
      'npm',
      'pause',
      'confirm',
      'custom'
    ]);

    const step = { name: stepName };

    if (stepType === 'ipc-command') {
      step.command = await prompt.ask('IPC command:');
      const argsInput = await prompt.ask('Arguments (comma-separated, optional):');
      if (argsInput) {
        step.args = argsInput.split(',').map(a => a.trim());
      }
    } else if (stepType === 'pause') {
      step.type = 'pause';
      step.message = await prompt.ask('Pause message:');
    } else if (stepType === 'confirm') {
      step.type = 'confirm';
      step.message = await prompt.ask('Confirmation message:');
    } else {
      step.type = stepType;
      step.command = await prompt.ask(`${stepType} command:`);
      const argsInput = await prompt.ask('Arguments (comma-separated, optional):');
      if (argsInput) {
        step.args = argsInput.split(',').map(a => a.trim());
      }
    }

    workflow.steps.push(step);
    console.log(`${colors.green}✓ Added step: ${stepName}${colors.reset}\n`);
  }

  // Save workflow
  const workflows = await loadWorkflows();
  workflows.push(workflow);

  await fs.writeFile(WORKFLOWS_FILE, JSON.stringify({ workflows }, null, 2));

  console.log(`\n${colors.green}✓ Workflow created: ${name}${colors.reset}`);
  console.log(`${colors.dim}Run with: devkit workflow run ${name}${colors.reset}`);

  prompt.close();
}

async function loadWorkflows() {
  try {
    const content = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
    return JSON.parse(content).workflows || [];
  } catch (err) {
    return [];
  }
}
