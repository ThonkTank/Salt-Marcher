# UI Validation Configs

Pre-configured validation rules for common UI patterns.

## Config Format

Configs can be defined in YAML or JSON format. Each config contains an array of validation rules.

### Rule Structure

```yaml
rules:
  - name: "Human-readable rule name"
    selector: ".css-selector"
    dimension: "width" | "height" | "minWidth" | ...
    expect: "synchronized" | "range" | "exact" | "min" | "max"
    value: 100           # For exact/min/max
    maxValue: 200        # For range
    tolerance: 1         # Allowed variance
    groupBy:             # Optional - group by ancestor
      ancestorSelector: ".parent"
      extractLabel: ".label-selector"
```

## Available Configs

### create-modal.yaml
Comprehensive validation for the create modal:
- Label width synchronization per section
- Number stepper width validation
- Grid layout validation for tag editors
- Multi-column layout detection

### library-view.yaml
Validation for library list views:
- Item card dimensions
- Filter button alignment
- Search box sizing

### cartographer.yaml
Validation for map editor:
- Tool palette sizing
- Hex grid alignment
- Control panel layout

## Usage Examples

### Via CLI

```bash
# Run specific config
./scripts/ipc.sh validate-ui-config create-modal

# Run custom rules
./scripts/ipc.sh validate-ui-rule '[{"name":"Test","selector":".modal","dimension":"width","expect":"min","value":600}]'

# Measure specific elements
./scripts/ipc.sh measure-ui .setting-item width height
```

### Via Code

```typescript
import { validateUI } from '../validation-engine';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

// Load config
const configContent = fs.readFileSync('./configs/create-modal.yaml', 'utf-8');
const config = yaml.load(configContent);

// Run validation
const report = validateUI(config.rules);
console.log(formatReport(report));
```

## Creating Custom Configs

1. Create a new YAML/JSON file in this directory
2. Define your validation rules
3. Test with: `./scripts/ipc.sh validate-ui-config <config-name>`

### Example: Validate Modal Widths

```yaml
name: modal-widths
description: Ensure all modals have consistent widths
rules:
  - name: "Modal minimum width"
    selector: ".modal"
    dimension: "width"
    expect: "min"
    value: 600

  - name: "Modal maximum width"
    selector: ".modal"
    dimension: "width"
    expect: "max"
    value: 1200
```

## Validation Types

### synchronized
Elements should have the same value (±tolerance).
Best for: Label alignment, column widths

### exact
Elements must match a specific value (±tolerance).
Best for: Fixed dimensions, specific sizes

### min/max
Elements must be above/below a threshold.
Best for: Minimum widths, maximum heights

### range
Elements must fall within a range [min, max].
Best for: Responsive dimensions, flexible layouts

## Tips

- Use `groupBy` to validate each section separately
- Set reasonable `tolerance` values (1-2px for pixel-perfect, 5-10px for flexible)
- Filter visible elements only with `filter: (el) => el.offsetParent !== null`
- Test in different viewport sizes
- Document expected values and why they matter