# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Update when**: Adding workmodes, changing build commands, refactoring architecture, modifying key patterns.

## Project Overview

Salt Marcher is an Obsidian plugin for D&D 5e campaign management with hex-based cartography, entity libraries (creatures/spells/items), and session tools. Data stored as Markdown with YAML frontmatter.

## Essential Commands

```bash
# Build & Test
npm run build                        # Build plugin (includes preset generation)
npm test                            # Run unit tests (vitest)
npm run test:contracts              # Contract tests only
npm run test:integration            # All integration tests
npm run test:integration:single <file>  # Single integration test
npm run test:ui                     # Run UI test workflow
npm run test:ui:validate            # Validate specific UI field
npm run test:all                    # All tests (unit + contracts + integration)
npm run golden:update               # Update golden test files
npx vitest run path/to/test.ts      # Single unit test

# Development
npm run obsidian:reload              # Reload plugin via CLI
npm run obsidian:logs                # Get recent plugin logs
node scripts/obsidian-cli.mjs edit-creature [name]   # Open entity editor
node scripts/obsidian-cli.mjs reload-plugin          # Reload plugin
node scripts/obsidian-cli.mjs import-presets [type]  # Import presets
```

**Build Process**: `scripts/generate-preset-data.mjs` bundles `/Presets/` → `Presets/lib/preset-data.ts` → `main.js`

## Architecture

### Recent Evolution (Oct 2025)
- Generalized data-manager/browse system with auto-generation from CreateSpecs
- Entity-first library organization (creatures/, spells/, etc.)
- Storage migration: Creatures use declarative specs, others use legacy serializers (identical output)

### Core Structure
```
src/
├── workmodes/          # Self-contained applications
│   ├── cartographer/  # Hex map editor
│   ├── library/        # Entity browser (creatures/spells/items/equipment)
│   └── session-runner/ # Campaign sessions
├── features/
│   ├── data-manager/   # Generic CRUD (modal/browse/fields/storage)
│   └── maps/           # Hex rendering, terrain management
└── app/                # Plugin bootstrap

Presets/                # Bundled preset data
├── lib/                # Registry, loaders, generated data
└── {EntityType}/       # Preset markdown files
```

### Key Systems

**CreateSpec Pattern**: Declarative entity definitions with fields, storage, browse config
```typescript
// src/workmodes/library/{entity}/index.ts
export const spec: CreateSpec = {
  fields: [...],           // Field definitions
  storage: {               // Frontmatter mapping
    format: "markdown",
    path: "SaltMarcher/{type}/{name}.md",
    frontmatter: { ... }
  },
  browse: { ... }          // Optional, auto-generated if omitted
}
```

**Auto-Generation**: ViewConfigs, ListSchemas, actions, loaders derived from specs
- `data-manager/browse/spec-to-config.ts` - Spec → Config conversion
- `data-manager/browse/auto-config.ts` - Generate actions/handlers
- `data-manager/browse/auto-loader.ts` - Generic frontmatter loading

**Registry**: Central type-safe access in `src/workmodes/library/registry.ts`

## Common Tasks

### Add New Entity Type
1. Create `src/workmodes/library/{entity}/index.ts` with CreateSpec
2. Register in `src/workmodes/library/registry.ts`
3. Add to `Presets/lib/entity-registry.ts` and `plugin-presets.ts`
4. Create `Presets/{EntityType}/` folder

### Add New Workmode
1. Create `src/workmodes/{name}/` with view/controller
2. Register in `src/workmodes/view-manifest.ts`

## Testing & Debugging

### Quick Debug
```bash
# Configure logging
echo '{"enabled": true, "logFields": ["fieldName"], "logCategories": ["init"]}' > .claude/debug.json

# Reload and test
node scripts/obsidian-cli.mjs reload-plugin
node scripts/obsidian-cli.mjs edit-creature

# Check logs
grep -E "\[init:fieldName\]" CONSOLE_LOG.txt
```

### Documentation
- **CLI Testing**: `docs/CLI_TESTING.md` - IPC commands, UI validation
- **Integration Tests**: `docs/INTEGRATION_TESTING.md` - YAML test system
- **Debug Logging**: `.claude/DEBUG.md` - Configurable logging
- **Visual Testing**: `docs/VISUAL_TESTING.md` - Screenshots, manual verification
- **Storage**: `docs/storage-formats.md` - Entity storage formats
- **Presets**: `docs/PRESETS.md` - Preset bundling/import

### Dev Tools
`dev-tools/` directory (not in production build) provides measurement/validation APIs. Conditionally loaded via `require()` in development.

## Key Patterns

- **Context Objects**: Dependency injection via context parameters
- **Repository Pattern**: Data access through repository functions
- **Lifecycle Handles**: Services return cleanup functions
- **Type-Safe Frontmatter**: `smType` field identifies entities

## Important Notes

- Use Obsidian vault API, not Node.js fs
- Use `plugin-logger.ts`, not console.log
- German UI strings (historical) - use `translator.ts`
- Forward slashes `/` for paths (Obsidian normalizes)