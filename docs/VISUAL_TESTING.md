# Visual Testing Guide

This guide describes how to visually test UI components using the CLI tools.

## Prerequisites

1. Build the plugin: `npm run build`
2. Plugin must be loaded in Obsidian
3. IPC server must be running (automatically starts when plugin loads)

## Available Test Commands

### Open Dialogs

```bash
# Open creature creation dialog
./scripts/obsidian-cli.mjs edit-creature

# Open existing creature for editing
./scripts/obsidian-cli.mjs edit-creature "goblin-warrior"

# Other entity types
./scripts/obsidian-cli.mjs edit-spell "fireball"
./scripts/obsidian-cli.mjs edit-item "longsword"
./scripts/obsidian-cli.mjs edit-equipment "plate-armor"
```

### Navigate Between Sections

```bash
# Navigate to specific section in modal (case-sensitive)
./scripts/obsidian-cli.mjs navigate-to-section "Attribute"
./scripts/obsidian-cli.mjs navigate-to-section "Grunddaten"
./scripts/obsidian-cli.mjs navigate-to-section "Kampfwerte"
```

### Take Screenshots

```bash
# Take screenshot of current modal
./scripts/obsidian-cli.mjs screenshot-modal

# Screenshot is saved to: .obsidian/plugins/salt-marcher/screenshot.png
```

### Interact with Elements

```bash
# Click/focus an element by selector (e.g., open dropdown, click button)
./scripts/obsidian-cli.mjs click-element ".sm-cc-token-field__type-select"

# Click with custom wait time (ms)
./scripts/obsidian-cli.mjs click-element ".some-button" 500
```

### Measure UI Elements

```bash
# Measure all elements matching a selector
./scripts/obsidian-cli.mjs measure-ui ".sm-cc-field-heading" width height

# Measure labels in current section
./scripts/obsidian-cli.mjs measure-ui ".setting-item-info" width minWidth

# Measure number steppers
./scripts/obsidian-cli.mjs measure-ui ".sm-inline-number input" width
```

## Common Test Workflows

### Test Creature Attribute Labels

This workflow verifies that attribute labels (STR, DEX, CON, INT, WIS, CHA) are displayed correctly.

```bash
# 1. Open creature dialog
./scripts/obsidian-cli.mjs edit-creature

# 2. Navigate to Attribute section
./scripts/obsidian-cli.mjs navigate-to-section "Attribute"

# 3. Take screenshot
./scripts/obsidian-cli.mjs screenshot-modal

# 4. Verify heading elements exist
./scripts/obsidian-cli.mjs measure-ui ".sm-cc-field-heading" width height

# Expected: 6 heading elements with synchronized widths
```

**Reference Screenshot:** `docs/screenshots/creature-attributes-section.png`

**Expected Results:**
- 6 heading elements visible (STR, DEX, CON, INT, WIS, CHA)
- All headings have the same width (synchronized)
- Labels appear to the left of number stepper controls
- Labels use `<strong>` elements with class `.sm-cc-field-heading`

### Test Label Width Synchronization

```bash
# 1. Open dialog
./scripts/obsidian-cli.mjs edit-creature

# 2. Navigate to section with multiple labels
./scripts/obsidian-cli.mjs navigate-to-section "Grunddaten"

# 3. Measure all labels
./scripts/obsidian-cli.mjs measure-ui ".setting-item-info" width

# Expected: All labels in same section have equal width (variance < 1px)
```

### Test Number Stepper Width

```bash
# 1. Open dialog and navigate to attributes
./scripts/obsidian-cli.mjs edit-creature
./scripts/obsidian-cli.mjs navigate-to-section "Attribute"

# 2. Measure stepper inputs
./scripts/obsidian-cli.mjs measure-ui ".sm-inline-number input" width

# Expected: All steppers auto-sized to fit max value
```

### Test Structured Tags Dropdown

This workflow verifies that structured tag dropdowns (e.g., Bewegungsraten) display correct labels instead of "[object Object]".

```bash
# 1. Open creature dialog
./scripts/obsidian-cli.mjs edit-creature

# 2. Navigate to Grunddaten section
./scripts/obsidian-cli.mjs navigate-to-section "Grunddaten"

# 3. Click the dropdown to open it
./scripts/obsidian-cli.mjs click-element ".sm-cc-token-field__type-select"

# 4. Take screenshot
./scripts/obsidian-cli.mjs screenshot-modal

# 5. Verify dropdown element exists
./scripts/obsidian-cli.mjs measure-ui ".sm-cc-token-field__type-select" width height
```

**Note:** HTML `<select>` dropdowns use native OS widgets that don't appear in screenshots. Manual verification is required:
1. Open the creature dialog in Obsidian
2. Navigate to "Grunddaten" section
3. Click the "Bewegungsraten" dropdown
4. Verify options show labels like "walk", "fly", "swim" instead of "[object Object]"

**Reference Screenshot:** `docs/screenshots/creature-bewegungsraten-field.png` (shows closed dropdown)

**Expected Results:**
- Dropdown field with placeholder "Typ auswählen..."
- When opened, options display readable labels (walk, fly, swim, burrow, climb)
- NOT "[object Object]" for all options

## Reference Screenshots

Located in `docs/screenshots/`:

- `creature-attributes-section.png` - Attribute section with STR, DEX, CON, INT, WIS, CHA labels
- `creature-grunddaten-section.png` - Basic info section
- `creature-faehigkeiten-section.png` - Abilities section
- `creature-bewegungsraten-field.png` - Bewegungsraten field with closed dropdown
- (Add more as needed)

## Troubleshooting

### "Unknown command" Error

If dev commands are not available:

1. Check that dev-commands are imported in `src/app/main.ts`
2. Rebuild plugin: `npm run build`
3. Reload plugin: `./scripts/obsidian-cli.mjs reload-plugin salt-marcher`

### IPC Server Not Running

```bash
# Error: "Plugin IPC server not running"
# Solution: Make sure Obsidian is running and plugin is loaded
```

### Modal Not Found

```bash
# Error: "No modal found"
# Solution: Open a dialog first (edit-creature, etc.)
```

## Adding New Visual Tests

1. Create test workflow in this document
2. Take reference screenshot
3. Save to `docs/screenshots/` with descriptive name
4. Document expected DOM structure and measurements
5. Add to CI/CD if automated testing is needed

## Technical Details

### DOM Structure for Heading Fields

Correct structure (after fix):
```
.sm-cc-repeating-field
├── strong.sm-cc-field-heading  ← Label created here
└── div.sm-cc-field-control     ← Control container
    └── input
```

Incorrect structure (before fix):
```
.sm-cc-repeating-field
└── div.sm-cc-field-control
    ├── strong.sm-cc-field-heading  ← Wrong! Label inside control
    └── input
```

The fix was in `src/features/data-manager/fields/field-utils.ts:197`:
- **Before:** `renderHeadingCore({ container: controlContainer, ... })`
- **After:** `renderHeadingCore({ container: container, ... })`

This ensures heading labels are rendered at the correct DOM level, not nested inside the control container.
