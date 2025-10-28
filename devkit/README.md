# Salt Marcher DevKit

Unified development toolkit for the Salt Marcher Obsidian plugin.

## 3-Minute Quick Start

```bash
# 1. Setup (one time)
source devkit/core/cli/devkit-completion.bash  # Enable tab completion

# 2. Try it out
./devkit-cli plugin reload                     # Reload plugin
./devkit-cli ui open creature goblin           # Open creature editor
./devkit-cli debug logs 100                    # View recent logs

# 3. Run tests
npm test                                       # Unit tests
./devkit-cli test watch                        # Watch mode
```

## Features

- **Unified CLI** - Single command-line interface (`./devkit-cli`)
- **Bash Completion** - Tab completion for all commands and arguments
- **Alias System** - Custom shortcuts via `.devkitrc.json`
- **Watch Mode** - Auto-run tests on file changes
- **Integration Tests** - YAML-based test framework with plugin IPC
- **UI Validation** - Automated UI measurement and validation
- **Debug Utilities** - Field inspector, log analysis, markers
- **Data Management** - Preset/vault comparison and sync
- **Health Check** - System diagnostics with `doctor` command
- **Hot Reload** - Auto-reload plugin on code changes

## Structure

```
devkit/
├── core/              # Core development tools
│   ├── cli/          # Command-line interface
│   └── ipc/          # Plugin communication (IPC server)
│
├── testing/           # All testing infrastructure
│   ├── unit/         # Unit tests (*.test.ts files)
│   └── integration/  # YAML-based integration tests
│
├── validation/        # UI measurement & validation
├── migration/         # Data migration tools
└── utilities/         # Development utility scripts
```

## Installation

### Bash Completion (Highly Recommended)

Enable tab completion for the best developer experience:

```bash
# Load for current session
source devkit/core/cli/devkit-completion.bash

# Permanent installation - add to ~/.bashrc
echo "source $(pwd)/devkit/core/cli/devkit-completion.bash" >> ~/.bashrc
source ~/.bashrc
```

**Features**:
- `./devkit-cli <TAB>` - Shows all commands
- `./devkit-cli test <TAB>` - Shows test subcommands
- `./devkit-cli test run <TAB>` - Shows available test suites
- Context-aware suggestions based on command structure

### DevKit Configuration

Create `.devkitrc.json` in plugin root:

```json
{
  "aliases": {
    "e": "ui open creature",
    "reload": "plugin reload",
    "logs": "debug logs",
    "r": "plugin reload"
  },
  "debug": {
    "defaultFields": ["name", "hp", "ac"],
    "defaultCategories": ["init", "onChange"]
  },
  "test": {
    "watch": {
      "patterns": ["src/**/*.ts", "devkit/testing/**/*.yaml"]
    }
  }
}
```

## Core Commands

### Plugin Control

```bash
./devkit-cli plugin reload              # Reload plugin once
./devkit-cli plugin watch               # Hot reload - auto-reload on changes
```

### Testing

```bash
# Unit tests
npm test                                # Run all unit tests
npx vitest run path/to/test.ts          # Run specific test
npx vitest watch                        # Watch mode

# Integration tests
./devkit-cli test run all               # All integration tests
./devkit-cli test run creature-creation # Specific test
./devkit-cli test watch                 # Auto-run on file changes
./devkit-cli test generate creature     # Generate tests from entity
```

### Debugging

```bash
# Enable/disable debug logging
./devkit-cli debug enable --fields "name,hp" --categories "onChange"
./devkit-cli debug enable --all         # Enable everything
./devkit-cli debug disable              # Disable debug logging

# View logs
./devkit-cli debug logs 200             # Last 200 lines
./devkit-cli debug marker "Test start"  # Add marker to logs
./devkit-cli debug analyze              # Analyze log patterns

# Field inspection (NEW!)
./devkit-cli debug field passivesList --creature aboleth
# → Opens creature, navigates to section, inspects field
# → Shows: code location, rendering pipeline, DOM state, diagnosis
```

### UI Operations

```bash
# Open entity editors
./devkit-cli ui open creature goblin
./devkit-cli ui open spell fireball
./devkit-cli ui open item sword

# Validation
./devkit-cli ui validate                # Validate all UI elements
```

### Data Management

```bash
./devkit-cli data inspect               # Compare presets vs vault
./devkit-cli data sync                  # Sync changes
./devkit-cli data validate              # Validate data integrity
```

### System Diagnostics

```bash
./devkit-cli doctor                     # Run all health checks
# Checks: IPC connectivity, paths, presets, vault data
```

## Common Workflows

### Health Check Before Starting Work

```bash
./devkit-cli doctor
# ✓ IPC server reachable
# ✓ All paths valid
# ✓ Presets loaded: 329 creatures, 338 spells, ...
# ✓ Vault data accessible
```

### Test a Feature

```bash
# 1. Enable debug logging for relevant fields
./devkit-cli debug enable --fields "name,hp" --categories "init,onChange"

# 2. Open entity and test manually
./devkit-cli ui open creature dragon

# 3. Check logs for issues
./devkit-cli debug logs 200 | grep -E "ERROR|name|hp"

# 4. Run automated tests
./devkit-cli test run creature-creation

# 5. Validate UI
./devkit-cli ui validate
```

### Debug a Field Issue

```bash
# Use the integrated field debugger
./devkit-cli debug field myFieldId --creature goblin

# Output shows:
# - Code location (create-spec.ts:123)
# - Rendering pipeline
# - Field state (visible, editable, value)
# - Automated diagnosis with fix suggestions
```

### Hot Reload Development

```bash
# Terminal 1: Watch and auto-rebuild
npm run build:watch

# Terminal 2: Auto-reload plugin
./devkit-cli plugin watch
# → Watches main.js, reloads plugin on changes

# Terminal 3: Auto-run tests
./devkit-cli test watch
# → Watches src/**/*.ts, re-runs tests on changes
```

### Create Integration Test

```bash
# 1. Generate test from entity type
./devkit-cli test generate creature

# 2. Edit generated YAML in devkit/testing/integration/cases/

# 3. Run the test
./devkit-cli test run my-test

# 4. Debug failures
./devkit-cli debug logs 500
```

## Command Reference

### test

```bash
./devkit-cli test run <suite>           # Run test suite
./devkit-cli test run all               # Run all tests
./devkit-cli test watch [suite]         # Watch mode
./devkit-cli test generate <type>       # Generate test from entity
./devkit-cli test validate              # Validate test YAML files
```

### debug

```bash
./devkit-cli debug enable [options]     # Enable debug logging
./devkit-cli debug disable              # Disable debug logging
./devkit-cli debug logs [n]             # Show last n log lines
./devkit-cli debug marker <text>        # Add log marker
./devkit-cli debug analyze [file]       # Analyze log patterns
./devkit-cli debug config               # Show current config
./devkit-cli debug field <id> [--<type> <name>]  # Inspect field state
./devkit-cli debug field-state <id>     # Get field state (manual)
./devkit-cli debug dump-fields          # Dump all field states
```

### ui

```bash
./devkit-cli ui open <type> [name]      # Open entity editor
./devkit-cli ui validate [mode]         # Validate UI (all|labels|steppers)
./devkit-cli ui measure <selector>      # Measure element dimensions
./devkit-cli ui inspect                 # Interactive inspector
```

### plugin

```bash
./devkit-cli plugin reload              # Reload plugin once
./devkit-cli plugin watch               # Hot reload on changes
```

### data

```bash
./devkit-cli data inspect               # Compare presets vs vault
./devkit-cli data sync                  # Sync data
./devkit-cli data validate              # Validate integrity
```

### migrate

```bash
./devkit-cli migrate <type>             # Run migration
./devkit-cli migrate list               # List available migrations
```

## Integration Test Format

Create YAML files in `devkit/testing/integration/cases/`:

```yaml
name: "Test creature creation"
description: "Tests basic creature creation workflow"

# Optional: Enable debug logging for this test
debugConfig:
  enabled: true
  logFields: ["name", "hp"]
  logCategories: ["onChange"]

setup:
  - name: "Reload plugin"
    command: reload-plugin
    wait: 1000

steps:
  - name: "Open creature editor"
    command: edit-creature
    wait: 500
    expect:
      success: true

  - name: "Set creature name"
    command: set-input-value
    args: ["input[data-field-id='name']", "Test Dragon"]
    wait: 200

  - name: "Validate UI"
    command: validate-ui
    expect:
      success: true

cleanup:
  - name: "Close modal"
    command: close-modal
```

### Available IPC Commands

**Plugin Control**: `reload-plugin`, `get-logs`, `import-presets`

**Entity Editing**: `edit-creature`, `edit-spell`, `edit-item`, `edit-equipment`

**UI Interaction**: `navigate-to-section`, `set-input-value`, `click-element`, `add-token`, `close-modal`

**Validation**: `validate-ui`, `validate-grid-layout`

**Test Lifecycle**: `start-test`, `end-test`, `log-marker`, `get-test-logs`, `assert-log-contains`

**Field Inspection**: `get-field-state`, `dump-field-states`, `get-modal-data`

## Test Fixtures

Reusable test data is available in `devkit/testing/fixtures/` to eliminate repetitive test object creation.

### Available Fixtures

- **Creatures**: 5 fixtures (minimal, simple, complex, withTokens, withSaves)
- **Spells**: 7 fixtures (minimal, simple, complex, ritual, concentration, material, scalingCantrip)
- **Items**: 7 fixtures (minimal, simple, complex, consumable, wondrous, artifact, cursed)
- **Equipment**: 11 fixtures (weapons, armor, tools, vehicles, etc.)

### Usage

```typescript
// Import all fixtures
import { creatures, spells, items, equipment } from 'devkit/testing/fixtures';

test('should create creature', () => {
  const creature = creatures.minimal;
  expect(creature.name).toBe("Test Goblin");
});

// Import specific fixtures
import { minimalCreature, complexCreature } from 'devkit/testing/fixtures/creatures';

test('should handle complexity', () => {
  expect(minimalCreature.cr).toBe(0.25);
  expect(complexCreature.cr).toBe(17);
});
```

### Benefits

- **Consistency** - Same test data across all tests
- **Predictable** - Fixtures never change, making tests stable
- **Comprehensive** - Cover common scenarios (minimal → complex)
- **Typed** - Full TypeScript support
- **Documented** - Clear purpose for each fixture

See **[devkit/testing/fixtures/README.md](testing/fixtures/README.md)** for complete fixture documentation.

## Troubleshooting

### IPC Connection Failed

```bash
# Check if Obsidian is running
ps aux | grep -i obsidian

# Check if plugin is loaded
./devkit-cli doctor

# Reload plugin
./devkit-cli plugin reload
```

### Tests Failing

```bash
# Enable debug logging
./devkit-cli debug enable --all

# Run test with verbose output
./devkit-cli test run my-test

# Check logs
./devkit-cli debug logs 500
```

### Field Not Found in Debug

```bash
# Make sure modal is open
./devkit-cli ui open creature goblin

# Navigate to correct section manually, then:
./devkit-cli debug field-state myFieldId

# Or use integrated debugger (auto-navigates):
./devkit-cli debug field myFieldId --creature goblin
```

### Build Issues

```bash
# Clean build
rm -rf node_modules main.js
npm install
npm run build

# Check paths
./devkit-cli doctor
```

## Architecture

### Two-Layer CLI Design

1. **Bash Wrapper** (`devkit/core/cli/devkit`)
   - Loads `.devkitrc.json` configuration
   - Expands aliases
   - Routes to Node.js CLI

2. **Node.js CLI** (`devkit/core/cli/devkit.mjs`)
   - Implements command handlers
   - Communicates with plugin via IPC (Unix socket)
   - Executes tests and validations

### IPC Communication

DevKit CLI communicates with the running Obsidian plugin via Unix socket:

```
./devkit-cli → IPC Client → Unix Socket → IPC Server (in plugin) → Command Handlers
```

Socket location: `.obsidian/plugins/salt-marcher/ipc.sock`

### Test Infrastructure

- **Unit Tests**: Vitest (`devkit/testing/unit/`)
- **Integration Tests**: YAML + IPC (`devkit/testing/integration/`)
- **UI Validation**: Measurement API (`devkit/validation/`)

## Tips & Best Practices

1. **Use Tab Completion** - Discover commands faster
2. **Create Aliases** - Save time with custom shortcuts in `.devkitrc.json`
3. **Watch Mode** - Develop faster with auto-reload
4. **Debug Field Tool** - Diagnose field issues in seconds instead of hours
5. **Doctor Command** - Run before debugging to catch common issues
6. **Log Markers** - Add markers before testing to isolate relevant logs
7. **Integration Tests** - Write YAML tests for regression prevention

## Related Documentation

- **Testing Guide**: `docs/TESTING.md` - Comprehensive testing documentation
- **Debug Workflows**: `docs/DEBUGGING.md` - Step-by-step debugging guides
- **Storage Formats**: `docs/storage-formats.md` - Entity storage and CreateSpec system
- **Presets**: `docs/PRESETS.md` - Preset bundling and import system

## Contributing

When adding new DevKit features:

1. Add command handler to appropriate class in `devkit.mjs`
2. Register IPC command in `register-dev-commands.ts` (if needed)
3. Update bash completion in `devkit-completion.bash`
4. Add command to this README
5. Write integration test in YAML format

## Version History

- **v2.0** - Unified CLI with hierarchical commands, field debugger
- **v1.5** - Added watch mode, doctor command
- **v1.0** - Initial DevKit release
