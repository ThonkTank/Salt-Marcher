Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-12
Source of Truth: SaltMarcher cockpit view-layer target model, topology, fixed
shell surfaces, allowed domain/view seams for `src/view/**`, and the two only
allowed presentation-state mutation paths.

# View Layer Standard

## Goal

SaltMarcher uses a cockpit-specific contribution architecture for the view
layer.

The domain layer remains the `Model`. Each active view root under
`src/view/leftbartabs/**`, `src/view/statetabs/**`, or
`src/view/dropdowns/**` is exactly one shell-hung `Contribution`: one tab or
one window. That contribution consists only of `*Contribution`, `*Binder`,
exactly one aggregate `*ContributionModel`, optional `*IntentHandler`, and one
or more passive `*View` files, each paired with exactly one co-located
same-stem `*ContentModel`. Reusable generic content under
`src/view/slotcontent/**` uses the same View + ContentModel + optional
ViewInputEvent role family, but reuse placement is not the only legal
`ContentModel` home.

`ContributionModel` and `ContentModel` are the public bindable forms of the
projection-model role. `ContentModel` owns component-specific presentation
state and component-specific presentation logic for one same-stem passive
`View`, whether that pair is feature-specific inside an active root or reusable
under `slotcontent/**`. `ContentPartModel` is an owned `ContentModel` submodel
inside the same view unit for a bounded render, hit, viewport, editing, or other
component-specific concern that would otherwise force a `ContentModel` into a
god-model. `ContributionModel` owns root-wide projection state and orchestrates
child `ContentModel`s so the active root does not collapse into a
component-level god-model. Projection models may expose the input-relevant
facts their same-root `IntentHandler` needs for interpretation, but none owns
shell APIs, domain commands, application services, or hidden orchestration
channels.

The role lists in this standard are exhaustive. Anything not explicitly named
as allowed content, allowed dependency, or allowed responsibility does not
belong in that role.

## Roles

- `Model`
  `src/domain/**`, exposed to the view layer only through root
  `*ApplicationService` boundaries and explicit read-side domain
  `published/**` carrier types, especially read-only same-context
  `published/*Model` handles for observable current domain state
- `Contribution`
  shell-discovered adapter named `*Contribution`; owns registration metadata
  only and delegates runtime binding to the co-located `*Binder`
- `Binder`
  one active-root lifecycle and wiring owner named `*Binder`; owns shell
  lookup, role instantiation, listener wiring, binding, shell-facing slot
  binding, and the explicitly allowed domain-facing seams
- `ProjectionModel`
  abstract role family for published observable state surfaces and owned
  projection submodels. Its public bindable forms are exactly one aggregate
  `*ContributionModel` in active roots and same-stem `*ContentModel` surfaces
  paired with passive `*View` files; `*ContentPartModel` exists only as a
  non-public owned submodel of a `ContentModel`
- `ContributionModel`
  bindable projection surface named `*ContributionModel`; owns the root-wide
  observable state of one shell-hung contribution, coordinates readback intake
  and root-level facts such as mode, status, and cross-surface selection, and
  orchestrates child `ContentModel`s without absorbing their component-specific
  render or input logic
- `ContentModel`
  bindable projection surface named `*ContentModel`; owns the component-
  specific render-relevant and input-relevant state of exactly one same-stem
  passive `View` together with that View's component-specific presentation
  logic
- `ContentPartModel`
  owned projection submodel named `*ContentPartModel`; lives in the same view
  unit as its owning `ContentModel`, owns one bounded slice of
  component-specific presentation logic such as render-state projection,
  hit-target indexing, viewport/camera state, or inline edit state, and must not
  become a standalone helper, second passive View model, domain command surface,
  or alternate input/write protocol
- `IntentHandler`
  optional input-side role named `*IntentHandler` that exists only in active
  roots; owns one focused `consume(...)` entrypoint per interactive same-root
  or reused `View` surface, interprets each full immutable `*ViewInputEvent`
  snapshot from concrete snapshot fields rather than `source`/`action`
  command discriminators, may read same-root `ContributionModel` state and
  same-root or reused child `ContentModel` state when interpretation needs
  local UI facts, mutates only the same-root `ContributionModel` or matching
  child `ContentModel`s when the resulting state is pure view-layer state,
  builds exactly one focused work request when a domain transition is needed,
  and calls the matching root `*ApplicationService` directly; it does not
  synthesize fallback `*ViewInputEvent` carriers for its own surface
- `View`
  passive JavaFX content named `*View`; binds only to its own same-stem
  `*ContentModel`, renders already prepared presentation facts from that model,
  captures user input, constructs its own same-stem `*ViewInputEvent` snapshots
  directly from current widget/raw-event state, may use private non-semantic `raw*` widget-read helpers, keeps no semantic local state or decision logic, and emits only those fire-and-forget snapshots
- `ViewInputEvent`
  immutable, co-located technical full-snapshot carrier named
  `*ViewInputEvent`; each interactive passive `*View` owns exactly one
  same-stem such carrier and each carrier belongs only to its local
  interactive view surface; the top-level carrier stays a plain snapshot
  record rather than a command API or top-level static factory surface, and
  therefore must not encode semantic routing through top-level `source` or
  `action` components or nested `Source` / `Action` enums
- `PublishedEvent`
  legacy same-root write-side carrier named `*PublishedEvent`; current gates
  still model it, but it is no longer part of the canonical target topology
- `Shell`
  passive cockpit host, fixed surfaces, activation lifecycle, details/history
  hosting, state-pane precedence, and top-bar window hosting

## Target Topology

```text
src/view/
  <leftbartabs|statetabs|dropdowns>/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the active root owns interactive input interpretation
    <Entry>*View.java                 # at least one
    <Entry>*ContentModel.java         # exactly one same-stem file for each View
    <Entry>*ContentPartModel.java     # optional owned projection submodels
    <Entry>*ViewInputEvent.java       # only for interactive Views
  slotcontent/<slot>/<entry>/
    <Entry>View.java
    <Entry>ContentModel.java
    <Entry>*ContentPartModel.java     # optional owned projection submodels
    <Entry>ViewInputEvent.java       # only for interactive Views
```

Rules:

- every active root is one contribution and therefore has exactly one
  `*Contribution`, exactly one `*Binder`, exactly one aggregate
  `*ContributionModel`, and at least one passive `*View`
- every passive active-root `*View` has exactly one same-stem co-located
  `*ContentModel`, and every such model belongs to that passive `*View`
- active roots and reusable `slotcontent/**` units may split bounded
  projection-model concerns into owned `*ContentPartModel` files in the same
  view unit; these files are not same-stem View pairs and do not replace the
  required main `*ContentModel`
- active roots may define zero or one root-local `*IntentHandler`
- active roots with an `*IntentHandler` require same-stem
  `*ViewInputEvent` carriers for each interactive passive `*View`
- reusable `slotcontent/**` units must not define `*Contribution` or `*Binder`
- every reusable `slotcontent/**` unit defines exactly one passive `*View`,
  exactly one `*ContentModel`, and for interactive reusable Views exactly one
  same-stem `*ViewInputEvent`
- `slotcontent/primitives/**` is only a placement bucket for especially low-
  level reusable UI surfaces; it is not a separate technical-base role family
  with different file types
- reusable `slotcontent/**` units use the closed reusable-unit role shape
  only: `*View`, same-stem `*ContentModel`, optional owned
  `*ContentPartModel` submodels, and same-stem `*ViewInputEvent`; their input
  interpretation stays in the same-root active `*IntentHandler`
- every passive `*View` stays dumb: it renders flat observable state that its
  own same-stem `*ContentModel` already prepared, and emits exactly one
  same-stem `*ViewInputEvent` full snapshot authored only from JDK value data
  when it is interactive
- `*ContentModel`s own component-specific presentation state and logic so the
  active-root `*ContributionModel` can
  orchestrate child components instead of absorbing component state itself
- reusable input interpretation belongs in the same-root active
  `*IntentHandler`; that ownership does not widen reusable `*View`
  responsibilities
- when passive-View hotspot pressure appears, first move render preparation,
  hit preparation, label/geometry derivation, ordering, selection, and other
  input-relevant facts into the owning `*ContributionModel`,
  `*ContentModel`, or same-context `published/*Model` readback path before
  introducing more helper structure inside the `View`
- passive `View`s must not know projection-model classes directly except their
  own same-stem `*ContentModel`; if a prepared render fact is needed, it
  belongs in that same-stem `ContentModel`
- passive `View`s must not inherit from, implement, or subscribe to foreign
  project `View` surfaces; reusable behavior travels through same-stem
  `ContentModel` binding and `*ViewInputEvent` snapshots, not direct APIs
- non-role-bearing standalone files under `src/view/**` are forbidden;
  implementation details must be explicit roles, owned `*ContentPartModel`
  submodels, or nested/private helper types inside a role file
- `slotcontent/**` is reserved for reusable generic components only
- existing `*ViewModel`, `*PresentationModel`, `*Projector`, component-local
  `View/`, `assembly/`, `Controller/`, `interactor/`, or old `api/` buckets
  are migration debt

## Dependency Direction

```text
Contribution      -> shell.api + same-root Binder
Binder            -> shell.api + same-root ContributionModel + optional same-root IntentHandler
                   + same-root feature Views + same-root ContentModels + same-root ViewInputEvents
                   + reusable slotcontent Views + reusable slotcontent ContentModels
                   + reusable slotcontent ViewInputEvents + root domain ApplicationService types
                   + same-context read-side domain *Model handles
ContributionModel -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types + child ContentModels
ContentModel      -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
                   + same-unit ContentPartModels
ContentPartModel  -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
                   + owning same-unit ContentModel value types
IntentHandler     -> same-root ContributionModel + same-root and reused slotcontent ViewInputEvents
                   + same-root and reused slotcontent ContentModels + root domain ApplicationService types
                   + same-surface local value/support types
View              -> JavaFX UI APIs + own ViewInputEvent type
                   + own same-stem ContentModel
                   + same-surface local technical support only
ViewInputEvent    -> JDK technical value types + same-surface local support only
Model             -> no shell, view, JavaFX, or data implementation types
Shell             -> shell contracts and generic hosting only
```

Additional rules:

- the Binder may know only its same-root `ContributionModel`, `IntentHandler`,
  `View`, `ContentModel`, `ViewInputEvent`, reusable slotcontent surfaces,
  direct runtime-service seams, and same-context `published/*Model` handles
- the Binder may wire forwarding of same-stem `ViewInputEvent` snapshots but
  must not synthesize, cache, or emit `*ViewInputEvent` carriers itself
- when an active root reuses `slotcontent/**`, the Binder may also know only
  that reusable unit's `*View`, `*ViewInputEvent`, and `*ContentModel`
  surfaces directly
- one top-level passive `View` must not subscribe to another top-level passive
  `View`'s `onViewInputEvent(...)` seam
- if a child widget needs internal callbacks inside one top-level surface, that
  child stays same-surface support code rather than becoming a second top-level
  `*View` plus `*ViewInputEvent` route in the same active root
- view-to-view reuse does not happen through direct passive-View inheritance or
  direct passive-View acquaintance; reusable presentation facts travel through
  Binder/model assembly and the reused View's own same-stem `ContentModel`
- passive `View` constructors must not accept project roles, callback/result
  protocols, or direct readback carriers; model wiring enters only through the
  View's own `bind(SameStemContentModel)` method and the single
  `onViewInputEvent(...)` route
- reusable `slotcontent/**` units must not depend on contribution-specific
  Views or support types, and `slotcontent/primitives/**` must not depend on
  non-primitive reusable or contribution-specific components
- `slotcontent/primitives/**` follows that same closed reusable-unit shape; if
  a reusable primitive needs render-ready or hit-ready data, that data belongs
  in the unit's `*ContentModel` and its same-stem `*ViewInputEvent`
- outside the explicitly documented `IntentHandler -> ApplicationService` write
  seam and model-owned `published/**` readback seam, no direct domain/view-
  layer connections are allowed
- direct `View` callback APIs, direct Binder subscriptions to request/token
  protocols on projection models, and any third presentation-state mutation
  route are forbidden
- if one same-root `ViewInputEvent` interpretation needs a purely local
  passive-View effect that neither mutates presentation state nor crosses a
  domain boundary, the Binder may install one same-root local effect sink on
  the `IntentHandler`; that effect stays view-local and must not become a
  second write or readback protocol
- a Binder must not treat direct `ApplicationService` return values such as
  `*Result`, `*Snapshot`, `*Payload`, `*CalculationResult`, `*SearchResult`,
  `*Preview`, or similar one-shot carriers as authoritative view-state input
  or as a feedback protocol for rendering or projection-model updates
- if a view root needs domain-backed observable state, the Binder acquires
  only a direct same-context read-side `published/*Model` runtime service and
  then reads it only through `current()` and `subscribe(...)`

## Canonical Interaction Model

Construction and wiring:

1. the shell activates a registered contribution
2. the contribution delegates binding to its co-located Binder
3. the Binder obtains runtime services, instantiates same-root roles and any
   needed reusable `slotcontent` roles, wires listeners, bindings, and
   callbacks, and returns a `ShellBinding`

SaltMarcher allows exactly two presentation-state mutation cycles.

Local presentation cycle:

1. an interactive passive `*View` emits exactly one immutable same-stem
   `*ViewInputEvent` full snapshot for its own surface
   that snapshot is constructed in the `View` itself from the current
   technical UI state rather than by a Binder or `IntentHandler`
   and it carries only JDK value data, not JavaFX event or widget objects
2. that `*View` exposes exactly one outward input seam:
   `onViewInputEvent(Consumer<SameStemViewInputEvent>)`
3. the Binder-installed listener forwards that carrier into the same-root
   `IntentHandler`
4. the same-root `IntentHandler` uses the focused entrypoint for that `View`,
   interprets the full snapshot into exactly one local input-side meaning from
   the concrete snapshot fields, reads any additional UI facts only from the
   same-root `ContributionModel` and the affected child `ContentModel`s, and
   mutates only those projection models when the result is pure view-layer
   state
5. the owning same-stem `ContentModel` exposes the updated prepared render
   facts through its bindable surface, and the passive `View` reacts through
   its `bind(SameStemContentModel)` wiring

Direct domain-write roundtrip:

1. an interactive passive `*View` emits exactly one immutable same-stem
   `*ViewInputEvent` full snapshot for its own surface
   and that carrier remains a JDK-only value snapshot
2. the Binder-installed listener forwards that carrier into the same-root
   `IntentHandler`
3. the same-root `IntentHandler` interprets the full snapshot, builds exactly
   one focused work request, and calls the matching root `*ApplicationService`
   entrypoint directly
4. domain completion emits the new observable same-context domain state
   through a read-side `published/*Model` handle
5. subscribed projection models update only listener-facing projection state
   and expose prepared render facts through their bindable surfaces

Domain read-side contract:

1. a Binder may acquire a same-context read-side `published/*Model` handle
   only as a direct runtime service during root wiring, not by calling back
   into a root `*ApplicationService`
2. the same-root `ContributionModel` and any child `ContentModel`s may read
   initial domain state from that handle only through `current()`
3. those models may continue readback only through `subscribe(...)`
4. the view layer must not treat direct one-shot `ApplicationService` return
   carriers such as `*Result`, `*Snapshot`, `*Payload`, `*CalculationResult`,
   `*SearchResult`, `*Preview`, or similar request-response types as the
   source of view-layer truth or mutation feedback
5. if a root cannot provide its domain-backed observable state through a
   read-side `published/*Model`, the architecture is incomplete and must not
   be disguised by direct Binder-side result-to-view-state copying

## References

- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
