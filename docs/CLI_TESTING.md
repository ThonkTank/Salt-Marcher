# CLI Testing System

The plugin provides an IPC server for automated UI testing via CLI commands.

## IPC Server
Unix socket at `.obsidian/plugins/salt-marcher/ipc.sock` enables CLI control.

## CLI Tool
`scripts/obsidian-cli.mjs` provides commands for:

### Plugin Control
```bash
node scripts/obsidian-cli.mjs reload-plugin              # Reload plugin
node scripts/obsidian-cli.mjs get-logs [lines]           # Get recent logs (default: 100)
node scripts/obsidian-cli.mjs import-presets [type]      # Import preset data (all/creatures/spells/items/equipment)
node scripts/obsidian-cli.mjs regenerate-indexes         # Regenerate vault indexes
```

### Entity Editing
```bash
node scripts/obsidian-cli.mjs edit-creature [name]       # Open creature editor (new or existing)
node scripts/obsidian-cli.mjs edit-spell [name]          # Open spell editor
node scripts/obsidian-cli.mjs edit-item [name]           # Open item editor
node scripts/obsidian-cli.mjs edit-equipment [name]      # Open equipment editor
```

### UI Testing & Validation (Dev-Only)
```bash
node scripts/obsidian-cli.mjs screenshot-modal           # Capture PNG screenshot
node scripts/obsidian-cli.mjs navigate-to-section NAME   # Navigate to section
node scripts/obsidian-cli.mjs click-element SELECTOR     # Click/focus element
node scripts/obsidian-cli.mjs set-input-value SELECTOR VALUE  # Set input field value
node scripts/obsidian-cli.mjs add-token FIELD_ID TOKEN   # Add token to structured tags field
node scripts/obsidian-cli.mjs validate-ui [mode]         # Validate layout (all|labels|steppers)
node scripts/obsidian-cli.mjs validate-grid-layout       # Validate CSS grid layouts
node scripts/obsidian-cli.mjs debug-stepper-styles       # Debug number stepper sizing
```

### Advanced UI Commands (Dev-Only)
```bash
node scripts/obsidian-cli.mjs measure-ui <selector> [dimensions...]
node scripts/obsidian-cli.mjs validate-ui-rule '[{rules}]'
node scripts/obsidian-cli.mjs validate-ui-config <config-name>
```

### Repeating Field Testing (Dev-Only)
```bash
node scripts/obsidian-cli.mjs toggle-save-checkbox <ability> <index>  # Toggle save proficiency
node scripts/obsidian-cli.mjs get-ability-values <ability>            # Get ability values
```

### Test Context Commands (Dev-Only)
```bash
node scripts/obsidian-cli.mjs start-test <test-id> [name]   # Begin test context
node scripts/obsidian-cli.mjs end-test                       # End test, return summary
node scripts/obsidian-cli.mjs log-marker <text>              # Add marker to logs
node scripts/obsidian-cli.mjs set-debug-config '{...}'      # Set debug configuration
node scripts/obsidian-cli.mjs get-debug-config               # Get current debug config
node scripts/obsidian-cli.mjs get-test-logs <test-id>        # Extract test logs
node scripts/obsidian-cli.mjs assert-log-contains <id> ...   # Assert log patterns
```

## Complete Test Workflow

1. **Enable Debug Logging** (optional):
   ```bash
   vim .claude/debug.json
   ```

2. **Make Changes & Build**:
   ```bash
   npm run build
   ```

3. **Reload Plugin**:
   ```bash
   node scripts/obsidian-cli.mjs reload-plugin
   ```

4. **Test UI**:
   ```bash
   node scripts/obsidian-cli.mjs edit-creature
   node scripts/obsidian-cli.mjs validate-ui all
   node scripts/obsidian-cli.mjs screenshot-modal
   ```

5. **Review Logs**:
   ```bash
   node scripts/obsidian-cli.mjs get-logs 100
   grep -E "\[.*:fieldName\]" CONSOLE_LOG.txt
   ```

## Layout Validation

### Expected Results
- **Labels**: Single-column sections synchronized, multi-column optimized per column
- **Number Steppers**: Width from max value + padding (e.g., max=30 → ~40px)
- **Grid Layouts**: 2x2 grid for token editors
- **Heading Fields**: `<strong>` elements at correct DOM level
- **Structured Tags**: Readable dropdown labels

### Examples
```bash
node scripts/obsidian-cli.mjs validate-ui all        # All elements
node scripts/obsidian-cli.mjs validate-ui labels     # Label widths only
node scripts/obsidian-cli.mjs validate-ui steppers   # Number steppers only
```

## Debug Logging
See `.claude/DEBUG.md` for configurable logging system.

## Visual Testing
See `docs/VISUAL_TESTING.md` for complete guide with screenshots.