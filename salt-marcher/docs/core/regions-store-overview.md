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
2. The watcher logs `Salt Marcher regions store detected Regions.md deletion; attempting automatic recreation.` and calls
   `ensureRegionsFile` immediately.
3. On success the file is rebuilt with the standard scaffold, a `Notice` informs the user (`Regions.md wurde automatisch neu
   erstellt.`), and downstream listeners receive a single debounced `salt:regions-updated` signal.
4. If recreation fails the watcher logs an error, shows `Regions.md konnte nicht automatisch neu erstellt werden. Bitte
   manuell wiederherstellen.`, and still emits the debounced workspace notification so UIs can surface error states.

### Debounced Notifications
Obsidian fires rapid `modify`+`delete` sequences when files are recreated. The watcher therefore wraps the workspace trigger and
optional `onChange` callback in a 200 ms debounce window to collapse these bursts into a single refresh. This keeps palette
reloads cheap for the Cartographer UI while still guaranteeing eventual consistency after file churn.

### Regression Coverage
`tests/core/regions-store.test.ts` mocks the vault API to assert the recreation path, the error branch, and the debounced
notification contract. These tests prevent future refactors from regressing the automatic safeguards introduced here.

## References
- Code: [`src/core/regions-store.ts`](../../src/core/regions-store.ts)
- Related docs: [Terrain Store Overview](terrain-store-overview.md) for analogous persistence patterns.
