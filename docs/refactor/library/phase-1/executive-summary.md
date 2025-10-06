# Executive Summary

## Top Risks
1. **Asynchronous creature renders race with lifecycle** – `render()` performs awaited metadata reads despite the contract being synchronous, so rapid search/mode changes can operate on stale DOM or double-trigger edits. 【F:src/apps/library/view/creatures.ts†L122-L205】【F:src/apps/library/view/mode.ts†L25-L33】
2. **Silent data truncation during imports** – Item and equipment importers swallow JSON parse errors, then overwrite the file with incomplete data, risking irreversible loss. 【F:src/apps/library/view/items.ts†L69-L102】【F:src/apps/library/view/equipment.ts†L64-L104】
3. **Debounced terrain/region saves can drop edits** – Dirty flags rely on timers; leaving the mode before `flushSave()` writes will discard pending changes. 【F:src/apps/library/view/terrains.ts†L130-L161】【F:src/apps/library/view/regions.ts†L101-L164】
4. **Preset import marker failure loops** – When the marker file cannot be created the importer still reports success, so presets re-run and may conflict with manual files. 【F:src/apps/library/core/plugin-presets.ts†L107-L122】
5. **Manual YAML parsing drifts from canonical serializer** – Creatures renderer reimplements frontmatter parsing via regex, meaning new schema fields or bug fixes in serializers will not reach the list view. 【F:src/apps/library/view/creatures.ts†L21-L51】【F:src/apps/library/core/creature-files.ts†L96-L142】

## Top Quick Wins
1. **Replace console debugging in creature list** – Remove repetitive logging of parsed metadata and counts to declutter diagnostics. 【F:src/apps/library/view/creatures.ts†L37-L44】【F:src/apps/library/view/creatures.ts†L139-L142】
2. **Hoist serializer imports** – Move dynamic `import()` calls for `itemToMarkdown`/`equipmentToMarkdown` to module scope to avoid repeated bundle loads. 【F:src/apps/library/view/items.ts†L69-L87】【F:src/apps/library/view/equipment.ts†L64-L87】
3. **Validate region encounter input inline** – Surface non-numeric encounter odds instead of silently dropping them to keep data accurate. 【F:src/apps/library/view/regions.ts†L69-L91】
4. **Share metadata parsing for creatures** – Delegate fallback parsing to the existing serializer/preset helpers rather than regex, eliminating duplicate logic. 【F:src/apps/library/view/creatures.ts†L21-L51】【F:src/apps/library/core/creature-presets.ts†L52-L117】
5. **Document and stub watcher tests** – Add targeted tests around terrain/region debounced saves to lock in current behaviour before refactors. 【F:src/apps/library/view/terrains.ts†L130-L161】【F:tests/library/view.test.ts†L1-L67】
