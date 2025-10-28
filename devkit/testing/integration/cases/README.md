# Integration Test Cases

This directory contains YAML-based integration test definitions for the Salt Marcher plugin.

## Test Case Format

Test cases are written in YAML and consist of the following sections:

```yaml
name: "Test name"
description: "Brief description of what this test does"

# Optional: Debug configuration for this test
debugConfig:
  enabled: true
  logFields: ["field1", "field2"]  # or ["*"] for all
  logCategories: ["category1"]     # or ["*"] for all
  logAll: false                    # true to log everything

# Optional: Setup steps (run before main test steps)
setup:
  - name: "Setup step name"
    command: command-name
    args: ["arg1", "arg2"]
    wait: 500  # Optional: wait time in ms after command
    expect:    # Optional: validate command result
      success: true
      someField: expectedValue

# Required: Main test steps
steps:
  - name: "Test step name"
    command: command-name
    args: ["arg1", "arg2"]
    wait: 300
    expect:
      success: true
      # Can check nested objects
      values:
        field1: value1
        field2: value2

# Optional: Cleanup steps (always run, even if test fails)
cleanup:
  - name: "Cleanup step name"
    command: command-name
```

## Available Commands

### Test Lifecycle
- `start-test <test-id> [test-name]` - Start test context
- `end-test` - End test context and return summary
- `log-marker <marker-text>` - Add custom marker to logs

### Debug Configuration
- `set-debug-config <json-config>` - Update debug config
- `get-debug-config` - Retrieve current debug config

### Test Analysis
- `get-test-logs <test-id>` - Get logs for specific test
- `assert-log-contains <test-id> <pattern1> [pattern2...]` - Assert logs contain patterns

### UI Commands (from dev-commands)
- `reload-plugin` - Reload the plugin
- `edit-creature <name>` - Open creature editor
- `edit-spell <name>` - Open spell editor
- `edit-item <name>` - Open item editor
- `edit-equipment <name>` - Open equipment editor
- `navigate-to-section <section-name>` - Navigate to modal section
- `click-element <selector>` - Click an element
- `set-input-value <selector> <value>` - Set input value
- `add-token <field-id> <token>` - Add token to field
- `toggle-save-checkbox <ability> <index>` - Toggle save proficiency
- `get-ability-values <ability>` - Get ability field values

### Validation Commands
- `measure-ui <selector>` - Measure element dimensions
- `validate-ui-rule <selector> <rule>` - Validate UI element
- `validate-ui-config <json-config>` - Validate multiple elements
- `validate-grid-layout` - Validate grid layout
- `debug-stepper-styles` - Debug stepper styles

## Assertion System

The `expect` field validates command results using deep equality:

```yaml
expect:
  success: true              # Simple value
  count: 5                   # Numbers
  values:                    # Nested objects
    field1: "value"
    field2: 42
  items: ["a", "b", "c"]     # Arrays
```

For log assertions, use the `assert-log-contains` command:

```yaml
- command: assert-log-contains
  args:
    - "[init:saveMod] Init function returned"
    - "initValue: 4"
```

## Running Tests

### Single test
```bash
./test-runner.mjs save-proficiency-toggle.yaml
```

### All tests
```bash
./test-runner.mjs all
```

### With npm scripts
```bash
npm run test:integration              # Run all tests
npm run test:integration:single -- save-proficiency-toggle.yaml
```

## Test Results

Results are automatically saved to `tests/integration/results/` as JSON files containing:
- Test execution details
- Step results
- Collected logs
- Duration metrics
- Success/failure status

## Writing New Tests

1. **Identify the feature to test** - What user interaction or behavior?
2. **Define test steps** - Break down into sequential commands
3. **Set debug config** - Enable relevant logging for debugging
4. **Add markers** - Use `log-marker` for important checkpoints
5. **Add assertions** - Validate both command results and logs
6. **Test cleanup** - Always close modals/reset state

## Example: Testing a Toggle Feature

```yaml
name: "Feature toggle test"
description: "Tests that toggling a feature updates related fields"

debugConfig:
  enabled: true
  logFields: ["toggleField", "dependentField"]
  logCategories: ["toggle", "init", "onChange"]

setup:
  - name: "Reload plugin"
    command: reload-plugin
    wait: 1000

steps:
  - name: "Open editor"
    command: edit-creature
    args: ["TestCreature"]
    wait: 500

  - name: "Add marker before toggle"
    command: log-marker
    args: ["Before toggle"]

  - name: "Toggle feature"
    command: click-element
    args: [".toggle-button"]
    wait: 200

  - name: "Add marker after toggle"
    command: log-marker
    args: ["After toggle"]

  - name: "Verify dependent field initialized"
    command: get-ability-values
    args: ["str"]
    expect:
      success: true
      values:
        toggleField: true
        dependentField: 42  # Expected init value

  - name: "Verify logs show initialization"
    command: assert-log-contains
    args:
      - "[init:dependentField]"
      - "initValue: 42"

cleanup:
  - name: "Close modal"
    command: close-modal
```

## Tips

- **Use descriptive step names** - Makes debugging easier
- **Add wait times** - UI updates need time to propagate
- **Check both results and logs** - Results show what, logs show why
- **Use markers liberally** - Helps correlate logs to test steps
- **Always cleanup** - Prevents state pollution between tests
- **Start simple** - Test one feature at a time
- **Test edge cases** - Not just the happy path
