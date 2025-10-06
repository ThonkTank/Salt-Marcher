# ADR-0001: Current Library Architecture

## Status
Accepted (baseline as of Phase 1 audit).

## Context
The Library feature delivers a multi-mode Obsidian view that surfaces vault-backed data for creatures, spells, items, equipment, terrains and regions. The shell view instantiates specialised mode renderers and ensures all backing directories/files exist before first render. 【F:src/apps/library/view.ts†L50-L138】 Renderers derive from `BaseModeRenderer`, which normalises search query handling and centralises cleanup registration. 【F:src/apps/library/view/mode.ts†L9-L53】

Persistence responsibilities sit in dedicated services built on a shared vault file pipeline. Each category defines its domain schema, Markdown serializer and watcher wrappers, while terrains/regions rely on global stores that read/write code blocks. 【F:src/apps/library/core/file-pipeline.ts†L1-L88】【F:src/apps/library/core/creature-files.ts†L96-L142】【F:src/core/terrain-store.ts†L32-L82】【F:src/core/regions-store.ts†L34-L86】 Create modals orchestrate complex editors for each domain, invoking serializers to persist new or updated entries. 【F:src/apps/library/create/creature/modal.ts†L28-L124】【F:src/apps/library/create/spell/modal.ts†L18-L106】【F:src/apps/library/create/item/modal.ts†L18-L96】【F:src/apps/library/create/equipment/modal.ts†L17-L105】

## Forces
- **Heterogeneous domains** require per-mode UI and serialization logic while sharing vault plumbing.
- **Obsidian lifecycle constraints** demand that views react to search input instantly and clean up DOM/event listeners on mode switch.
- **Preset/import workflows** must bridge bundled content, manual markdown and structured editor data without losing information. 【F:src/apps/library/core/creature-presets.ts†L52-L117】【F:src/apps/library/core/plugin-presets.ts†L25-L99】【F:src/apps/library/view/items.ts†L45-L111】

## Decision
Maintain a mode-based architecture where the shell delegates to renderer classes responsible for both UI composition and IO (list/watch/create). Shared concerns—directory setup, file serialization, search scoring and cleanup—live in utility modules (`createVaultFilePipeline`, `BaseModeRenderer`, `scoreName`). Presets/importers sit alongside core services and are invoked opportunistically (on view open or via UI actions).

## Consequences
- **Tight coupling** between UI renderers and persistence logic enables rapid feature delivery but intermixes concerns (renderers handle manual parsing and modal coordination). 【F:src/apps/library/view/creatures.ts†L21-L205】【F:src/apps/library/view/items.ts†L45-L111】
- **Consistency** across categories comes from the shared pipeline/watchers, yet edge cases (manual YAML parsing, JSON frontmatter) bypass common validation, leading to silent data loss risks. 【F:src/apps/library/view/creatures.ts†L21-L51】【F:src/apps/library/view/items.ts†L69-L102】
- **Scalability** is limited by large monolithic files (e.g. creature serializer) and per-mode duplication, increasing refactor cost but highlighting clear seams (renderers vs. serializers vs. modals) for future abstraction. 【F:src/apps/library/core/creature-files.ts†L1-L320】【F:src/apps/library/view/terrains.ts†L45-L162】
