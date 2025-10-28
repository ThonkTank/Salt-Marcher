# DevKit Scripts

All utility scripts for development, maintenance, and data management.

## Directory Structure

```
scripts/
├── conversions/     # Data format conversions
├── maintenance/     # Cleanup and maintenance utilities
├── parsers/        # Reference and data parsers
├── testing/        # Test utilities and loaders
├── fixes/          # Bug fixes and patches
└── README.md       # This file
```

## Categories

### Conversions (`conversions/`)
Scripts for converting data between different formats.

- `convert-references.mjs` - Convert all entity references
- `convert-item-references.mjs` - Convert item references to new format
- `convert-spell-references.mjs` - Convert spell references to new format

**Usage:**
```bash
node devkit/scripts/conversions/convert-references.mjs
```

### Maintenance (`maintenance/`)
Scripts for cleaning up and maintaining the codebase.

- `cleanup-lowercase-presets.mjs` - Clean up duplicate lowercase preset files
- `rename-presets.mjs` - Rename preset files to consistent format
- `reconvert-presets.mjs` - Re-convert all presets with latest format

**Usage:**
```bash
node devkit/scripts/maintenance/cleanup-lowercase-presets.mjs
```

### Parsers (`parsers/`)
Scripts for parsing reference data from various sources.

- `parse-equipment-references.mjs` - Parse equipment references from markdown

**Usage:**
```bash
node devkit/scripts/parsers/parse-equipment-references.mjs
```

### Testing (`testing/`)
Test utilities and preset loaders.

- `test-preset-loading.mjs` - Test preset loading functionality

**Usage:**
```bash
node devkit/scripts/testing/test-preset-loading.mjs
```

### Fixes (`fixes/`)
Scripts for fixing specific issues.

- `fix-speeds-unit.mjs` - Fix speed unit formatting issues

**Usage:**
```bash
node devkit/scripts/fixes/fix-speeds-unit.mjs
```

## Common Patterns

### Running Scripts
All scripts can be run directly with Node.js:
```bash
node devkit/scripts/<category>/<script-name>.mjs
```

### Script Arguments
Many scripts accept arguments:
```bash
node devkit/scripts/conversions/convert-references.mjs --dry-run
node devkit/scripts/maintenance/cleanup-lowercase-presets.mjs --verbose
```

### Batch Operations
Run multiple related scripts:
```bash
# Convert all references
for script in devkit/scripts/conversions/*.mjs; do
  node "$script"
done
```

## Adding New Scripts

1. Create script in appropriate category directory
2. Use `.mjs` extension for ES modules
3. Add documentation header:
   ```javascript
   #!/usr/bin/env node
   /**
    * Script: script-name.mjs
    * Purpose: Brief description
    * Usage: node devkit/scripts/category/script-name.mjs [options]
    */
   ```
4. Update this README with script description

## Migration History

These scripts were migrated from the top-level `scripts/` directory to provide better organization and clarity. The original `scripts/` directory now only contains:
- Build-time wrapper (compatibility)
- The main build script is in the root: `generate-preset-data.mjs`

## Tips

- Use `--dry-run` when available to preview changes
- Always backup data before running conversion scripts
- Check git diff after running maintenance scripts
- Run tests after any major conversion

## Related

- Main DevKit CLI: `./devkit/cli/devkit`
- Test Framework: `devkit/test/`
- Migration Tools: `devkit/migrate/`