# Salt Marcher Dev Tools

Development and testing utilities for the Salt Marcher plugin. **This directory is excluded from production builds.**

## Structure

```
dev-tools/
├── ipc/                          # IPC command handlers for development
│   ├── dev-commands.ts           # Command implementations
│   └── register-dev-commands.ts  # Registration function
├── ui-measurement/               # Generic UI measurement and validation
│   ├── measurement-api.ts        # Core measurement API
│   ├── validation-engine.ts      # Rule-based validation system
│   ├── dom-utils.ts              # DOM traversal and selection utilities
│   └── configs/                  # Pre-configured validation rules
│       ├── create-modal.yaml     # Create modal validation config
│       └── README.md             # Configuration documentation
└── README.md                     # This file
```

## Usage

### IPC Commands

Dev commands are only available when running the plugin in development mode. They are registered via the IPC server but excluded from production builds.

**Available commands:**
- `screenshot-modal` - Capture current modal screenshot
- `validate-grid-layout` - Validate tag editor grid layouts
- `debug-stepper-styles` - Debug number stepper styles
- `validate-ui` - Validate UI layout (labels, steppers)
- `navigate-to-section` - Navigate to specific modal section
- `measure-ui` - Generic element measurement
- `validate-ui-rule` - Validate using single rule
- `validate-ui-config` - Validate using config file

### Generic Measurement API

```typescript
// Measure specific elements
measureElements({
  selector: '.sm-cc-setting',
  dimensions: ['width', 'height', 'minWidth'],
  groupBy: {
    ancestorSelector: '.sm-cc-card',
    extractLabel: '.sm-cc-card__title'
  },
  filter: (el) => el.offsetParent !== null  // Only visible elements
})

// Validate using rules
validateUI({
  rules: [
    {
      name: 'Label Width Synchronization',
      selector: '.setting-item-info',
      groupBy: { ancestorSelector: '.sm-cc-card', extractLabel: '.sm-cc-card__title' },
      dimension: 'width',
      expect: 'synchronized',
      tolerance: 1
    }
  ]
})
```

## Build Configuration

Dev tools are automatically excluded from production builds because:
1. They're located outside `src/` directory
2. esbuild only bundles from `src/app/main.ts` entry point
3. Conditional loading in `main.ts` prevents import in production

To verify exclusion:
```bash
npm run build
# Check main.js for any dev-tools/ references (should be none)
```

## Development

When adding new dev commands:
1. Add implementation to `dev-commands.ts`
2. Register in `register-dev-commands.ts`
3. Update this README with command documentation
4. Add validation config if applicable

## Notes

- Dev tools use TypeScript but are loaded dynamically
- They have access to all Obsidian APIs (via App instance)
- They can use Node.js APIs (fs, path, etc.)
- Validation configs use YAML for readability
