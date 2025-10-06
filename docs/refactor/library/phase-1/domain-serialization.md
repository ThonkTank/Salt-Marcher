# Domain & Serialization Catalogue

## Creatures
- **Schema** – `StatblockData` models speeds, abilities, spellcasting groups and both legacy (`saveProf`, `skillsProf`) and new bonus formats. 【F:src/apps/library/core/creature-files.ts†L9-L95】
- **Serialization** – `statblockToMarkdown()` writes YAML frontmatter with `smType: creature`, primary stats, speed breakdown (`speed_*`, `speeds_json`), arrays as YAML lists, and JSON strings for structured entries/spellcasting. 【F:src/apps/library/core/creature-files.ts†L114-L181】【F:src/apps/library/core/creature-files.ts†L182-L241】
- **Defaults & Fallbacks** – Alignment derived from split fields; initiative/hit dice appended to markdown body; computed spellcasting fields derived from PB/ability modifiers. 【F:src/apps/library/core/creature-files.ts†L148-L178】【F:src/apps/library/core/creature-files.ts†L242-L320】
- **Roundtrip** – Serializer emits both list and JSON variants; importer relies on metadataCache (for presets) or manual parse (renderer), so JSON parsing failures drop silently (no error propagation). 【F:src/apps/library/core/creature-presets.ts†L52-L117】【F:src/apps/library/view/creatures.ts†L21-L51】

## Spells
- **Schema** – `SpellData` includes casting basics, optional save/attack, damage metadata and markdown description fields. 【F:src/apps/library/core/spell-files.ts†L8-L15】
- **Serialization** – Frontmatter enumerates level/school/timing, boolean flags, YAML arrays for components/classes, and optional save/damage entries before the markdown body summarises stats and sections. 【F:src/apps/library/core/spell-files.ts†L18-L40】
- **Validation** – Modal collects scaling issues via `collectSpellScalingIssues`, marking text area invalid. 【F:src/apps/library/create/spell/modal.ts†L72-L96】
- **Roundtrip** – No importer; creation relies exclusively on serializer, so existing markdown edits outside supported fields remain untouched.

## Magic Items
- **Schema** – `ItemData` covers attunement, charges, stored spells, bonuses, resistances, ability changes, speed changes, usage limits, curses, variants, tables and sentience meta. JSON fields capture nested structures. 【F:src/apps/library/core/item-files.ts†L9-L73】
- **Serialization** – Writes YAML booleans/arrays for simple lists; complex sections become escaped JSON strings (`spells_json`, `bonuses_json`, etc.) before markdown body prints narrative sections. 【F:src/apps/library/core/item-files.ts†L41-L104】
- **Roundtrip** – Importer reads metadataCache frontmatter and parses JSON with silent catch; description extracted from body via regex, risking mismatch when frontmatter order changes. 【F:src/apps/library/view/items.ts†L52-L108】

## Equipment
- **Schema** – `EquipmentData` enumerates type-specific fields for weapons, armor, tools and gear, using arrays for lists and strings for stats. 【F:src/apps/library/core/equipment-files.ts†L16-L48】
- **Serialization** – Frontmatter encodes type plus optional stats (lists via YAML) and body prints type summary, stats and type-specific details. 【F:src/apps/library/core/equipment-files.ts†L49-L118】
- **Roundtrip** – Importer reads frontmatter, body by regex, then writes via serializer; no JSON fields, but manual DOM rebuild per type in modal means data must stay in sync with type toggles. 【F:src/apps/library/view/equipment.ts†L52-L104】【F:src/apps/library/create/equipment/modal.ts†L44-L105】

## Terrains
- **Schema** – Map of terrain name to `{color, speed}` with enforced transparent blank key. 【F:src/core/terrain-store.ts†L1-L40】
- **Serialization** – Code block ` ```terrain` lists `Name: color, speed: n`; serializer sorts entries with blank first. 【F:src/core/terrain-store.ts†L23-L47】
- **Roundtrip** – Renderer mutates map and debounced save rewrites code block; manual color normalization ensures fallback `#999999`. 【F:src/apps/library/view/terrains.ts†L45-L123】

## Regions
- **Schema** – `Region` objects with `name`, `terrain`, optional `encounterOdds`. 【F:src/core/regions-store.ts†L1-L32】
- **Serialization** – Code block ` ```regions` lines `Name: Terrain, encounter: 1/n`; parser supports fractions or raw numbers. 【F:src/core/regions-store.ts†L34-L58】
- **Roundtrip** – Renderer edits in place, schedules save; store auto-recreates missing file and debounces modify/delete events to avoid duplicate refresh. 【F:src/apps/library/view/regions.ts†L46-L140】【F:src/core/regions-store.ts†L59-L86】
