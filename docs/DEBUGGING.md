# Debug Workflows

This guide provides step-by-step workflows for quickly diagnosing and fixing common issues.

**Goal**: Fix bugs in ~10 minutes instead of ~1 hour by following the right path from the start.

## General Debugging Principles

1. **See the problem first** - Always reproduce and observe before analyzing code
2. **Start at the symptom** - Don't jump to assumptions about the cause
3. **Use tools** - `./devkit debug field` saves massive time
4. **Follow the data flow** - Trace from UI → Field → Spec → Renderer → DOM
5. **Minimal fix** - Change one thing, test, repeat

## Workflow 1: UI Field Not Working

**Symptoms**: Field not visible, not editable, not saving, wrong value displayed

### Phase 1: Reproduce (1-2 min)

```bash
# Open the entity with the problematic field
./devkit ui open creature aboleth

# Manual steps:
# 1. Navigate to the section with the field
# 2. Observe the problem (can't click, wrong value, etc.)
# 3. Note exact behavior
```

### Phase 2: Inspect Field State (1 min)

```bash
# Get comprehensive field diagnostics
./devkit debug field <fieldId> --creature <name>

# Example:
./devkit debug field passivesList --creature aboleth
```

**What to look for**:
- ✓/✗ Field exists in DOM
- ✓/✗ Field is visible
- ✓/✗ Chips are editable (for token fields)
- Value in modal data vs. displayed value
- Automated diagnosis suggestions

### Phase 3: Locate Code (2 min)

```bash
# Find field definition in create-spec
rg "id: \"<fieldId>\"" src/workmodes/library/

# Example:
rg "id: \"passivesList\"" src/workmodes/library/
# → src/workmodes/library/creatures/create-spec.ts:432
```

**Check in create-spec.ts**:
- Field definition correct?
- `visibleIf` condition blocking it?
- `editable` set correctly?
- Special config (chipTemplate, etc.)?

### Phase 4: Find Renderer (1 min)

Based on field type:
- `tokens` → `src/features/data-manager/fields/renderers/renderer-tokens.ts`
- `text` → `src/features/data-manager/fields/renderers/renderer-text.ts`
- `number` → `src/features/data-manager/fields/renderers/renderer-number.ts`
- `select` → `src/features/data-manager/fields/renderers/renderer-select.ts`
- etc.

### Phase 5: Common Fixes

**Problem: Chips not editable**
```typescript
// BAD - chipTemplate bypasses editable segments
config: {
  chipTemplate: (token) => `${token.name} ${token.value}`
}

// GOOD - Use automatic segment rendering
config: {
  fields: [
    { id: "name", label: "Label ", editable: true, displayInChip: true }
  ]
}
```

**Problem: Field not visible**
```typescript
// Check visibleIf condition
{
  id: "myField",
  visibleIf: (data) => data.someOtherField === "value" // Is this true?
}
```

**Problem: Value not saving**
```typescript
// Ensure field is in storage.frontmatter array
storage: {
  frontmatter: [
    'myField',  // Must be listed!
  ]
}
```

### Phase 6: Test & Verify (2 min)

```bash
# Rebuild and reload
npm run build && ./devkit reload

# Open entity again
./devkit ui open creature aboleth

# Test the fix manually
# If still broken, check logs:
./devkit debug logs 100 | grep <fieldId>
```

**Total Time**: ~10 minutes

---

## Workflow 2: Preset Not Loading

**Symptoms**: Entity doesn't appear in library, import fails, data missing

### Phase 1: Check File Exists (30 sec)

```bash
# List presets
ls Presets/Creatures/ | grep -i <name>

# Check content
cat "Presets/Creatures/<Name>.md"
```

### Phase 2: Validate Frontmatter (1 min)

```bash
# Check for required fields
head -20 "Presets/Creatures/<Name>.md"
```

Required frontmatter:
```yaml
---
smType: creature
name: "Name"
slug: name-slug
# ... other fields
---
```

**Common issues**:
- Missing `smType` field
- Wrong `smType` value (must match entity type)
- Invalid YAML syntax
- Missing required fields

### Phase 3: Regenerate Preset Data (1 min)

```bash
npm run build
# This runs generate-preset-data.mjs automatically

# Check output:
# "Found X creature presets" - is your count correct?
# "Generated preset module with X creatures" - included?
```

### Phase 4: Check Logs (1 min)

```bash
./devkit reload
./devkit debug logs 50 | grep -i "preset\|<name>"
```

Look for:
- Parse errors
- Validation failures
- Missing field warnings

### Phase 5: Common Fixes

**Problem: File not found**
```bash
# Check file name matches slug
# Presets/Creatures/aboleth.md → slug: "aboleth" ✓
# Presets/Creatures/Aboleth.md → slug: "aboleth" ✗ (case mismatch)
```

**Problem: YAML parse error**
```yaml
# BAD - unquoted colon
description: AC: 17, HP: 135

# GOOD - quoted
description: "AC: 17, HP: 135"
```

**Problem: Not in preset-data.ts**
```bash
# Check generated file includes it
rg "<slug>" Presets/lib/preset-data.ts
```

**Total Time**: ~5 minutes

---

## Workflow 3: Modal Not Opening

**Symptoms**: Click action does nothing, modal flashes and closes, error in console

### Phase 1: Try CLI Command (30 sec)

```bash
./devkit ui open creature <name>
# Does this work? If yes → problem is in browse view click handler
# If no → problem is in modal opening logic
```

### Phase 2: Check Logs (1 min)

```bash
./devkit debug logs 50
```

Look for:
- Error messages
- Stack traces
- "Opening create modal" messages

### Phase 3: Common Causes

**Problem: Entity not found**
```bash
# Check entity exists
./devkit ui open creature nonexistent
# → "Creature not found"

# Solution: Check preset exists and is loaded
```

**Problem: Spec not registered**
```typescript
// Check src/workmodes/library/registry.ts
export const entitySpecs = {
  creature: creatureSpec,
  spell: spellSpec,
  // ... is your entity type here?
}
```

**Problem: Data loading error**
```bash
# Enable debug logging
./devkit debug enable --all

# Open modal
./devkit ui open creature <name>

# Check logs for parse errors
./devkit debug logs 100 | grep -i error
```

**Total Time**: ~5 minutes

---

## Workflow 4: Token Field Issues

**Symptoms**: Chips not rendering, can't add tokens, can't edit tokens

### Phase 1: Inspect Field (1 min)

```bash
./devkit debug field <fieldId> --creature <name>
```

Check diagnosis output:
- Are chips rendering?
- Are they marked as editable?
- What classes do they have?

### Phase 2: Check Spec Config (2 min)

```typescript
// src/workmodes/library/creatures/create-spec.ts

{
  id: "myTokenField",
  type: "tokens",
  config: {
    fields: [
      // Are all required fields defined?
      { id: "field1", type: "text", displayInChip: true, editable: true }
    ],
    primaryField: "field1", // Does this match a field ID?
    chipTemplate: // ← DANGER! This disables inline editing!
  }
}
```

### Phase 3: Common Fixes

**Problem: Chips not editable (THIS ONE!)**
```typescript
// WRONG - chipTemplate makes chips read-only
config: {
  chipTemplate: (token) => `${token.name}`
}

// RIGHT - Remove chipTemplate, use labels
config: {
  fields: [
    { id: "name", label: "Prefix ", editable: true, displayInChip: true }
  ]
}
```

**Problem: Can't add tokens**
```typescript
// Check if field has maxTokens limit
config: {
  maxTokens: 5 // Can't add more than 5
}
```

**Problem: Chips not rendering at all**
```typescript
// Ensure displayInChip is true
config: {
  fields: [
    { id: "name", displayInChip: true } // ← Must be true!
  ]
}
```

**Total Time**: ~5 minutes

---

## Workflow 5: Value Not Saving

**Symptoms**: Enter value, save, reopen → value is gone

### Phase 1: Check Field in Modal Data (1 min)

```bash
# Open entity
./devkit ui open creature <name>

# Enter value in field
# Then check if it's in the data:
./devkit debug get-modal-data | grep <fieldId>
```

**If value IS in modal data**: Problem is in storage/serialization
**If value NOT in modal data**: Problem is in field update handler

### Phase 2: For Storage Issues (2 min)

```typescript
// Check create-spec.ts storage config
storage: {
  frontmatter: [
    'myField', // ← Field must be listed here to save!
  ],
  bodyTemplate: entityToMarkdown // Check this function includes the field
}
```

```bash
# Check serializer
# src/workmodes/library/creatures/serializer.ts
# Does it include your field?
```

### Phase 3: For Update Handler Issues (3 min)

```bash
# Enable field-specific logging
./devkit debug enable --fields <fieldId>

# Interact with field
# Check logs
./devkit debug logs 100 | grep <fieldId>
```

Look for:
- "Field value updated" messages
- onUpdate handler calls
- Validation errors

**Total Time**: ~10 minutes

---

## Workflow 6: Data Migration Needed

**Symptoms**: Changing field structure, need to update all presets/vault files

### Phase 1: STOP! Don't Mass-Edit Files

**Rule**: If you control the presets, just fix them at the source!

- Presets are in `Presets/Creatures/` → Edit these directly
- Vault files are imported presets → Will be re-imported from fixed presets

### Phase 2: Fix Preset Format (5 min)

1. Open one preset file
2. Make format change
3. Test with one entity:
   ```bash
   npm run build
   ./devkit ui open creature <name>
   # Does it work?
   ```

### Phase 3: Batch Update Presets (2 min)

```bash
# Use sed/awk for simple changes
find Presets/Creatures -name "*.md" -exec sed -i 's/old/new/g' {} \;

# Or write a focused script for complex changes
node scripts/fix-specific-thing.mjs
```

### Phase 4: Regenerate (1 min)

```bash
npm run build  # Regenerates preset-data.ts
./devkit reload
```

**Total Time**: ~10 minutes

**Don't**: Create migration logic for preset data
**Don't**: Edit 600+ files individually
**Don't**: Touch vault files (they're just imports)

---

## Quick Reference: DevKit Debug Commands

```bash
# Field inspection
./devkit debug field <fieldId> [--creature <name>]
./devkit debug field-state <fieldId>
./devkit debug dump-fields

# Logging
./devkit debug enable [--fields f1,f2] [--categories c1,c2]
./devkit debug disable
./devkit debug logs [n]
./devkit debug marker "Text"
./devkit debug analyze

# UI interaction
./devkit ui open creature <name>
./devkit ui validate
./devkit ui dump

# Plugin control
./devkit reload
```

---

## Time Expectations

| Task | Expected Time | If Taking Longer |
|------|---------------|------------------|
| UI field not working | ~10 min | You're debugging data, not UI |
| Preset not loading | ~5 min | Check YAML syntax, smType field |
| Modal not opening | ~5 min | Check logs immediately |
| Token field issues | ~5 min | Check chipTemplate first |
| Value not saving | ~10 min | Check storage.frontmatter |
| Data migration | ~10 min | Don't write migration logic! |

**If any task takes >20 minutes**: Stop, reassess the approach, ask for help!

---

## Anti-Patterns to Avoid

1. **Assuming the cause** - "Must be data format" → Wastes time
2. **Mass-editing files** - Fix the source (presets), not the copies (vault)
3. **Building multiple times** - Build once, test thoroughly
4. **Skipping reproduction** - Can't fix what you haven't seen
5. **Complex solutions** - Usually need a 1-line fix, not a migration script

---

## Example: The "Chips Not Editable" Bug

This is what we just fixed. Here's how it SHOULD have gone:

**What happened (1 hour)**:
1. Analyzed data format ❌
2. Created migration script ❌
3. Fixed 657 files ❌
4. Regenerated preset-data 3x ❌
5. Eventually found chipTemplate issue ✓

**What should have happened (10 minutes)**:
1. `./devkit ui open creature aboleth` (1 min)
2. Click chip → "Not clickable!" (1 min)
3. `./devkit debug field passivesList --creature aboleth` (1 min)
   → "✗ Chips are not editable - check chipTemplate"
4. Open create-spec.ts:459 (1 min)
5. Remove chipTemplate (1 min)
6. `npm run build && ./devkit reload` (2 min)
7. Test fix (2 min)
8. Done! ✓

**Time saved**: 50 minutes

---

## Next Steps

- Read this before debugging!
- Follow the workflow for your issue type
- Use `./devkit debug field` as your first tool
- If still stuck after 20 min → ask for help with logs
