Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Dungeon feature ownership, authored-core boundary, runtime
capabilities, and target dependency direction.

# Dungeon Architecture

## Entity And Concerns

This specification serves maintainers of Dungeon authored truth, editor and
travel workflows, persistence, and JavaFX map surfaces. Product behavior,
stored schema details, and domain invariants remain in their neighboring owner
documents.

Dungeon remains one feature. It owns authored maps and their topology while
publishing separate capabilities for authored catalog work, editing, and
travel.

## Target Topology

```text
features/dungeon/api/
features/dungeon/domain/core/
features/dungeon/application/authored/
features/dungeon/application/editor/
features/dungeon/application/travel/
features/dungeon/adapter/sqlite/
features/dungeon/adapter/javafx/
features/dungeon/DungeonFeature
```

## Authored Core

The authored core owns `DungeonMap`, stable topology identity, aggregate
transactions, revision, and map-wide coordination. Its internal ownership
flows from immutable geometry and components through structures to read-only
graph queries and projections.

- Rooms, clusters, corridors, walls, paths, doors, stairs, transitions, and
  topology-affecting behavior remain inside the aggregate boundary.
- Repair, split or merge behavior, identity preservation, validation, and
  derived rebuilds belong to the deepest owning core object.
- Graph and projection code may describe authored structures but MUST NOT
  persist or mutate them.
- JavaFX, SQL, party state, editor selection, pointer interpretation, and travel
  session state MUST NOT enter authored core truth.

## Application Capabilities

- `DungeonAuthoredApi` owns map catalog and authored-map commands/results.
- `DungeonEditorApi` owns editor session, tools, selection, previews, and
  committed authored mutations over core truth.
- `DungeonTravelApi` owns travel-session workflows over dungeon facts and
  party-owned position facts received through `PartyApi`.
- Preview or interaction state MUST NOT mutate authored truth before an
  explicit successful command commits.
- All published state is immutable and revisioned; persistence-backed calls are
  non-blocking and publish through the UI dispatcher.

## Adapters And Composition

The SQLite adapter persists authored Dungeon truth and satisfies feature-owned
ports. The JavaFX adapter renders, hit-tests, and translates input through the
three Dungeon APIs without importing application, domain, or SQLite packages.

`DungeonFeature` receives platform services, `PartyApi`, and the Maps canvas
capability, constructs the three APIs and shell contributions, and exposes no
internal repository or adapter.

## Verification

Target dependency direction is mechanically enforced by `architectureTest`.
Domain-invariant, editor, travel, persistence, and JavaFX production routes own
behavior proof.

## References

- [Dungeon Feature Docs](../README.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
