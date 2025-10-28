# Salt Marcher Documentation

Welcome to the Salt Marcher plugin documentation.

## Getting Started

### For Development

```bash
# 1. Setup DevKit
source devkit/core/cli/devkit-completion.bash

# 2. Start developing
./devkit-cli plugin reload                  # Reload plugin
./devkit-cli ui open creature goblin        # Test UI
./devkit-cli debug logs 100                 # View logs

# 3. Run tests
npm test                                    # Unit tests
./devkit-cli test watch                     # Integration tests (watch mode)
```

See **[devkit/README.md](../devkit/README.md)** for complete DevKit documentation.

### For Debugging

When something doesn't work, follow these workflows:
- **[DEBUGGING.md](DEBUGGING.md)** - Step-by-step debugging guides for common issues

## Documentation Index

### Core Plugin Documentation

| Document | Description |
|----------|-------------|
| **[TESTING.md](TESTING.md)** | Complete testing guide (unit, integration, UI validation) |
| **[DEBUGGING.md](DEBUGGING.md)** | Debug workflows for fixing common issues quickly |
| **[storage-formats.md](storage-formats.md)** | Entity storage formats and CreateSpec system |
| **[PRESETS.md](PRESETS.md)** | Preset bundling and import system |

### Development Tools

| Document | Description |
|----------|-------------|
| **[devkit/README.md](../devkit/README.md)** | Complete DevKit reference (CLI commands, tests, debug tools) |

### Quick Reference

**Testing**:
```bash
npm test                        # Unit tests (Vitest)
./devkit-cli test run all       # Integration tests
./devkit-cli test watch         # Watch mode
./devkit-cli ui validate        # UI validation
```

**Debugging**:
```bash
./devkit-cli debug enable --all             # Enable debug logging
./devkit-cli debug field passivesList --creature aboleth  # Inspect field
./devkit-cli debug logs 200                 # View logs
./devkit-cli doctor                         # Health check
```

**Plugin Control**:
```bash
./devkit-cli plugin reload      # Reload once
./devkit-cli plugin watch       # Hot reload on changes
```

## Project Structure

```
.
├── src/                    # Plugin source code
│   ├── app/               # Plugin bootstrap & core
│   ├── features/          # Shared features (data-manager, maps, etc.)
│   └── workmodes/         # Self-contained applications
│
├── devkit/                # All development tools
│   ├── core/             # CLI & IPC
│   ├── testing/          # Unit & integration tests
│   ├── validation/       # UI validation
│   ├── migration/        # Data migrations
│   └── utilities/        # Dev scripts
│
├── docs/                  # Documentation (this folder)
│   ├── TESTING.md        # Testing guide
│   ├── DEBUGGING.md      # Debug workflows
│   ├── storage-formats.md # Storage specifications
│   └── PRESETS.md        # Preset system
│
└── Presets/               # Bundled preset data
    └── lib/              # Generated preset registry
```

## Common Tasks

### Adding a New Entity Type

1. Create `src/workmodes/library/{entity}/create-spec.ts` with CreateSpec
2. Create `src/workmodes/library/{entity}/serializer.ts` with body renderer
3. Register in `src/workmodes/library/registry.ts`
4. Add to `Presets/lib/entity-registry.ts`
5. Create `Presets/{EntityType}/` folder

See [storage-formats.md](storage-formats.md) for details.

### Fixing a Bug

1. **Reproduce** - `./devkit-cli ui open {type} {name}`
2. **Debug** - `./devkit-cli debug field {fieldId} --{type} {name}`
3. **Fix** - Edit code
4. **Test** - `./devkit-cli plugin reload` and verify
5. **Add Test** - Write YAML integration test

See [DEBUGGING.md](DEBUGGING.md) for detailed workflows.

### Running Tests

1. **Unit Tests** - `npm test` or `npx vitest watch`
2. **Integration Tests** - `./devkit-cli test run all` or `./devkit-cli test watch`
3. **UI Validation** - `./devkit-cli ui validate`
4. **All Tests** - `npm run test:all`

See [TESTING.md](TESTING.md) for complete testing guide.

## For AI Assistants (Claude, etc.)

### Where to Start

1. **Read** `devkit/README.md` - Complete DevKit documentation
2. **Scan** `DEBUGGING.md` - Common issue workflows
3. **Reference** `TESTING.md` - How to test changes

### Key Files

- **CreateSpecs**: `src/workmodes/library/{entity}/create-spec.ts` - Entity definitions
- **Serializers**: `src/workmodes/library/{entity}/serializer.ts` - Markdown generation
- **Registry**: `src/workmodes/library/registry.ts` - Entity type registration
- **DevKit CLI**: `devkit/core/cli/devkit.mjs` - All CLI commands
- **IPC Commands**: `devkit/core/ipc/register-dev-commands.ts` - Plugin communication

### Debug Workflow for AI

When helping with a bug:

```bash
# 1. Health check
./devkit-cli doctor

# 2. Reproduce issue
./devkit-cli ui open creature {name}

# 3. Inspect problematic field
./devkit-cli debug field {fieldId} --creature {name}
# → Shows: code location, rendering pipeline, field state, diagnosis

# 4. Check logs
./devkit-cli debug logs 200 | grep {fieldId}

# 5. Make fix and test
./devkit-cli plugin reload
```

See [DEBUGGING.md](DEBUGGING.md) for detailed workflows covering:
- UI field not working (~10 min)
- Preset not loading (~5 min)
- Modal not opening (~5 min)
- Token field issues (~5 min)
- Value not saving (~10 min)

### Anti-Patterns to Avoid

1. **Don't** assume data format issues without checking DOM first
2. **Don't** mass-edit files - fix the source (presets)
3. **Don't** skip reproduction - always see the problem first
4. **Don't** build multiple times - build once, test thoroughly
5. **Don't** create complex solutions - usually need a 1-line fix

## Contributing

### Adding New Features

1. Implement feature in `src/`
2. Add tests in `devkit/testing/`
3. Update relevant docs
4. Run `npm run test:all`

### Updating Documentation

- **Plugin features** → Update `docs/` files
- **DevKit tools** → Update `devkit/README.md`
- **Debug workflows** → Update `docs/DEBUGGING.md`

### Code Style

- Use Obsidian vault API, not Node.js fs
- Use `plugin-logger.ts`, not console.log
- Forward slashes `/` for paths (Obsidian normalizes)
- Type-safe frontmatter with `smType` field

## Getting Help

1. **Check docs** - Start with this README
2. **Run doctor** - `./devkit-cli doctor` for health check
3. **Debug workflows** - See [DEBUGGING.md](DEBUGGING.md)
4. **Test guide** - See [TESTING.md](TESTING.md)
5. **DevKit reference** - See [devkit/README.md](../devkit/README.md)

## Version History

- **v3.0** (Oct 2025) - Unified CreateSpec system, generalized data-manager
- **v2.5** - DevKit consolidation, field inspector
- **v2.0** - Integration test framework, UI validation
- **v1.0** - Initial release
