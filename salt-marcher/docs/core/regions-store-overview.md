# Regions Store Overview

## Module Purpose
The regions store owns the Obsidian integration for the adventuring regions list stored in `SaltMarcher/Regions.md`. It ensures the Markdown file exists with scaffolding, parses and serialises the fenced `regions` code block, and exposes helpers to load, persist, and watch the data for UI consumers.

## Structure Diagram
```
+----------------------+     ensure/load/save      +---------------------------+
|  Obsidian Vault API  | <-----------------------> |  regions-store.ts helpers |
+----------+-----------+                          +-------------+-------------+
           ^                                                       |
           | modify/delete events                                  |
           |                                                       v
           |                               +---------------------------------------------+
           +-------------------------------+  Workspace listeners ("salt:regions-updated") |
                                           +---------------------------------------------+
```

## File Lifecycle – Current Behaviour
1. Delete `SaltMarcher/Regions.md` in the vault (e.g. via Obsidian’s file browser).
2. The watcher emits `salt:regions-updated` and prints the warning
   `Salt Marcher regions store detected Regions.md deletion; the file is not auto-recreated and must be restored manually.`
3. No attempt is made to recreate the Markdown file; subsequent `loadRegions` calls will re-run `ensureRegionsFile`, but only when explicitly invoked by the UI.

### Observed Risks
- **Data loss window:** Until another consumer calls `ensureRegionsFile`, the Regions list is gone, including frontmatter hints and usage examples.
- **Silent consumer failures:** Callers that expect the fenced block to exist can receive an empty list and render blank state without explaining why.
- **No regression coverage:** There is no automated test that asserts deletion recovery, making it easy to introduce regressions.

## Improvement Options
The [Regions store resilience to-do](../../../todo/regions-store-resilience.md) captures the follow-up work. Proposed mitigations include:
- Automatically recreating the Markdown file inside the delete handler to close the data-loss window.
- Debouncing rapid modify/delete oscillations before notifying listeners to avoid redundant reload cycles.
- Adding integration tests (e.g. via a mocked vault) that cover deletion, recreation, and listener behaviour.
- Surfacing a user-facing notification in addition to the console warning for better UX feedback.

## References
- Code: [`src/core/regions-store.ts`](../../src/core/regions-store.ts)
- Related docs: [Terrain Store Overview](terrain-store-overview.md) for analogous persistence patterns.
