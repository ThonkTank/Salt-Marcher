# Runtime & Data-Integrity Risks

| Risk | Description | Evidence |
| --- | --- | --- |
| Async render races | Creatures renderer performs async file reads in `render()` while the contract treats render as synchronous; query changes can trigger overlapping renders and stale DOM. | 【F:src/apps/library/view/creatures.ts†L122-L205】【F:src/apps/library/view/mode.ts†L25-L33】 |
| Silent data truncation | Item/equipment importers swallow JSON parse errors, continuing with incomplete structures and overwriting files on save. | 【F:src/apps/library/view/items.ts†L69-L102】【F:src/apps/library/view/equipment.ts†L64-L104】 |
| Preset import retry loop | Marker creation failure during `shouldImportPluginPresets()` logs but still returns true, causing repeated imports and potential duplicates. | 【F:src/apps/library/core/plugin-presets.ts†L107-L122】 |
| Debounced save loss | Terrains/regions renderers rely on debounced timers; rapid mode switches or errors before `flushSave()` could drop unsaved edits. | 【F:src/apps/library/view/terrains.ts†L130-L161】【F:src/apps/library/view/regions.ts†L101-L164】 |
| Manual YAML parsing drift | Creatures renderer uses regex parsing fallback rather than shared serializer, risking divergence from canonical schema and missed fields. | 【F:src/apps/library/view/creatures.ts†L21-L51】 |
| Encounter odds validation gap | Region encounter odds accept non-numeric input; invalid entries become `undefined` without user notice, losing data. | 【F:src/apps/library/view/regions.ts†L69-L91】 |
| Modal lifecycle leak | Renderers spawn modals (`new Create*Modal`) without storing references; closing the library view leaves modals open and detached from lifecycle cleanups. | 【F:src/apps/library/view/creatures.ts†L210-L237】【F:src/apps/library/view/items.ts†L64-L101】 |
