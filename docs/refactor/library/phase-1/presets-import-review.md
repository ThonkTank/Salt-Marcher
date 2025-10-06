# Preset & Import Pipeline Review

## Creature Presets
- **Source** – `loadCreaturePreset()` reads preset markdown via metadataCache, falling back to computed alignment/PB/initiative when fields missing, and migrates legacy spellcasting data to entry format. 【F:src/apps/library/core/creature-presets.ts†L52-L117】
- **Normalization** – JSON fields parsed with try/catch that logs warnings but returns `undefined` on failure, meaning malformed presets silently drop structured data. 【F:src/apps/library/core/creature-presets.ts†L75-L107】
- **Idempotence** – `ensurePresetDir/list/watch` reuse shared pipeline; no writeback path so presets remain read-only. 【F:src/apps/library/core/creature-presets.ts†L9-L31】

## Plugin Preset Import
- **Flow** – `importPluginPresets()` dynamically imports generated preset bundles, ensures target directories and writes missing creature markdown files; duplicates are skipped using case-insensitive set. 【F:src/apps/library/core/plugin-presets.ts†L25-L82】
- **Feedback** – Completion stats logged and success Notice shown; missing module treated as non-error. 【F:src/apps/library/core/plugin-presets.ts†L84-L101】
- **Idempotence** – `shouldImportPluginPresets()` writes a marker file so imports only run once per vault, but marker creation errors are only logged. 【F:src/apps/library/core/plugin-presets.ts†L107-L122】
- **Spell Presets** – Mirror process for spells with separate directory listing; same silent skip/notice behaviour. 【F:src/apps/library/core/plugin-presets.ts†L128-L203】

## Item & Equipment Imports
- **Source** – Import buttons read metadata via `metadataCache`; JSON fields parsed individually inside try/catch blocks that swallow errors, resulting in partial data without user notification. 【F:src/apps/library/view/items.ts†L52-L101】
- **Writeback** – Modal submit reserializes via `itemToMarkdown()`/`equipmentToMarkdown()` and overwrites original file, but dynamic `import()` occurs each time the modal saves. 【F:src/apps/library/view/items.ts†L64-L101】【F:src/apps/library/view/equipment.ts†L64-L101】
- **Validation** – Item/equipment modals gather validation issues before submit, yet renderer imports bypass validation (modal invoked with pre-populated data but parse errors simply log). 【F:src/apps/library/view/items.ts†L64-L101】【F:src/apps/library/create/item/modal.ts†L24-L76】【F:src/apps/library/view/equipment.ts†L44-L101】

## Spell & Creature Creation
- **Spell Modal** – Validates scaling text and toggles invalid state, but failure only prevents auto-submit if user reviews message; no persistence guard in renderer. 【F:src/apps/library/create/spell/modal.ts†L72-L106】
- **Creature Modal** – Loads available spells async and migrates legacy data in constructor; errors during preset load caught and logged only. 【F:src/apps/library/create/creature/modal.ts†L28-L71】【F:src/apps/library/view/creatures.ts†L214-L232】

## Failure Paths
- Manual JSON parsing across presets/importers logs to console without surfacing to UI, risking silent data loss. 【F:src/apps/library/core/creature-presets.ts†L75-L107】【F:src/apps/library/view/items.ts†L60-L101】
- Vault writes assume directories exist after ensure, but plugin import only guards creature/spell dirs, not items/equipment despite ensuring them at top (unused). 【F:src/apps/library/core/plugin-presets.ts†L5-L99】
