#!/usr/bin/env node
// scripts/obsidian-cli.mjs
// CLI tool for sending commands to Obsidian plugin via IPC

import * as net from 'net';
import { randomBytes } from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve vault path (CLI tool is in <vault>/.obsidian/plugins/salt-marcher/scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_PATH = path.resolve(__dirname, '../../../..');
const SOCKET_PATH = path.join(VAULT_PATH, '.obsidian/plugins/salt-marcher/ipc.sock');
const TIMEOUT = 120000; // 120 seconds (for bulk operations like preset import)

/**
 * Execute a command via IPC and return the result
 */
async function executeCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    const id = randomBytes(8).toString('hex');
    let buffer = '';

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Command timeout: ${command}`));
    }, TIMEOUT);

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
            clearTimeout(timeout);
            client.end();

            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        } catch (error) {
          reject(error);
        }
      }
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      if (error.code === 'ENOENT') {
        reject(new Error('Plugin IPC server not running. Is the plugin loaded in Obsidian?'));
      } else {
        reject(error);
      }
    });
  });
}

// CLI interface
const [,, command, ...args] = process.argv;

if (!command) {
  console.error('Usage: obsidian-cli <command> [args...]');
  console.error('');
  console.error('Commands:');
  console.error('  reload-plugin              Reload the Salt Marcher plugin');
  console.error('  edit-creature <name>       Open creature editor');
  console.error('  edit-spell <name>          Open spell editor');
  console.error('  edit-item <name>           Open item editor');
  console.error('  edit-equipment <name>      Open equipment editor');
  console.error('  import-presets <category>  Import/update presets in vault');
  console.error('                             Categories: creatures, spells, items, equipment,');
  console.error('                             terrains, regions, calendars, all');
  console.error('                             Options: --force (delete and recreate existing files)');
  console.error('  regenerate-indexes         Regenerate library index files (Creatures.md, etc.)');
  console.error('  get-logs [lines]           Get recent log entries');
  console.error('  navigate-to-section <name> Navigate to modal section');
  console.error('  validate-grid-layout       Validate tag editor grid layout');
  console.error('');
  console.error('Examples:');
  console.error('  obsidian-cli reload-plugin');
  console.error('  obsidian-cli edit-creature "adult-black-dragon"');
  console.error('  obsidian-cli import-presets creatures --force');
  console.error('  obsidian-cli import-presets all');
  console.error('  obsidian-cli regenerate-indexes');
  console.error('  obsidian-cli get-logs 100');
  process.exit(1);
}

try {
  const result = await executeCommand(command, args);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
