# Clean Feature Tabs

## Purpose

`src/clean/featuretabs` owns the top-level Clean product tabs that plug passive surfaces into `clean/shell`.

## Canonical Types and APIs

- `FeaturetabsObject.composeFeaturetabs(ComposeFeaturetabsInput)` — top-level feature-tab request — returns the ordered Clean shell surfaces plus the initial active surface id.
- `mapcatalog/MapcatalogObject.loadMaps(LoadMapsInput)` — clean seed catalog request — returns the mixed Hexmap/Dungeon map list used by aggregated top-level tabs.
- `navigationicon/NavigationiconObject.composeNavigationicon(ComposeNavigationiconInput)` — navigation icon request — returns the clean-local sidebar graphics for the current top-level roster.
- `traveltab/TraveltabObject.composeTraveltab(ComposeTraveltabInput)` — aggregated runtime surface for `Travel`, with automatic Hexmap/Dungeon subview switching based on the selected map.
- `mapeditortab/MapeditortabObject.composeMapeditortab(ComposeMapeditortabInput)` — aggregated editor surface for `Map Editor`, with automatic Hexmap/Dungeon subview switching based on the selected map.
- `tablestab/TablestabObject.composeTablestab(ComposeTablestabInput)` — placeholder editor surface for `Tabellen`.

## Where New Code Goes

- Keep the durable top-level Clean roster here: `Catalog`, `Travel`, `Map Editor`, `Tabellen`.
- Keep top-level tab ownership separate from the shell. `clean/shell` renders the surfaces; `clean/featuretabs` decides which surfaces exist and in what order.
- Keep top-level tab ownership separate from reusable feature products. `FeaturetabsObject` may compose the sibling top-level `clean.catalog` owner, but creature catalog/browser/statblock ownership stays in `clean/creatures`.
- Keep `Travel` and `Map Editor` aggregated at the top level, but keep their Hexmap/Dungeon implementations as separate internal child owners that switch automatically from the selected map.
- Keep the map list clean-local until real clean repositories exist. Replace `mapcatalog` later with a clean persistence-backed owner instead of importing legacy world code.

## Forbidden Drift

- Do not reintroduce top-level `Encounter`, `Zauber`, `Karte`, `Dungeon`, `Karteneditor`, or `Dungeon-Editor` tabs in Clean.
- Do not add manual Hexmap/Dungeon mode toggles to `Travel` or `Map Editor`; those tabs switch by map selection.
- Do not import legacy world/runtime/editor owners from `features.world` or `ui.shell.NavigationIcons`.
- Do not push the top-level tab roster back into `clean.CleanObject`; keep `CleanObject` as the bootstrap seam only.
