Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Target Dungeon adoption of the Maps canvas through feature APIs
and explicit application composition.

# Dungeon Map Adoption Architecture

## Purpose And Scope

This specification defines how the Dungeon feature adopts the passive Maps
canvas for editor and travel workspaces. It serves Dungeon, Maps, shell, and
application-composition maintainers.

It owns the structural translation between Dungeon API state and Maps API scene
and pointer types. Dungeon requirements own observable editor and travel
behavior; Dungeon domain and persistence documents own authored truth and stored
truth.

## Target Ownership

```text
features/dungeon/
  api/             Authored, Editor, and Travel capabilities and state
  domain/          authored dungeon truth and invariants
  application/     authored/catalog, editor-session, and travel orchestration
  adapter/sqlite/  authored dungeon persistence
  adapter/javafx/  shell contribution and Dungeon-to-Maps translation
  <feature root>   Dungeon composition entry point used by app
```

The Dungeon JavaFX adapter may depend on `features.dungeon.api`,
`features.maps.api`, `shell.api`, and feature-neutral UI contracts. It must not
reach into Dungeon domain, application, or SQLite packages. Maps must not depend
on any Dungeon package.

## Composition And Dependencies

`app` constructs platform persistence, the Maps entry point, and the Dungeon
entry point explicitly. It supplies Dungeon with the Maps canvas capability and
any foreign feature APIs required by travel composition. Dungeon exposes its
constructed shell contribution and public APIs back to `app`; internal
repositories and adapters remain feature-private.

No shell discovery, service locator, or implementation-name convention is part
of the target route.

## Translation Boundary

The Dungeon JavaFX adapter is the single owner of both directions:

- Dungeon API state to one canvas-native Maps API scene revision
- Maps API pointer and hit samples to typed Dungeon API inputs

Dungeon-grid coordinates, topology identity, preview meaning, editing tools,
selection, and travel actions remain Dungeon-owned. Canvas coordinates, camera,
viewport, draw order, and technical hit capture remain Maps-owned.

The adapter may derive render primitives, labels, overlays, markers, graph
relations, and token anchors from immutable Dungeon API state. Those derived
values are presentation state, never authored dungeon truth or persistence
input.

## Capability Paths

### Authored And Editor Read

`Dungeon API state -> Dungeon JavaFX translation -> Maps API scene -> Maps canvas`

### Preview And Apply

`Maps pointer sample -> Dungeon JavaFX translation -> Dungeon Editor API -> Dungeon application -> immutable Dungeon API state -> translated Maps scene`

Preview and apply reuse the same authored operation vocabulary. Preview does not
persist; apply commits only after Dungeon validation succeeds.

### Travel

`Maps pointer sample or travel control -> Dungeon JavaFX translation -> Dungeon Travel API -> Dungeon application -> immutable travel state -> translated Maps scene`

Party position remains owned by the Party feature and reaches Dungeon only
through the Party API supplied during explicit composition.

### Authored Catalog

Map search, create, rename, delete, and selection use the catalog capability of
`DungeonAuthoredApi`. Catalog behavior does not pass through the Maps canvas
API.

## Decisions And Rationale

- Dungeon remains one feature with separate Authored, Editor, and Travel APIs;
  authored catalog work belongs to `DungeonAuthoredApi`.
- One JavaFX translation owner keeps dungeon-grid conversion and hit identity
  consistent across editor and travel surfaces.
- Maps receives canvas-native presentation facts only; it never receives
  Dungeon commands, aggregates, repositories, or persistence rows.
- Render-ready state is derived in the JavaFX adapter from revisioned Dungeon API
  state and must not become a second Dungeon publication or persistence model.
- Cross-feature calls target APIs only and are injected by `app`.

## Verification

- `architectureTest` checks target package direction and cross-feature API-only
  dependencies.
- Production-route JUnit tests prove editor preview/apply, travel action, catalog,
  scene translation, draw/hit identity, and empty-state behavior.
- Review rejects a second Dungeon-to-Maps translator or render-state owner.

## References

- [Maps Canvas Architecture](architecture-maps-canvas.md)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md)
- [Dungeon Map Surface Contract](../contract/contract-maps-dungeon-surface.md)
- [Dungeon Feature Overview](../../dungeon/README.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Application Composition Standard](../../project/architecture/patterns/application-composition.md)
