# Preset System Documentation

This document explains the preset system used in the SaltMarcher plugin.

## Overview

The SaltMarcher plugin includes a **single preset system** that provides a curated library of reference data (creatures, spells, items, equipment, terrains, and regions). The system follows a simple three-phase pipeline:

1. **Build Phase** - Bundle preset files into the plugin
2. **Import Phase** - Import bundled presets into the user's vault (first load only)
3. **Runtime Phase** - All entities are treated equally (no distinction between presets and user-created entities)

After import, preset entities are stored in the vault alongside user-created entities using the **unified storage system**. The plugin makes no distinction between imported presets and user-created entities.

## How It Works

### Phase 1: Build-Time Bundling

**Location:** `/Presets/{EntityType}/`
**Output:** `Presets/lib/preset-data.ts`

During the build process:

```bash
npm run build
```

1. `scripts/generate-preset-data.mjs` reads all `.md` files from `/Presets/`
2. File contents are bundled into `preset-data.ts` as string constants
3. Build output shows counts:
   ```
   Found 329 creature presets, 338 spell presets, 243 item presets,
   146 equipment presets, 4 terrain presets, and 1 region presets
   ```

**Source Structure:**
```
/Presets/
├── Creatures/
│   ├── Animals/
│   │   ├── Wolf.md
│   │   └── Bear.md
│   └── Monsters/
│       ├── Goblin.md
│       └── Dragon.md
├── Spells/
│   ├── Cantrips/
│   └── Level-1/
├── Items/
├── Equipment/
├── Terrains/
└── Regions/
```

### Phase 2: First-Load Import

**Logic:** `Presets/lib/plugin-presets.ts`
**Trigger:** `src/app/main.ts` on plugin load

On the first time the plugin loads:

1. Check for marker file (e.g., `.plugin-presets-imported`)
2. If not found:
   - Call `importPluginPresets()` for each entity type
   - Create `.md` files in `SaltMarcher/{EntityType}/`
   - Each preset becomes a regular vault file
   - Create marker file to prevent re-import

**Example:**
```typescript
// In main.ts
if (await shouldImportPluginPresets(this.app)) {
    await importPluginPresets(this.app);
}
```

**Result:** Preset files are created in the vault:
```
SaltMarcher/
├── Creatures/
│   ├── Wolf.md
│   ├── Bear.md
│   ├── Goblin.md
│   ├── Dragon.md
│   └── .plugin-presets-imported (marker)
├── Spells/
│   └── .plugin-spells-imported (marker)
├── Items/
├── Equipment/
├── Terrains/
└── Regions/
```

### Phase 3: Runtime - Unified Storage

**Storage:** `src/workmodes/library/storage/data-sources.ts`
**Loading:** `Presets/lib/vault-preset-loader.ts`

At runtime, **all entities are treated equally**:

- Imported preset files = User-created files
- Same directory structure
- Same loading mechanism
- Same edit/delete capabilities
- Same display in browse views

The plugin does **not** distinguish between:
- Entities imported from bundled presets
- Entities created by the user via create modal
- Entities manually created in the vault

**Generic Loading:**
```typescript
import { listVaultPresets } from "../../../../Presets/lib/vault-preset-loader";

// List all creatures (presets + user entities)
const files = await listVaultPresets(app, "creatures");

// Find entities by filter
const undead = await findVaultPresets(app, "creatures",
  (fm) => fm.type === "undead"
);

// Get unique categories
const types = await getVaultPresetCategories(app, "creatures", "type");
```

## Directory Structure

### Repository (Development)
```
/Presets/               # Source preset files AND library code
├── lib/                # Preset system implementation
│   ├── entity-registry.ts     # Entity type definitions
│   ├── plugin-presets.ts      # Import logic
│   ├── vault-preset-loader.ts # Generic loader
│   └── preset-data.ts         # Generated at build (bundled presets)
├── Creatures/
├── Spells/
├── Items/
├── Equipment/
├── Terrains/
└── Regions/

scripts/
└── generate-preset-data.mjs   # Build script

src/workmodes/library/
├── core/
│   ├── index-files.ts         # Library index generators
│   └── sources.ts             # Library source setup
└── storage/
    └── data-sources.ts        # Entity loaders
```

### User Vault (Runtime)
```
SaltMarcher/
├── Creatures/
│   ├── Wolf.md              # From preset
│   ├── Custom Monster.md    # User-created
│   └── .plugin-presets-imported
├── Spells/
│   ├── Fireball.md          # From preset
│   └── Custom Spell.md      # User-created
├── Items/
├── Equipment/
├── Terrains/
└── Regions/
```

## Adding New Presets

To add new preset entities to the plugin:

### 1. Create Preset File

Create a new `.md` file in `/Presets/{EntityType}/`:

```markdown
---
smType: creature
name: "Owlbear"
size: "Large"
type: "monstrosity"
# ... all required fields
---

# Owlbear

A terrifying hybrid of owl and bear...
```

### 2. Build Plugin

```bash
npm run build
```

The preset will be bundled into `preset-data.ts`.

### 3. Test Import

On next plugin load (or fresh vault), the preset will be automatically imported to `SaltMarcher/Creatures/Owlbear.md`.

### 4. Verify

Check that:
- File appears in Library browse view
- File can be edited like any other entity
- File has correct frontmatter

## Best Practices

### ✅ Do

**Add presets via `/Presets/` directory:**
```bash
# 1. Create preset file
echo '---\nsmType: creature\nname: "Goblin"\n---' > Presets/Creatures/Goblin.md

# 2. Build to bundle
npm run build

# 3. Preset auto-imports on next load
```

**Load entities generically:**
```typescript
// Works for all entity types
const creatures = await listVaultPresets(app, "creatures");
const spells = await listVaultPresets(app, "spells");
```

**Use entity registry for paths:**
```typescript
import { ENTITY_REGISTRY } from "../../../../Presets/lib/entity-registry";
const dir = ENTITY_REGISTRY.creatures.directory; // "SaltMarcher/Creatures"
```

### ❌ Don't

**Don't hardcode directory paths:**
```typescript
// ❌ Bad
const files = app.vault.getFiles().filter(f =>
  f.path.startsWith("SaltMarcher/Creatures/")
);

// ✅ Good
const files = await listVaultPresets(app, "creatures");
```

**Don't treat presets differently from user entities:**
```typescript
// ❌ Bad - trying to distinguish presets
if (file.path.includes("preset")) { /* ... */ }

// ✅ Good - treat all entities equally
const creatures = await listVaultPresets(app, "creatures");
```

**Don't modify `preset-data.ts` manually:**
```typescript
// ❌ Bad - editing generated file
export const PRESET_CREATURES = {
  "Goblin": "...", // Don't edit this!
};

// ✅ Good - add preset to source
// Create Presets/Creatures/Goblin.md and rebuild
```

## Common Pitfalls

### ❌ Pitfall: Confusing build output with runtime storage

**Problem:**
```typescript
// This is build-time bundled data
import { PRESET_CREATURES } from "../../../../Presets/lib/preset-data";

// This is runtime vault storage
const creatures = await listVaultPresets(app, "creatures");
```

**Understand:**
- `PRESET_CREATURES` = String constants for import
- Vault files = Runtime storage after import
- At runtime, use vault loader, not bundled data

### ❌ Pitfall: Re-importing on every load

**Problem:**
The import only happens once (first load). If marker files exist, import is skipped.

**To force re-import:**
```bash
# Using CLI (recommended)
./scripts/obsidian-cli.mjs import-presets creatures --force

# Or delete marker files manually
rm SaltMarcher/Creatures/.plugin-presets-imported
# Then reload plugin
./scripts/obsidian-cli.mjs reload-plugin
```

**CLI Import Commands:**
```bash
# Import all categories with force option (delete and recreate)
./scripts/obsidian-cli.mjs import-presets all --force

# Import specific category
./scripts/obsidian-cli.mjs import-presets creatures --force
./scripts/obsidian-cli.mjs import-presets spells --force

# Available categories: creatures, spells, items, equipment, terrains, regions, calendars, all
```

### ❌ Pitfall: Editing imported presets doesn't update bundle

**Problem:**
User edits `SaltMarcher/Creatures/Goblin.md` in their vault. This does NOT update the bundled preset.

**Understand:**
- Vault files are independent after import
- To update bundled preset: Edit `/Presets/Creatures/Goblin.md` and rebuild
- User edits stay in their vault only

### ❌ Pitfall: Expecting preset-only queries

**Problem:**
```typescript
// Can't query "only presets" at runtime
const onlyPresets = await getOnlyBundledPresets(app, "creatures"); // ❌ Doesn't exist
```

**Understand:**
After import, there is no distinction. All entities are vault entities. If you need to identify bundled presets, add a custom frontmatter field during import:
```yaml
---
smType: creature
name: "Goblin"
source: "plugin-preset"  # Custom marker
---
```

## Adding a New Entity Type

To add support for a new entity type to the preset system:

1. **Create preset files** in `/Presets/{NewEntityType}/`
2. **Extend build script** (`scripts/generate-preset-data.mjs`):
   ```javascript
   const NEW_PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'NewEntityType');
   const newFiles = getMarkdownFiles(NEW_PRESETS_DIR);
   moduleContent += formatPresetMap('PRESET_NEW_ENTITY_TYPE', newFiles);
   ```
3. **Register entity** in `Presets/lib/entity-registry.ts`
4. **Add import functions** in `Presets/lib/plugin-presets.ts`
5. **Add import call** in `src/app/main.ts`
6. **Test build and import**

## Summary

The SaltMarcher preset system is simple:

1. **Build** - Bundle preset files into plugin code
2. **Import** - Copy bundled presets to vault (first load only)
3. **Runtime** - Everything is a vault entity (unified storage)

After import, the plugin treats all entities equally. There is no runtime distinction between preset entities and user-created entities. All entities live in `SaltMarcher/{EntityType}/` and use the same storage, loading, and editing mechanisms.
