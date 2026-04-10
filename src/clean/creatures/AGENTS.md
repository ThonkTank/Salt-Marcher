# Clean Creatures

## Purpose

`src/clean/creatures` owns the reusable creature catalog slice mounted inside the clean `Catalog` workspace. Keep creature browsing, filtering, statblock publication, and clean-local reads together here, because they change for one domain capability.

## Canonical Types And APIs

- `CreaturesObject.composeCatalogcontent(ComposeCatalogcontentInput)` - returns the reusable controls/main content bundle plus the shell-ready hook for the host workspace.
- `catalog/CatalogObject.composeCatalog(ComposeCatalogInput)` - returns the clean-local creature catalog read seams.
- `browser/BrowserObject.composeBrowser(ComposeBrowserInput)` - returns the creature browser table and criteria-apply seam.
- `filterpane/FilterpaneObject.composeFilterpane(ComposeFilterpaneInput)` - returns the creature filter controls surface.
- `statblock/StatblockObject.composeStatblock(ComposeStatblockInput)` - returns the statblock publication seam that feeds the shell inspector.

## Where New Code Goes

- Keep creature reads and projection logic in `catalog`, because SQL-shaped concerns belong at the data owner inside this slice.
- Keep the table and pagination workspace in `browser`, because that owner controls list presentation and row actions.
- Keep interactive filter controls in `filterpane`, because filter state and chip behavior are one capability.
- Keep inspector publication in `statblock`, because statblock display is a separate creature-owned seam from browsing.
- Route new runtime integrations through `CreaturesObject`, because the root owner is responsible for assembling the slice for its host surface.

## Forbidden Drift

- Keep shell-facing details request-shaped through the statblock and root seams, because the creature slice should publish into the shared shell rather than grow its own details surface.
- Keep encounter-specific runtime state in `clean.encounter`, because adding creatures to an encounter is an integration point, not creature ownership.
- Keep this subtree clean-local. Do not import legacy creature, database, rules, or UI packages here, because the slice must remain part of the isolated rebuild.
