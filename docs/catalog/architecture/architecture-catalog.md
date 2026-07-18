Status: Active Target
Owner: Catalog Feature
Last Reviewed: 2026-07-19
Source of Truth: Catalog application ownership, typed section composition,
presentation boundary, lifecycle, and dependency direction.

# Catalog Architecture

## Purpose And Boundary

Catalog is the read-and-handoff workspace for reference content. It owns the
user's transient browsing experience: active section, unfinished input,
committed query, result lifecycle, sort, page, selection, and explicit actions.
It owns no creature, item, Encounter, World Planner, or Encounter Table truth
and has no persistence adapter.

Provider features remain the sole owners of durable records, validation,
migrations, details, and mutations. Catalog consumes only their public APIs.
Encounter owns generation pool criteria; the visible Monster filter editor
edits that typed capability and queries Creatures with the accepted revision.

## Target Topology

```text
features/catalog/
├── application/
│   ├── CatalogWorkspace
│   ├── BrowseSession
│   ├── CatalogSectionDefinition
│   ├── CatalogSectionState
│   └── CatalogResult
├── adapter/javafx/
│   ├── CatalogContribution
│   ├── CatalogWorkspaceView
│   ├── CatalogSectionRenderer
│   └── CatalogControlFactory
└── CatalogFeature
```

The seven sections are statically and explicitly composed. They are not seven
controllers or JavaFX view classes. Each is a typed definition that supplies
provider query translation, immutable filter fields, columns, stable identity,
and available actions to shared application and presentation mechanisms.

Runtime discovery and a plugin registry are rejected because the product owns
exactly seven sections and has no extension need.

## Typed Section Definition

`CatalogSectionDefinition<Q, R, K>` contains:

- stable section id, label, and initial immutable query draft
- typed filter specifications with getters and immutable updaters
- provider query function and provider-result translation
- stable row identity and table column specifications
- optional paging and typed row or section actions
- optional provider revision observation used only while the section is active

Filter specifications are a sealed family for text search, single choice,
multi-choice, range, and tri-state values. They do not use string-keyed maps,
untyped values, reflection, JavaFX nodes, CSS classes, or provider persistence
types.

Provider APIs keep their own result vocabularies. The definition translates at
the real consumer boundary into one Catalog result model rather than requiring
providers to depend on Catalog.

## Browse Session And Workspace State

One reusable `BrowseSession<Q, R, K>` owns the lifecycle shared by all sections:

- unfinished draft and last committed query
- 200 ms debounce and immediate Enter submission
- request epoch and cancellation or invalidation of superseded work
- page, total, stable selection, provider revision, and stale marker
- immutable result state: uninitialized, loading, refreshing, ready, empty,
  invalid, unavailable, or failed

Only the selected session is active. Activating a section observes its provider
and queries when uninitialized, stale, or edited. Deactivating it releases the
subscription and invalidates in-flight publication while retaining immutable
state. An inactive section performs no query, option load, or provider
subscription.

The workspace owns the active section and the seven retained session states.
It publishes one revisioned immutable snapshot. JavaFX state is never the
source of unfinished input or selection.

A refresh retains the last successful rows while exposing `refreshing`. A
failure may retain that read-only result with a retry action, but it cannot be
reported as current success. A selected identity survives refresh only when it
is present in the accepted result.

## Actions And Cross-Feature State

Selecting or opening a row is read-only with respect to Encounter and Scene.
Every external change uses a named typed action and returns a typed action
outcome for visible feedback.

Catalog consumes exact routes for:

- provider-owned details and editors in the Inspector
- adding a Creature or NPC to Encounter or focused Scene
- opening a saved Encounter with the provider-owned discard decision
- selecting faction, location, or Encounter Table sources for Encounter
- assigning the focused Scene location

Catalog does not coordinate a cross-provider transaction. A future action that
requires one must be owned by the feature that owns the consistency boundary,
not by callbacks or a Catalog database.

Monster generation filters have one canonical owner: Encounter. Catalog keeps
only the unfinished editor value required to show invalid or not-yet-debounced
input. An accepted filter command returns or publishes its revision; the
Creature query records that revision so late readback cannot replace newer
visible work.

## JavaFX Presentation

`CatalogSectionRenderer` is the only section result and control renderer. It
constructs the selected section from the sealed filter specifications, column
specifications, paging capability, action specifications, and immutable state.
Changing section rebinds or rebuilds this one renderer; application state, not
seven retained node trees, preserves work.

`CatalogControlFactory` owns the approved Catalog visual roles and creates all
interactive controls. Section definitions cannot construct controls or assign
styles. The renderer owns:

- the persistent section selector and compact wrapping controls area
- inside-label search, selection, range, and filter controls
- active-filter chips and clear behavior
- status, empty and failure presentation, retry, table, paging, keyboard,
  accessibility, and stable-id selection
- the shared 28 px control and 12 px regular type contract, plus the compact
  chip information style

Section-specific behavior is limited to typed data, columns, filters, and
actions. A one-off JavaFX escape hatch is not a supported section capability.

## Persistence, Execution, And Failure Isolation

Catalog never receives `SqliteDatabase`, JDBC, paths, or migration plans.
Provider services are created only after their owner-scoped storage readiness
is known under the [persistence lifecycle](../../project/contract/persistence-lifecycle.md).

Persistence-backed queries run outside the JavaFX thread. Independent provider
reads may execute concurrently on a bounded I/O executor; ordered writes are
serialized by their owning feature or store, not by one application-wide queue.
One provider's newer schema, migration failure, unavailable source, or query
failure becomes only that section's typed unavailable or failed state.

Diagnostics remain payload-free and local. A visible failure carries a stable
local diagnostic id and retryability, not SQL, paths, or exception messages.

## Composition And Enforcement

`CatalogFeature` receives the seven definitions plus the UI dispatcher and
constructs the workspace and contribution. `app` explicitly supplies provider
APIs and outward routes; neither Catalog nor shell locates services.

Permanent architecture proof enforces:

- Catalog application imports provider APIs but no foreign implementation,
  JavaFX, JDBC, or persistence package
- Catalog has no domain or SQLite role
- exactly seven definitions are explicitly composed
- section definitions contain no JavaFX nodes or style decisions
- only the shared renderer and control factory construct Catalog controls and tables
- no section-specific lifecycle controller or JavaFX section class returns
- inactive sections cannot acquire subscriptions or issue provider calls in
  production-route lifecycle tests

Automated checks are evidence for these boundaries, not authority to retain a
superseded topology.

## Rejected Alternatives

- Seven controllers and seven JavaFX section roots are rejected because they
  duplicate one browsing lifecycle and one presentation grammar.
- Eager activation is rejected because invisible sections have no user work to
  perform and failures or latency must remain isolated.
- A dynamic form map is rejected because it sacrifices typed update semantics.
- A Catalog-owned read database is rejected because it duplicates provider
  truth and creates synchronization invariants.
- One global serial execution lane is rejected because independent reads and
  failures do not share an ordering invariant.

## References

- [Catalog Requirements](../requirements/requirements-catalog.md)
- [Catalog Greenfield Roadmap](../delivery/roadmap-catalog-greenfield.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Shell Layer](../../project/architecture/patterns/shell-layer.md)
