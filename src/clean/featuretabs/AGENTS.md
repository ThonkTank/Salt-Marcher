# Clean Feature Tabs

## Purpose

`src/clean/featuretabs` owns the top-level clean feature roster. Keep primary surface selection here, because one owner must define which first-level workspaces exist and in what order.

## Canonical Types And APIs

- `FeaturetabsObject.composeFeaturetabs(ComposeFeaturetabsInput)` - returns the ordered shell surfaces plus the initial surface id.
- `navigationicon/NavigationiconObject.composeNavigationicon(ComposeNavigationiconInput)` - returns the sidebar graphics for the top-level roster.
- `tablestab/TablestabObject.composeTablestab(ComposeTablestabInput)` - returns the `Tabellen` surface.
- `../world/WorldObject.composeWorld(ComposeWorldInput)` - returns the aggregated `Travel` and `Map Editor` surfaces from the clean-local world subtree.

## Where New Code Goes

- Keep the durable top-level roster here, because the shell should render surfaces, not decide which ones exist.
- Keep navigation icon selection and section metadata here, because top-level navigation belongs with the roster owner.
- Keep world-specific top-level host composition in `clean/world`, because `featuretabs` should mount those surfaces rather than absorb world internals.
- Keep the dormant placeholder subtrees under `mapcatalog`, `traveltab`, and `mapeditortab` unreferenced until an explicit cleanup task, because this owner now delegates active world wiring through `clean/world`.

## Forbidden Drift

- Keep reusable feature products such as the creature slice in their own owners, because `featuretabs` should mount top-level surfaces rather than absorb feature internals.
- Keep top-level roster decisions out of `CleanObject`, because the root owner should assemble siblings, not become a second navigation owner.
- Keep legacy world and legacy navigation code out of this subtree, because abandoned structures are not valid precedent for the clean roster.
