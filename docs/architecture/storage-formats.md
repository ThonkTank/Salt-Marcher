# Storage Formats Architecture

## Overview

All entities in SaltMarcher use a **unified storage format**: Markdown files (`.md`) with YAML frontmatter stored in the Obsidian vault.

## Storage Format Structure

```markdown
---
smType: creature
name: "Goblin"
size: "Small"
# ... more frontmatter fields
---

# Goblin
*Small humanoid, Neutral Evil*

AC 15    Initiative +2
HP 7 (2d6)

## Traits
...
```

## Current Implementation

### Entity-Specific Serializers

Each entity type currently has its own markdown serialization function:

- **Creatures**: `src/workmodes/library/core/creature-files.ts:222` → `statblockToMarkdown()`
- **Spells**: `src/workmodes/library/core/spell-files.ts` → `spellToMarkdown()`
- **Items**: `src/workmodes/library/core/item-files.ts` → `itemToMarkdown()`
- **Equipment**: `src/workmodes/library/core/equipment-files.ts` → `equipmentToMarkdown()`

All of these functions produce the same output structure:
1. YAML frontmatter block (`---\nfields\n---`)
2. Markdown body content

**These are migration artifacts** from before the unified creation system existed.

### Generic Storage System

The new declarative creation system uses a generic storage layer:

**Location**: `src/features/data-manager/edit/storage/storage.ts`

**Key Functions**:
- `buildSerializedPayload()` - Creates serialized content from spec + values
- `serializeMarkdown()` - Generic markdown serialization
- `buildFrontmatter()` - Maps field values to frontmatter keys
- `buildMarkdownBody()` - Generates body from template or field list
- `persistSerializedPayload()` - Writes to vault

**Used by**: Creatures via `creatureSpec.storage` configuration

```typescript
// Example from creature-spec.ts:408-418
storage: {
  format: "md-frontmatter",
  pathTemplate: "SaltMarcher/Creatures/{name}.md",
  filenameFrom: "name",
  directory: "SaltMarcher/Creatures",
  frontmatter: ["name", "size", "type", "abilities", ...]
}
```

## Why Multiple Code Paths Exist

The codebase is **in transition** from imperative to declarative creation systems:

- **Creatures** → Fully migrated to declarative spec-based system (`creature-spec.ts`)
- **Spells/Items/Equipment** → Still use imperative modal classes with entity-specific serializers

Both paths produce identical output (`.md` files with frontmatter), but via different code:
- Old path: `new CreateSpellModal()` → `spellToMarkdown()` → vault write
- New path: `openCreateModal(spec)` → `buildSerializedPayload()` → `persistSerializedPayload()`

## Future Consolidation (Phase 2)

### Goal
Migrate all entities to the unified spec-based system.

### Benefits
- **Single source of truth** for markdown serialization logic
- **Reduced code duplication** (~500-800 LOC reduction estimated)
- **Consistent API** for all CRUD operations
- **Easier maintenance** - changes to storage format only need to be made once

### Migration Path
1. Create `spell-spec.ts`, `item-spec.ts`, `equipment-spec.ts` (like `creature-spec.ts`)
2. Convert imperative `buildFields()` methods to declarative field arrays
3. Remove entity-specific modals in favor of unified `openCreateModal()`
4. Remove entity-specific `*ToMarkdown()` functions
5. All entities use generic `storage.ts` via their spec configuration

### Impact
- **LOC Reduction**: ~500-800 lines
- **Breaking Changes**: None (output format remains identical)
- **Testing**: Verify existing .md files can still be read/edited

## Summary

| Aspect | Current State | Unified Vision |
|--------|--------------|----------------|
| **Output Format** | ✅ Already unified (.md + frontmatter) | ✅ No change |
| **Serialization Code** | ⚠️ Duplicated (4 `*ToMarkdown()` functions) | ✅ Single `serializeMarkdown()` |
| **Creation API** | ⚠️ Mixed (specs + modals) | ✅ Single `openCreateModal(spec)` |
| **Maintenance Burden** | ⚠️ High (4 code paths) | ✅ Low (1 code path) |

**Key Takeaway**: The storage *format* is already unified - only the code paths to produce it need consolidation.
