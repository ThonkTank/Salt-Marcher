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

### Entity-Specific Body Serializers

Each entity type has its own markdown body serialization function (frontmatter handled separately by data-manager):

- **Creatures**: `src/workmodes/library/creatures/serializer.ts` → `statblockToMarkdown()`
- **Spells**: `src/workmodes/library/spells/serializer.ts` → `spellToMarkdown()`
- **Items**: `src/workmodes/library/items/serializer.ts` → `itemToMarkdown()`
- **Equipment**: `src/workmodes/library/equipment/serializer.ts` → `equipmentToMarkdown()`
- **Calendars**: `src/workmodes/library/calendars/serializer.ts` → `calendarToMarkdown()`
- **Terrains**: `src/workmodes/library/terrains/serializer.ts` → `terrainToMarkdown()`
- **Regions**: `src/workmodes/library/regions/serializer.ts` → `regionToMarkdown()`

These functions are used as `bodyTemplate` in CreateSpecs and generate only the markdown body content.
Frontmatter serialization is handled generically by the storage system.

### Generic Storage System

All declarative CreateSpecs use a unified generic storage layer:

**Location**: `src/features/data-manager/storage/storage.ts`

**Exported Functions**:
- `buildSerializedPayload()` - Creates serialized content from spec + values
- `persistSerializedPayload()` - Writes to vault

**Internal Functions** (not exported):
- `serializeMarkdown()` - Generic markdown serialization (frontmatter + body)
- `buildFrontmatter()` - Maps field values to frontmatter keys
- `buildMarkdownBody()` - Generates body from bodyTemplate or bodyFields
- `serializeJson()`, `serializeYaml()`, `serializeCodeblock()` - Format-specific serializers

**Used by**: All entity types via their CreateSpec `storage` configuration

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

## Current Architecture

All entity types now use the **unified declarative CreateSpec system**:

- **All entities** (Creatures, Spells, Items, Equipment, Calendars, Terrains, Regions) → Declarative spec-based system
- Each entity defines a CreateSpec in `src/workmodes/library/{entity}/create-spec.ts`
- Body serialization via entity-specific `*ToMarkdown()` functions (used as `bodyTemplate`)
- Frontmatter serialization via generic storage system

**Unified code path:**
1. User fills in modal fields
2. `buildSerializedPayload(spec.storage, values)` creates content:
   - Frontmatter: generic `buildFrontmatter()` from spec.storage.frontmatter
   - Body: entity-specific `bodyTemplate()` function (e.g., `statblockToMarkdown()`)
3. `persistSerializedPayload()` writes to vault

## Future Optimization Opportunities

While all entity types now use the unified CreateSpec system, there are still optimization opportunities:

### Optional: Consolidate Body Serializers

Currently each entity has its own `*ToMarkdown()` function. These could potentially be:
- Replaced with generic template-based rendering
- Consolidated using a markdown DSL or template system
- Kept as-is for maximum flexibility (current approach)

**Trade-offs:**
- **Current approach**: Maximum flexibility, easy to customize per-entity
- **Template consolidation**: Less code, harder to customize, potential loss of format control

**Recommendation**: Keep current approach unless significant duplication emerges.

## Summary

| Aspect | Status |
|--------|--------|
| **Output Format** | ✅ Unified (.md + frontmatter for all entities) |
| **Frontmatter Serialization** | ✅ Generic system (`buildFrontmatter()` in storage.ts) |
| **Body Serialization** | ✅ Entity-specific functions used as bodyTemplate |
| **Creation API** | ✅ Unified CreateSpec system for all entities |
| **Storage Layer** | ✅ Generic `buildSerializedPayload()` + `persistSerializedPayload()` |

**Key Takeaway**: All entities now use the unified declarative CreateSpec system with generic frontmatter handling and entity-specific body templates for maximum flexibility.
