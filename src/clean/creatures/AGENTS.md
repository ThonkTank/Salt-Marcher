# Clean Creatures

## Purpose

`src/clean/creatures` owns the first reusable Clean creature slice. It provides a clean-local catalog, a shell-integrated statblock publisher, and a reusable creature browser that is currently hosted under the top-level `Encounter` tab.

## Canonical Types and APIs

- `CreaturesObject.composeEncounterhost(ComposeEncounterhostInput)` — clean creature host request — returns the controls/main browser content plus the shell-hook connector used by the `Encounter` feature tab.
- `catalog/CatalogObject.composeCatalog(ComposeCatalogInput)` — catalog root request — returns the clean-local creature catalog bundle with read seams for filter options, browser search, single-creature detail loads, and encounter-candidate projections.
- `statblock/StatblockObject.composeStatblock(ComposeStatblockInput)` — statblock request — returns the shell-hook connector plus the statblock show action for creature rows.
- `browser/BrowserObject.composeBrowser(ComposeBrowserInput)` — browser request — returns the reusable creature browser controls and main content for a hosting surface.

## Where New Code Goes

- Keep creature DB reads in `catalog`; do not spread SQL or database-path logic into `browser`, `statblock`, `featuretabs`, or `clean.CleanObject`.
- Keep creature browser UI assembly in `browser`, not in `EncountertabObject`.
- Keep statblock presentation in `statblock` and continue routing details through the shell-owned inspector instead of adding a creature-local details pane.
- Add later encounter-specific integrations through `CreaturesObject` or `clean.featuretabs.encountertab`, not by turning the browser into an encounter-specific owner.

## Forbidden Drift

- Do not import legacy `features.creatures`, `shared.rules`, `database.DatabaseManager`, or `ui.components.catalog` code into this subtree.
- Do not turn `EncountertabObject` back into the owner of creature catalog logic or statblock composition.
- Do not introduce a new generic shared browser framework here; this slice is creature-owned and may be reused later by other clean features.
