# Integration Testing System

Automated end-to-end testing with YAML test definitions and log correlation.

## Quick Start

```bash
npm run test:integration                              # Run all tests
npm run test:integration:single <test-name>.yaml      # Run single test (provide yaml file as argument)
./tests/integration/test-runner.mjs all               # Direct execution - all tests
./tests/integration/test-runner.mjs <test-name>.yaml  # Direct execution - single test
```

## Architecture

- **Test Runner**: `tests/integration/test-runner.mjs`
- **Test Cases**: `tests/integration/test-cases/*.yaml`
- **Dev Context**: `dev-tools/testing/test-context.ts`
- **Results**: `tests/integration/results/`

## YAML Test Format

```yaml
name: "Test name"
description: "Test description"

# Optional debug config
debugConfig:
  enabled: true
  logFields: ["field1", "field2"]
  logCategories: ["*"]

# Setup steps (optional)
setup:
  - name: "Reload plugin"
    command: reload-plugin
    wait: 1000

# Main test steps
steps:
  - name: "Step name"
    command: edit-creature
    args: ["Goblin"]
    wait: 500
    expect:
      success: true
      values:
        field: "expected"

  - name: "Assert logs"
    command: assert-log-contains
    args:
      - "[category:field]"
      - "expected text"

# Cleanup (optional, always runs)
cleanup:
  - name: "Close modal"
    command: close-modal
```

## Test Commands

### Test Lifecycle
```bash
start-test <test-id> [name]    # Begin test context
end-test                        # End test, return summary
log-marker <text>               # Add marker to logs
```

### Debug Config
```bash
set-debug-config '{...}'        # Update debug config
get-debug-config                # Get current config
```

### Test Analysis
```bash
get-test-logs <test-id>         # Extract test logs
assert-log-contains <id> ...    # Assert log patterns
```

## Writing Tests

### Best Practices
1. **Clear names** - Aid debugging
2. **Add markers** - Mark checkpoints with `log-marker`
3. **Wait times** - 200-500ms for UI updates
4. **Validate both** - Check results AND logs
5. **Always cleanup** - Close modals, reset state
6. **Focus** - Test one feature per test
7. **Debug config** - Enable relevant logging
8. **Document** - Comment calculated values

### Example: Save Proficiency Toggle

```yaml
name: "Save proficiency toggle test"
description: "Tests save proficiency auto-initializes saveMod"

debugConfig:
  enabled: true
  logFields: ["saveProf", "saveMod"]

steps:
  - name: "Open creature editor"
    command: edit-creature
    args: ["Goblin"]
    wait: 500
    expect:
      success: true

  - name: "Toggle STR save"
    command: toggle-save-checkbox
    args: ["str", "0"]
    wait: 200
    expect:
      success: true

  - name: "Verify initialization"
    command: get-ability-values
    args: ["str"]
    expect:
      values:
        saveProf: true
        saveMod: 1    # floor((8-10)/2) + 2 = 1

cleanup:
  - name: "Close modal"
    command: close-modal
```

## Interactive Development

```bash
# Enable debug logging
node scripts/obsidian-cli.mjs set-debug-config '{"enabled": true, "logFields": ["*"]}'

# Start test context
node scripts/obsidian-cli.mjs start-test "manual" "Manual exploration"

# Execute commands
node scripts/obsidian-cli.mjs edit-creature Goblin
node scripts/obsidian-cli.mjs log-marker "Checkpoint"
node scripts/obsidian-cli.mjs get-ability-values str

# End test
node scripts/obsidian-cli.mjs end-test
```

## Assertions

### Deep Equality
```yaml
expect:
  success: true
  count: 5
  values:
    nested:
      deep: true
```

### Log Patterns
```yaml
args:
  - "[category:field]"    # Must contain all patterns
  - "specific text"
```

## Example Test Cases

- `debug-config-test.yaml` - Debug config runtime changes
- `log-marker-test.yaml` - Custom marker insertion
- `save-proficiency-toggle.yaml` - Complex UI interaction

See `tests/integration/test-cases/README.md` for complete guide.