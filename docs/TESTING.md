# Testing Guide

Complete guide to testing the Salt Marcher plugin.

## Quick Start

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# UI validation
npm run test:ui

# All tests
npm run test:all

# Using DevKit CLI (with aliases via .devkitrc.json)
./devkit/core/cli/devkit reload     # Reload plugin
./devkit/core/cli/devkit validate   # Run UI validation
./devkit/core/cli/devkit logs 200   # Get recent logs
./devkit/core/cli/devkit test watch # Watch mode - auto-run tests on changes

# Enable bash completion for better UX
source devkit/core/cli/devkit-completion.bash
./devkit <TAB>  # See all available commands
```

## Test Structure

All tests are in `devkit/testing/`:

```
devkit/testing/
├── unit/              # Unit tests (50+ .test.ts files)
│   ├── app/
│   ├── cartographer/
│   ├── library/
│   ├── contracts/
│   └── mocks/
│
├── integration/       # Integration test framework
│   ├── cases/        # YAML test definitions
│   ├── test-runner.mjs
│   ├── test-helpers.mjs
│   └── test-generator.mjs
│
└── utilities/         # Test utility scripts
```

## Unit Tests

Standard Vitest tests for isolated functionality.

```bash
# Run all unit tests
npm test

# Run specific test
npx vitest run devkit/testing/unit/library/

# Watch mode
npx vitest watch
```

## Integration Tests

YAML-based end-to-end tests with the full plugin.

### Running Integration Tests

```bash
# All integration tests
npm run test:integration

# Single test
npm run test:integration:single creature-creation-full-flow.yaml

# Watch mode - auto-run on file changes
./devkit/core/cli/devkit test watch
./devkit/core/cli/devkit test watch all           # Watch all tests
./devkit/core/cli/devkit test watch specific-test # Watch specific test
```

Watch mode monitors configured file patterns (default: `src/**/*.ts`, `devkit/testing/**/*.yaml`) and automatically re-runs tests when files change. Useful for rapid development cycles.

### Writing Integration Tests

Use YAML format in `devkit/testing/integration/cases/`:

```yaml
name: "My test"
description: "What this test does"

# Optional: Enable debug logging
debugConfig:
  enabled: true
  logFields: ["name", "hp"]
  logCategories: ["onChange"]

# Setup phase
setup:
  - name: "Reload plugin"
    command: reload-plugin
    wait: 1000

# Test steps
steps:
  - name: "Open creature editor"
    command: edit-creature
    args: ["Dragon"]
    wait: 500
    expect:
      success: true

  - name: "Set name"
    command: set-input-value
    args: ["input[data-field-id='name']", "Test Dragon"]
    wait: 200

  - name: "Validate UI"
    command: validate-ui
    args: ["all"]
    expect:
      success: true

# Cleanup (always runs)
cleanup:
  - name: "Close modal"
    command: close-modal
```

### Available Commands

**Plugin Control:**
- `reload-plugin` - Reload the plugin
- `get-logs [lines]` - Get recent logs
- `import-presets [type]` - Import preset data

**Entity Editing:**
- `edit-creature [name]` - Open creature editor
- `edit-spell [name]` - Open spell editor
- `edit-item [name]` - Open item editor
- `edit-equipment [name]` - Open equipment editor

**UI Interaction:**
- `navigate-to-section <name>` - Navigate to section
- `set-input-value <selector> <value>` - Set field value
- `click-element <selector>` - Click element
- `add-token <field> <token>` - Add structured tag
- `close-modal` - Close current modal

**Validation:**
- `validate-ui [mode]` - Validate UI (all|labels|steppers)
- `validate-grid-layout` - Validate grid layouts
- `dump-dom [selector] [maxDepth]` - Dump DOM structure as ASCII tree

**Test Lifecycle:**
- `start-test <id> [name]` - Begin test context
- `end-test` - End test context
- `log-marker <text>` - Add log marker
- `set-debug-config <json>` - Configure debug logging
- `get-test-logs <id>` - Get test logs
- `assert-log-contains <id> <patterns...>` - Assert log patterns

## UI Validation

Automated UI validation using the DevKit CLI:

```bash
# Validate all UI elements
./devkit/core/cli/devkit ui validate

# Validate specific mode
./devkit/core/cli/devkit ui validate labels
./devkit/core/cli/devkit ui validate steppers
```

### Visual Testing

```bash
# Open modal and inspect DOM structure
./devkit/core/cli/devkit test edit-creature
./devkit/core/cli/devkit ui dump
```

DOM dumps are output to console as ASCII tree representation.

## Debugging Tests

### Watch Mode for Rapid Testing

Watch mode automatically re-runs tests when source files change:

```bash
# Start watch mode
./devkit/core/cli/devkit test watch

# Watch specific test suite
./devkit/core/cli/devkit test watch creature-tests
```

Configuration in `.devkitrc.json`:
```json
{
  "test": {
    "watch": {
      "patterns": ["src/**/*.ts", "devkit/testing/**/*.yaml"],
      "ignore": ["**/node_modules/**", "**/.git/**"]
    }
  }
}
```

Features:
- **Auto-reload**: Tests run automatically on file save
- **Debouncing**: Waits 500ms after last change to avoid rapid re-runs
- **Clear output**: Screen clears between runs for better readability
- **File tracking**: Shows which file triggered the re-run
- **Ctrl+C to quit**: Clean shutdown with watcher cleanup

### Enable Debug Logging

Create/edit `.claude/debug.json`:

```json
{
  "enabled": true,
  "logFields": ["name", "hp", "ac"],
  "logCategories": ["onChange", "init"]
}
```

Or via CLI:

```bash
./devkit/core/cli/devkit debug enable --fields "name,hp" --categories "onChange"
```

### View Logs

```bash
# Get recent logs
./devkit/core/cli/devkit debug logs 500

# Search for specific patterns
grep -E "\[init:name\]" CONSOLE_LOG.txt
```

### Test Markers

Add markers to track test flow:

```yaml
steps:
  - name: "Mark checkpoint"
    command: log-marker
    args: ["=== Before action ==="]

  - name: "Perform action"
    command: edit-creature

  - name: "Mark completion"
    command: log-marker
    args: ["=== After action ==="]
```

## Best Practices

### Writing Good Tests

1. **Clear names** - Describe what is being tested
2. **Isolated** - Each test should be independent
3. **Deterministic** - Same input → same output
4. **Fast** - Use appropriate wait times (200-500ms)
5. **Comprehensive** - Test both happy path and edge cases

### Test Organization

- **Unit tests** - Fast, isolated, mock dependencies
- **Integration tests** - Real plugin, simulate user interactions
- **DOM inspection** - Use dump-dom for UI structure analysis

### Debugging Tips

1. **Use markers** - Add log markers at key points
2. **Dump DOM** - Inspect UI structure with dump-dom command
3. **Enable verbose logging** - Use debug config for details
4. **Continue on error** - Use `continueOnError: true` to capture full state
5. **Check logs** - Always check CONSOLE_LOG.txt for details

## Advanced

### Auto-Generate Tests

Use the test generator to create tests from CreateSpecs:

```javascript
import { generateTestSuite } from './devkit/testing/integration/test-generator.mjs';

// Generate tests from spec
await generateTestSuite(creatureSpec, 'creature', './devkit/testing/integration/cases/');
```

### Custom Validation Rules

See `devkit/validation/configs/` for validation rule definitions.

### Test Templates

Copy templates from `devkit/testing/integration/templates/`:
- `modal-test-template.yaml` - Standard modal tests
- `error-reproduction-template.yaml` - Debugging issues

## Troubleshooting

### Plugin not responding
```bash
# Check IPC connection
ls -la .obsidian/plugins/salt-marcher/ipc.sock

# Reload plugin
./devkit/core/cli/devkit reload
```

### Tests failing intermittently
- Increase wait times in YAML tests
- Check for race conditions
- Verify clean state with `reload-plugin`

### Can't find elements
- Use browser dev tools to inspect selectors
- Check if element is visible/rendered
- Verify navigation to correct section

### No logs
- Check if debug logging is enabled
- Verify CONSOLE_LOG.txt exists and is writable
- Check log file permissions

## Related Documentation

- **DevKit Overview**: `devkit/docs/OVERVIEW.md`
- **Storage Formats**: `docs/storage-formats.md`
- **Presets**: `docs/PRESETS.md`