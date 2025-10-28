#!/usr/bin/env node
// Code generation and scaffolding system for DevKit

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { InteractivePrompt } from './interactive.mjs';

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
  cyan: '\x1b[36m',
};

/**
 * Templates for code generation
 */
const TEMPLATES = {
  /**
   * Entity CreateSpec template
   */
  entitySpec: (entityName, entityType) => `import { CreateSpec } from '@/features/data-manager/types';

/**
 * ${entityName} entity specification
 */
export const ${entityType}Spec: CreateSpec = {
  fields: [
    {
      id: 'name',
      type: 'text',
      label: 'Name',
      required: true,
      placeholder: 'Enter ${entityType} name...'
    },
    {
      id: 'description',
      type: 'textarea',
      label: 'Description',
      placeholder: 'Enter description...'
    }
    // TODO: Add more fields as needed
  ],

  storage: {
    format: 'markdown',
    path: 'SaltMarcher/${entityType}/{name}.md',
    frontmatter: {
      smType: '${entityType}',
      name: { field: 'name' },
      description: { field: 'description' }
      // TODO: Map additional fields
    }
  },

  // Browse config is auto-generated, but you can override:
  // browse: {
  //   columns: [...],
  //   actions: [...],
  //   filters: [...]
  // }
};
`,

  /**
   * Entity registry entry
   */
  registryEntry: (entityType, capitalizedName) => `
// ${capitalizedName}
import { ${entityType}Spec } from './${entityType}';

export const ENTITY_TYPES = {
  // ... existing entries ...
  ${entityType.toUpperCase()}: '${entityType}',
} as const;

export function getEntitySpec(type: EntityType): CreateSpec {
  switch (type) {
    // ... existing cases ...
    case ENTITY_TYPES.${entityType.toUpperCase()}:
      return ${entityType}Spec;
    default:
      throw new Error(\`Unknown entity type: \${type}\`);
  }
}
`,

  /**
   * IPC command template
   */
  ipcCommand: (commandName, description) => `import { IpcCommand } from '../types';
import { logger } from '@/services/plugin-logger';

/**
 * ${description}
 */
export const ${commandName}: IpcCommand = {
  name: '${commandName}',
  description: '${description}',

  async execute(plugin, args) {
    try {
      logger.log('ipc', '${commandName}', 'Executing command', { args });

      // TODO: Implement command logic

      return {
        success: true,
        message: '${commandName} completed successfully'
      };
    } catch (error) {
      logger.error('ipc', '${commandName}', 'Command failed', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};
`,

  /**
   * CLI command template
   */
  cliCommand: (commandName, description) => `#!/usr/bin/env node
// ${description}

import { DevKitClient } from '../client.mjs';

/**
 * ${commandName} command handler
 */
export class ${commandName.charAt(0).toUpperCase() + commandName.slice(1)}Command {
  constructor(client) {
    this.client = client;
  }

  async handle(args) {
    try {
      const result = await this.client.execute('${commandName}', args);

      if (result.success) {
        console.log(\`✓ \${result.message}\`);
      } else {
        console.error(\`✗ \${result.error}\`);
        process.exit(1);
      }
    } catch (error) {
      console.error(\`✗ Error: \${error.message}\`);
      process.exit(1);
    }
  }

  get help() {
    return \`
Usage: devkit ${commandName} [options]

${description}

Options:
  --help    Show this help message

Examples:
  devkit ${commandName}
\`;
  }
}
`,

  /**
   * Test file template
   */
  testFile: (entityType, description) => `import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ${entityType}Spec } from '@/workmodes/library/${entityType}';

describe('${entityType} - ${description}', () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup
  });

  it('should have required fields', () => {
    expect(${entityType}Spec.fields).toBeDefined();
    expect(${entityType}Spec.fields.length).toBeGreaterThan(0);
  });

  it('should have valid storage config', () => {
    expect(${entityType}Spec.storage).toBeDefined();
    expect(${entityType}Spec.storage.format).toBe('markdown');
    expect(${entityType}Spec.storage.frontmatter.smType).toBe('${entityType}');
  });

  it('should load and save correctly', async () => {
    // TODO: Implement load/save test
  });

  // TODO: Add more tests
});
`,

  /**
   * Migration script template
   */
  migrationScript: (migrationName, description) => `#!/usr/bin/env node
// ${description}

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ${migrationName} migration
 * ${description}
 */
export async function migrate(vaultPath, options = {}) {
  const { dryRun = false } = options;

  console.log(\`Running migration: ${migrationName}\`);
  console.log(\`Dry run: \${dryRun}\`);

  try {
    // TODO: Implement migration logic

    const changes = [];

    // Example: Find all files to migrate
    // const files = await findFilesToMigrate(vaultPath);

    // for (const file of files) {
    //   const content = await fs.readFile(file, 'utf-8');
    //   const newContent = transformContent(content);
    //
    //   if (!dryRun) {
    //     await fs.writeFile(file, newContent);
    //   }
    //
    //   changes.push({
    //     file,
    //     action: 'modified'
    //   });
    // }

    console.log(\`✓ Migration completed\`);
    console.log(\`  Files modified: \${changes.length}\`);

    return {
      success: true,
      changes
    };
  } catch (error) {
    console.error(\`✗ Migration failed: \${error.message}\`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper functions
async function findFilesToMigrate(vaultPath) {
  // TODO: Implement file discovery
  return [];
}

function transformContent(content) {
  // TODO: Implement content transformation
  return content;
}
`,

  /**
   * Preset markdown template
   */
  presetMarkdown: (entityType, name) => `---
smType: ${entityType}
name: "${name}"
description: ""
---

# ${name}

Description of this ${entityType}.

## Details

- **Field 1**: Value
- **Field 2**: Value

## Notes

Additional notes about this ${entityType}.
`
};

/**
 * Code scaffolding generator
 */
export class ScaffoldGenerator {
  constructor() {
    this.prompt = new InteractivePrompt();
  }

  /**
   * Generate entity boilerplate
   */
  async generateEntity() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Generate Entity Boilerplate${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const entityType = await this.prompt.ask('Entity type (lowercase-singular):');
    const entityName = await this.prompt.ask('Entity display name:');
    const withTests = await this.prompt.confirm('Generate test file?', true);

    const files = [];

    // 1. Create entity spec file
    const specPath = path.join(PLUGIN_ROOT, `src/workmodes/library/${entityType}/index.ts`);
    const specContent = TEMPLATES.entitySpec(entityName, entityType);

    await fs.mkdir(path.dirname(specPath), { recursive: true });
    await fs.writeFile(specPath, specContent);
    files.push(specPath);

    console.log(`${colors.green}✓${colors.reset} Created entity spec: ${specPath}`);

    // 2. Create test file if requested
    if (withTests) {
      const testPath = path.join(PLUGIN_ROOT, `src/workmodes/library/${entityType}/${entityType}.test.ts`);
      const testContent = TEMPLATES.testFile(entityType, `${entityName} entity tests`);

      await fs.writeFile(testPath, testContent);
      files.push(testPath);

      console.log(`${colors.green}✓${colors.reset} Created test file: ${testPath}`);
    }

    // 3. Create Presets directory
    const presetsDir = path.join(PLUGIN_ROOT, `Presets/${entityName}`);
    await fs.mkdir(presetsDir, { recursive: true });

    // Create example preset
    const examplePresetPath = path.join(presetsDir, 'example.md');
    const examplePresetContent = TEMPLATES.presetMarkdown(entityType, 'Example');
    await fs.writeFile(examplePresetPath, examplePresetContent);
    files.push(presetsDir);

    console.log(`${colors.green}✓${colors.reset} Created Presets directory: ${presetsDir}`);

    // Show next steps
    console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
    console.log(`${colors.dim}1. Register entity in src/workmodes/library/registry.ts${colors.reset}`);
    console.log(`${colors.dim}2. Add to Presets/lib/entity-registry.ts${colors.reset}`);
    console.log(`${colors.dim}3. Add to Presets/lib/plugin-presets.ts${colors.reset}`);
    console.log(`${colors.dim}4. Run: npm run build${colors.reset}`);

    return { success: true, files };
  }

  /**
   * Generate IPC command
   */
  async generateIpcCommand() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Generate IPC Command${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const commandName = await this.prompt.ask('Command name (kebab-case):');
    const description = await this.prompt.ask('Command description:');

    const commandPath = path.join(PLUGIN_ROOT, `src/services/ipc/commands/${commandName}.ts`);
    const commandContent = TEMPLATES.ipcCommand(commandName, description);

    await fs.mkdir(path.dirname(commandPath), { recursive: true });
    await fs.writeFile(commandPath, commandContent);

    console.log(`${colors.green}✓${colors.reset} Created IPC command: ${commandPath}`);

    console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
    console.log(`${colors.dim}1. Export command from src/services/ipc/commands/index.ts${colors.reset}`);
    console.log(`${colors.dim}2. Register in src/services/ipc/command-registry.ts${colors.reset}`);
    console.log(`${colors.dim}3. Rebuild plugin: npm run build${colors.reset}`);

    return { success: true, file: commandPath };
  }

  /**
   * Generate CLI command
   */
  async generateCliCommand() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Generate CLI Command${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const commandName = await this.prompt.ask('Command name (kebab-case):');
    const description = await this.prompt.ask('Command description:');

    const commandPath = path.join(DEVKIT_ROOT, `core/cli/commands/${commandName}.mjs`);
    const commandContent = TEMPLATES.cliCommand(commandName, description);

    await fs.mkdir(path.dirname(commandPath), { recursive: true });
    await fs.writeFile(commandPath, commandContent);

    console.log(`${colors.green}✓${colors.reset} Created CLI command: ${commandPath}`);

    console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
    console.log(`${colors.dim}1. Import command in devkit/core/cli/devkit.mjs${colors.reset}`);
    console.log(`${colors.dim}2. Register in DevKitCLI.commands object${colors.reset}`);
    console.log(`${colors.dim}3. Update bash completion${colors.reset}`);

    return { success: true, file: commandPath };
  }

  /**
   * Generate migration script
   */
  async generateMigration() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Generate Migration Script${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const migrationName = await this.prompt.ask('Migration name (kebab-case):');
    const description = await this.prompt.ask('Migration description:');

    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `${timestamp}-${migrationName}.mjs`;
    const migrationPath = path.join(DEVKIT_ROOT, `migrations/${fileName}`);
    const migrationContent = TEMPLATES.migrationScript(migrationName, description);

    await fs.mkdir(path.dirname(migrationPath), { recursive: true });
    await fs.writeFile(migrationPath, migrationContent);

    console.log(`${colors.green}✓${colors.reset} Created migration: ${migrationPath}`);

    console.log(`\n${colors.cyan}Usage:${colors.reset}`);
    console.log(`${colors.dim}./devkit migrate ${migrationName} --dry-run${colors.reset}`);
    console.log(`${colors.dim}./devkit migrate ${migrationName}${colors.reset}`);

    return { success: true, file: migrationPath };
  }

  /**
   * Generate test file
   */
  async generateTest() {
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}Generate Test File${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const testEntityType = await this.prompt.ask('Entity type:');
    const testDescription = await this.prompt.ask('Test description:');
    const testPath = path.join(PLUGIN_ROOT, `src/workmodes/library/${testEntityType}/${testEntityType}.test.ts`);
    const testContent = TEMPLATES.testFile(testEntityType, testDescription);

    await fs.mkdir(path.dirname(testPath), { recursive: true });
    await fs.writeFile(testPath, testContent);

    console.log(`${colors.green}✓${colors.reset} Created test file: ${testPath}`);

    console.log(`\n${colors.cyan}Usage:${colors.reset}`);
    console.log(`${colors.dim}npm test ${testEntityType}${colors.reset}`);

    return { success: true, file: testPath };
  }

  /**
   * Interactive generator selection
   */
  async run() {
    const generatorType = await this.prompt.select(
      'What would you like to generate?',
      [
        'entity - New entity type with CreateSpec',
        'ipc-command - IPC command for plugin',
        'cli-command - CLI command for DevKit',
        'migration - Migration script',
        'test - Test file'
      ]
    );

    const type = generatorType.split(' - ')[0];

    switch (type) {
      case 'entity':
        return await this.generateEntity();
      case 'ipc-command':
        return await this.generateIpcCommand();
      case 'cli-command':
        return await this.generateCliCommand();
      case 'migration':
        return await this.generateMigration();
      case 'test':
        return await this.generateTest();
      default:
        console.log(`${colors.red}Unknown generator type${colors.reset}`);
        return { success: false };
    }
  }
}
