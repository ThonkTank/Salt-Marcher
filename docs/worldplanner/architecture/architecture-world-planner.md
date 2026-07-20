Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
Source of Truth: World Planner feature ownership, public seams, and target
dependency direction.

# World Planner Architecture

## Entity And Concerns

This specification serves maintainers of World Planner authored state,
persistence, JavaFX presentation, and Encounter or Session Planner integration.
It defines ownership and collaboration without prescribing the legacy package
or runtime-registry form.

World Planner owns authored NPC, faction, location, lifecycle, note, source
constraint, membership, and inventory-limit truth. It does not own creature
statblocks, encounter tables, encounter runtime state, party truth, or session
records.

## Target Topology

```text
features/worldplanner/api/
features/worldplanner/domain/
features/worldplanner/application/
features/worldplanner/adapter/sqlite/
features/worldplanner/adapter/javafx/
features/worldplanner/WorldPlannerFeature
```

`WorldPlannerFeature` receives `CreaturesApi` and `EncounterTableApi` from the
application composition and exposes `WorldPlannerApi` plus constructed shell
contributions.

World Planner does not own shell navigation. Its JavaFX adapter contributes the
NPC, faction, and location Catalog contents and Inspector editors to the shared
Catalog shell contribution. The global Encounter state pane remains owned by
Encounter.

## Boundaries

- `WorldPlannerApi` owns typed commands, results, immutable revisioned state,
  and location or source-availability queries.
- Domain code owns World Planner invariants and has no JavaFX, SQL, shell, or
  foreign-feature dependencies.
- Application code translates foreign API facts into World Planner values and
  orchestrates domain and persistence ports.
- The SQLite adapter persists only World Planner-owned truth and stable foreign
  references.
- The JavaFX adapter depends on `WorldPlannerApi`, `shell.api`, and
  feature-neutral platform UI contracts only.
- Encounter and Session Planner consume World Planner facts only through
  `WorldPlannerApi`; candidate combat loss remains an explicit confirmation
  workflow.

Persistence-backed calls are non-blocking. Successful state publication occurs
on the UI dispatcher and late results cannot replace a newer revision.

## Verification

Target dependency direction is mechanically enforced by `architectureTest`.
JUnit production routes own authored-state, persistence, integration, and UI
behavior proof.

## References

- [World Planner Requirements](../requirements/requirements-world-planner.md)
- [World Planner Domain Model](../domain/domain-world-planner.md)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
