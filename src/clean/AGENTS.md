# Clean App Root

## Purpose

`src/clean` owns the active Salt Marcher application rebuild. Keep new application behavior here, because this tree is the live product surface that `build`, `run`, and `installDesktopApp` now exercise.

## Owner Atlas

- `clean.CleanObject` - root application seam that assembles the live clean owners and launches startup.
- `clean.startup.StartupObject` - startup owner that stages the composed root on the JavaFX `Stage`.
- `clean.shell.ShellObject` - reusable cockpit shell owner for frame, navigation, inspector, scene, and async hooks.
- `clean.featuretabs.FeaturetabsObject` - top-level feature roster owner for `Catalog`, `Travel`, `Map Editor`, and `Tabellen`.
- `clean.catalog.CatalogObject` - top-level catalog workspace owner.
- `clean.creatures.CreaturesObject` - reusable creature slice owner mounted inside `Catalog`.
- `clean.encounter.EncounterObject` - encounter runtime owner rendered through the shell scene pane.

## Canonical Types And APIs

- `CleanObject.showApplication(ShowApplicationInput)` - validates the launcher request and returns the launched application handoff.
- `StartupObject.startApplication(StartApplicationInput)` - stages the composed root on the provided `Stage`.
- `ShellObject.composeShell(ComposeShellInput)` - returns the shell root plus the hook bundle that features consume.
- `FeaturetabsObject.composeFeaturetabs(ComposeFeaturetabsInput)` - returns the ordered top-level surfaces and initial surface id.
- `CatalogObject.composeCatalog(ComposeCatalogInput)` - returns the top-level catalog surface.
- `CreaturesObject.composeCatalogcontent(ComposeCatalogcontentInput)` - returns the reusable creature catalog content mounted by `Catalog`.
- `EncounterObject.composeEncounter(ComposeEncounterInput)` - returns the scene registration hook and the encounter command seam.

## Where New Code Goes

- Put new clean application entry and cross-owner assembly in `clean`, because `CleanObject` is the only parent seam that is allowed to stitch sibling owners together.
- Put reusable shell behavior in `clean/shell`, because features should attach through surfaces and hooks rather than rebuilding frame logic locally.
- Put top-level navigation choices in `clean/featuretabs`, because that owner decides which primary surfaces exist.
- Put top-level catalog workspace behavior in `clean/catalog`, because `Catalog` owns the workspace surface, not the creature slice mounted inside it.
- Put reusable creature catalog behavior in `clean/creatures`, because `Catalog` should host content, not own creature-specific browsing or statblock behavior.
- Put encounter runtime state in `clean/encounter`, because the scene pane is the persistent runtime surface for the active session.
- Keep clean-specific resources in `resources/clean`, because the clean app must stay visually self-contained.

## Forbidden Drift

- Keep `src/clean` isolated from legacy packages in `database`, `features`, `importer`, `shared`, and `ui`, because the clean rebuild must remain independently movable and reviewable.
- Mirror the legacy cockpit presentation locally instead of importing legacy shell code or CSS, because clean needs behavioral continuity without taking a code dependency on abandoned trees.
- Keep cross-owner communication request-based and parent-launched, because sibling convenience hops hide the real ownership graph.
- Keep scene-graph assembly out of public request methods, because the owner checks expect those seams to stay trivial and auditable.
- Keep clean runtime dispatch explicit and modelable. Do not add reflection, `ServiceLoader`, `MethodHandles`, dynamic proxies, or other open-ended runtime lookup in `src/clean`, because the tree-wide dead-code gate rejects unmodeled dynamic reachability.
