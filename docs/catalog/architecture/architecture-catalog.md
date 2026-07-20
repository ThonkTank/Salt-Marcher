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
│   ├── CatalogControlFactory
│   └── CatalogPicker
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
- optional paging and typed row or section action declarations
- optional provider revision observation used only while the section is active

`CatalogWorkspaceController` binds each declared action to the explicitly
composed outward route for that section. The three provider-owned create routes
and the four non-mutating unavailable outcomes are exhaustively composed there;
the renderer cannot infer availability or invent a mutation.

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
- page, total, stable selection, provider revision, stale marker, and one
  generic `SortState` consisting of a declared column id and direction
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

Sorting is application state rather than a control-specific callback. A
section maps the generic sort state to its typed provider query and declares
which columns accept it. Header activation is the sole presentation input for
changing that state; providers do not leak their own sort widgets into Catalog.

A refresh retains the last successful rows while exposing `refreshing`. A
failure may retain that read-only result with a retry action, but it cannot be
reported as current success. A selected identity survives refresh only when it
is present in the accepted result.

## Actions And Cross-Feature State

Selecting or opening a row is read-only with respect to Encounter and Scene.
Every external change uses a named typed action route. Catalog consumes a typed
outcome where the provider API supplies one; synchronous provider callbacks and
unavailable create capabilities publish only their explicit local feedback.

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

Three section-neutral presentation owners implement the shared Catalog surface:
`CatalogSectionRenderer`, `CatalogControlFactory`, and `CatalogPicker`.
`CatalogSectionRenderer` composes the selected section from the sealed filter
specifications, column specifications, paging capability, action specifications,
and immutable state. Changing section rebinds or rebuilds this one renderer;
application state, not seven retained node trees, preserves work.

`CatalogWorkspaceView` owns one main JavaFX root for the lifetime of the
workspace. `CatalogSectionRenderer` replaces or rebinds only content beneath
that root; a section cannot supply another main root, nested workspace shell,
or retained node tree.

`CatalogPicker` owns the section-neutral virtualized choice and multi-choice
picker, including its popup, selection, and option-cell lifecycle.
`CatalogControlFactory` owns the remaining declared Catalog visual roles and
creates their controls. Section definitions cannot construct controls or assign
styles. The renderer owns:

- the persistent section selector and compact wrapping controls area
- inside-label search, selection, range, and filter controls
- one chip per active filter value, selective removal, and whole-filter reset
- status, empty and failure presentation, table, paging, keyboard,
  accessibility, and stable-id selection
- header-only sort interaction and the unified result footer containing count,
  status, and optional pagination
- one consistent create control backed by a typed provider route or a
  side-effect-free unavailable capability that returns visible feedback;
  details remain row-driven and have no dedicated button
- the shared 28 px control and 12 px regular type contract, plus the compact
  chip information style

Section-specific behavior is limited to typed data, columns, filters, and
actions. A one-off JavaFX escape hatch is not a supported section capability.

Choice and multi-choice filters use virtualized picker content so node count
tracks visible options rather than provider result size. Their option source is
loaded only for the active session. Overlapping requests share one in-flight
load, and its successful result is cached independently of page request epochs.
A failure is never cached as an empty success: successful page rows remain
read-only, the footer reports the option failure, and the next active query
retries the load.

## Persistence, Execution, And Failure Isolation

Catalog never receives `SqliteDatabase`, JDBC, paths, or migration plans.
Provider services are created only after their owner-scoped storage readiness
is known under the [persistence lifecycle](../../project/contract/persistence-lifecycle.md).

Persistence-backed queries run outside the JavaFX thread. Creature and Item
catalog reads use independent bounded read lanes, so a slow or failed Item read
cannot queue behind or block Creature lookup, and vice versa. Other independent
provider reads may likewise execute concurrently; ordered writes are serialized
by their owning feature or store, not by one application-wide queue. One
provider's newer schema, migration failure, unavailable source, option-load
failure, or query failure becomes only that section's typed unavailable or
failed state.

These read lanes, caches, sort state, and presentation mechanisms do not move
record or persistence ownership into Catalog. Creature, Item, Encounter, World
Planner, and Encounter Table APIs remain the authoritative routes; their
provider and persisted truth is unchanged.

Diagnostics remain payload-free and local. A visible failure carries a stable
local diagnostic id and retryability, not SQL, paths, or exception messages.

## Composition And Enforcement

`CatalogFeature` receives the seven definitions plus the UI dispatcher and
constructs the workspace and contribution. `app` explicitly supplies provider
APIs and outward routes; neither Catalog nor shell locates services.

Permanent structural and production-route proof jointly enforce:

- Catalog application imports provider APIs but no foreign implementation,
  JavaFX, JDBC, or persistence package
- Catalog has no domain or SQLite role
- exactly seven definitions are explicitly composed
- section definitions contain no JavaFX nodes or style decisions
- only `CatalogSectionRenderer`, `CatalogControlFactory`, and the section-neutral
  `CatalogPicker`, including their nested classes, depend on JavaFX controls
- exactly one Catalog main root exists and sections cannot provide another
- all sortable sections consume the generic sort state through declared columns
- option pickers are virtualized, overlapping loads are coalesced, and only
  successful option results are cached
- Creature and Item stateless Catalog reads use separate bounded lanes while
  Creature state-publishing commands retain their serialized execution lane
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
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Shell Layer](../../project/architecture/patterns/shell-layer.md)
