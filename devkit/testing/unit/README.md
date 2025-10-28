# Salt Marcher Test Suite

Unified testing infrastructure for comprehensive plugin testing and debugging.

## Directory Structure

```
tests/
├── unit/                       # Unit tests (Vitest)
│   ├── library/               # Library workmode tests
│   ├── cartographer/          # Map editor tests
│   └── ...                    # Other unit tests
│
├── integration/               # End-to-end integration tests
│   ├── test-cases/           # YAML test definitions
│   ├── templates/            # Test templates
│   ├── lib/                  # Test helpers and utilities
│   │   ├── test-helpers.mjs  # Core test helper library
│   │   └── test-generator.mjs # Auto-generate tests from specs
│   └── test-runner.mjs       # Main test runner
│
├── commands/                  # IPC commands for testing (from dev-tools)
│   ├── production/           # Commands available in production
│   │   ├── plugin-commands.ts     # reload-plugin, get-logs, etc.
│   │   └── entity-commands.ts     # edit-creature, edit-spell, etc.
│   └── test/                 # Test-only commands
│       ├── ui-commands.ts         # navigate, validate, dump
│       ├── field-commands.ts      # set-value, click, toggle
│       ├── test-lifecycle.ts      # start-test, end-test, log-marker
│       └── debug-commands.ts      # set-debug-config, assert-logs
│
├── measurement/              # UI measurement and validation (from dev-tools)
│   ├── measurement-api.ts   # Core measurement API
│   ├── validation-engine.ts # Rule-based validation
│   ├── dom-utils.ts         # DOM traversal utilities
│   └── configs/             # Validation rule configs
│
├── cli/                     # CLI tools (from scripts)
│   ├── obsidian-cli.mjs   # Main CLI interface
│   ├── test-ui.sh          # UI test workflow
│   └── validate-field.sh   # Field validation script
│
├── contracts/              # Contract tests (golden files)
│   └── golden/            # Golden test files
│
└── mocks/                 # Mock implementations
    └── obsidian.ts       # Obsidian API mocks
```

## Quick Start

### Run Tests

```bash
# Unit tests
npm test                    # Run all unit tests
npx vitest run path/to/test # Run specific test

# Integration tests
npm run test:integration    # Run all integration tests
npm run test:integration:single <test.yaml>  # Run single test

# UI tests
npm run test:ui            # Run UI test workflow
npm run test:ui:validate   # Validate UI fields

# All tests
npm run test:all           # Run everything
```

### Create New Tests

#### Option 1: Use Templates

```bash
# Copy template
cp tests/integration/templates/modal-test-template.yaml \
   tests/integration/test-cases/my-test.yaml

# Edit test
vim tests/integration/test-cases/my-test.yaml

# Run test
npm run test:integration:single my-test.yaml
```

#### Option 2: Auto-Generate from CreateSpec

```javascript
import { generateTestSuite } from './integration/lib/test-generator.mjs';

// Generate tests from CreateSpec
await generateTestSuite(creatureSpec, 'creature', './test-cases');
```

#### Option 3: Programmatic Test

```javascript
import helpers from './integration/lib/test-helpers.mjs';

async function testCreatureCreation() {
  await helpers.startTest('creature-test', 'Test creature creation');
  await helpers.reloadPlugin();

  await helpers.openEntityModal('creature');
  await helpers.setFieldValue('input[data-field-id="name"]', 'Dragon');
  await helpers.navigateToSection('abilities');
  await helpers.setFieldValue('input[data-field-id="str"]', '20');

  const result = await helpers.validateUI('all');

  await helpers.closeModal();
  await helpers.endTest();
}
```

## Debug Workflow

### 1. Enable Debug Logging

```json
// .claude/debug.json
{
  "enabled": true,
  "logFields": ["name", "str", "saveProf"],
  "logCategories": ["onChange", "init"]
}
```

### 2. Run Test with Debugging

```bash
# Run with verbose logging
node tests/cli/obsidian-cli.mjs reload-plugin
node tests/cli/obsidian-cli.mjs edit-creature
node tests/cli/obsidian-cli.mjs get-logs 500
```

### 3. Reproduce Errors

Use the error reproduction template:

```yaml
# tests/integration/test-cases/debug-issue.yaml
name: "Debug specific issue"
debugConfig:
  enabled: true
  logAll: true
steps:
  - name: "Reproduce error"
    command: {failing-command}
    continueOnError: true
  - name: "Get logs"
    command: get-logs
    args: [500]
```

## Available Commands

### Production Commands
- `reload-plugin` - Reload plugin
- `get-logs [lines]` - Get recent logs
- `edit-creature [name]` - Open creature editor
- `edit-spell [name]` - Open spell editor
- `import-presets [type]` - Import preset data

### Test Commands (Development Only)
- `navigate-to-section <section>` - Navigate in modal
- `set-input-value <selector> <value>` - Set field value
- `click-element <selector>` - Click element
- `add-token <fieldId> <token>` - Add structured tag
- `validate-ui [mode]` - Validate UI layout
- `toggle-save-checkbox <ability> <index>` - Toggle checkbox
- `get-ability-values <ability>` - Get field values

### Test Lifecycle
- `start-test <id> <name>` - Begin test context
- `end-test` - End test
- `log-marker <text>` - Add log marker
- `set-debug-config <json>` - Configure debug logging
- `assert-log-contains <id> <patterns...>` - Assert log patterns

## Best Practices

### Test Organization
1. **Unit tests**: Fast, isolated, mock dependencies
2. **Integration tests**: Real plugin, simulate user interactions
3. **Contract tests**: Validate API contracts with golden files

### Writing Good Tests
1. **Clear names**: Describe what is being tested
2. **Isolated**: Each test should be independent
3. **Deterministic**: Same input → same output
4. **Fast**: Use appropriate wait times (200-500ms typical)
5. **Comprehensive**: Test happy path and edge cases

### Debugging Tips
1. **Use markers**: Add log markers at key points
2. **Dump DOM**: Use dump-dom to inspect UI structure
3. **Enable verbose logging**: Use debug config for details
4. **Continue on error**: Use `continueOnError: true` to capture full state
5. **Check logs**: Always check CONSOLE_LOG.txt for details

## Architecture

### Test Execution Flow
1. **CLI** (`obsidian-cli.mjs`) → sends commands to plugin
2. **IPC Server** (in plugin) → receives and executes commands
3. **Commands** → interact with plugin UI/state
4. **Validation** → verify results and assertions
5. **Reporting** → output results and logs

### Key Components
- **Test Runner**: Executes YAML test definitions
- **Test Helpers**: Programmatic test utilities
- **IPC Commands**: Plugin interaction commands
- **Measurement API**: UI measurement and validation
- **Debug System**: Configurable logging

## Extending the Test Suite

### Adding New Commands

```typescript
// tests/commands/test/my-commands.ts
export function registerMyCommands(server: IPCServer) {
  server.registerCommand('my-command', async (app, args) => {
    // Implementation
    return { success: true, result: 'data' };
  });
}
```

### Adding Validation Rules

```yaml
# tests/measurement/configs/my-validation.yaml
rules:
  - name: "Check my condition"
    selector: ".my-elements"
    dimension: "width"
    expect: "synchronized"
    tolerance: 1
```

### Custom Test Helpers

```javascript
// tests/integration/lib/my-helpers.mjs
export async function myCustomHelper(param) {
  await executeCommand('my-command', [param]);
  // Additional logic
  return result;
}
```

## Troubleshooting

### Plugin won't reload
- Check if Obsidian is running
- Verify IPC socket exists: `.obsidian/plugins/salt-marcher/ipc.sock`
- Check plugin console for errors

### Tests fail intermittently
- Increase wait times between commands
- Check for race conditions
- Verify clean state with `reload-plugin`

### Can't find elements
- Use browser dev tools to inspect selectors
- Check if element is visible/rendered
- Verify navigation to correct section

### Logs missing information
- Enable debug logging in `.claude/debug.json`
- Check `CONSOLE_LOG.txt` for full output
- Use `logAll: true` for comprehensive logging