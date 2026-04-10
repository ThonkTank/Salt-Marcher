# Clean Feature Tabs

## Purpose

`src/clean/featuretabs` owns the top-level clean feature roster. Keep primary surface selection here, because one owner must define which first-level workspaces exist and in what order.

## Canonical Types And APIs

- `FeaturetabsObject.composeFeaturetabs(ComposeFeaturetabsInput)` - returns the ordered shell surfaces plus the initial surface id.
- `mapcatalog/MapcatalogObject.loadMaps(LoadMapsInput)` - returns the clean-local map list used by the aggregated travel and editor tabs.
- `navigationicon/NavigationiconObject.composeNavigationicon(ComposeNavigationiconInput)` - returns the sidebar graphics for the top-level roster.
- `traveltab/TraveltabObject.composeTraveltab(ComposeTraveltabInput)` - returns the aggregated `Travel` surface.
- `mapeditortab/MapeditortabObject.composeMapeditortab(ComposeMapeditortabInput)` - returns the aggregated `Map Editor` surface.
- `tablestab/TablestabObject.composeTablestab(ComposeTablestabInput)` - returns the `Tabellen` surface.

## Where New Code Goes

- Keep the durable top-level roster here, because the shell should render surfaces, not decide which ones exist.
- Keep navigation icon selection and section metadata here, because top-level navigation belongs with the roster owner.
- Keep aggregated `Travel` and `Map Editor` switching inside their child owners, because the roster should expose stable top-level surfaces while those features decide their internal mode changes.
- Keep temporary clean-local map loading in `mapcatalog` until a real clean persistence owner exists, because top-level tabs still need one source of map choices.

## Forbidden Drift

- Keep reusable feature products such as the creature slice in their own owners, because `featuretabs` should mount top-level surfaces rather than absorb feature internals.
- Keep top-level roster decisions out of `CleanObject`, because the root owner should assemble siblings, not become a second navigation owner.
- Keep legacy world and legacy navigation code out of this subtree, because abandoned structures are not valid precedent for the clean roster.
