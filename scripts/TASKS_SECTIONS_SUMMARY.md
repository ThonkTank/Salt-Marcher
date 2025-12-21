# Tasks Sections Added to Architecture Docs

## Summary

Added `## Tasks` sections to architecture documentation files that are referenced in the Development Roadmap.

## Files Modified

1. **Application.md** - 1 task
2. **Core.md** - 19 tasks
3. **EntityRegistry.md** - 17 tasks
4. **Error-Handling.md** - 7 tasks
5. **EventBus.md** - 8 tasks
6. **Events-Catalog.md** - 2 tasks
7. **Features.md** - 16 tasks
8. **Infrastructure.md** - 20 tasks

## Files Skipped (No Tasks)

- Conventions.md
- Data-Flow.md
- Glossary.md
- Project-Structure.md
- Testing.md
- Development-Roadmap.md (source, not target)

## Format

Each Tasks section follows this format:

```markdown
## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 1 | Task description | hoch | Ja | - | - |
```

- **No Status column** - Status is ephemeral, Development-Roadmap.md is the source of truth
- **Referenzen column** - Contains links to other docs referenced in the Spec column (excluding the home doc)
- **Tasks sorted by number** - Ascending order

## Scripts Created

1. `extract-tasks-by-spec.mjs` - Parses Development-Roadmap.md and groups tasks by Spec file
2. `add-tasks-sections.mjs` - Adds Tasks sections to each architecture doc

## Usage

```bash
# Extract tasks grouped by spec file (JSON output)
node scripts/extract-tasks-by-spec.mjs

# Add tasks sections to architecture docs
node scripts/add-tasks-sections.mjs
```

## Notes

- Script checks for existing Tasks sections to avoid duplicates
- Only tasks that reference the architecture doc in their Spec column are included
- Cross-references to other docs are automatically extracted and added to Referenzen column
