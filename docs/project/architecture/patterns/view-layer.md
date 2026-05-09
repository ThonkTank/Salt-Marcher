Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
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
or more passive `*View` files. Reusable generic content under
`src/view/slotcontent/**` uses the same projection-model family through
`*ContentModel`.

`ContributionModel` and `ContentModel` are the two concrete forms of the same
projection-model role. `ContentModel` owns component-specific presentation
state and component-specific presentation logic for one reusable
`slotcontent/**` unit. `ContributionModel` owns root-wide projection state and
orchestrates child `ContentModel`s so the active root does not collapse into a
second component-level god-model. Both model forms may expose the input-
relevant facts their same-root `IntentHandler` needs for interpretation, but
neither owns shell APIs, domain commands, application services, or hidden
orchestration channels.

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
  abstract role family for published observable state surfaces. It exists only
  as `*ContributionModel` in active roots and `*ContentModel` in reusable
  `slotcontent/**`
- `ContributionModel`
  bindable projection surface named `*ContributionModel`; owns the root-wide
  observable state of one shell-hung contribution, including aggregate
  render-relevant and input-relevant facts, and orchestrates child
  `ContentModel`s without absorbing their component-specific logic
- `ContentModel`
  bindable projection surface named `*ContentModel`; owns the component-
  specific render-relevant and input-relevant state of one reusable
  `slotcontent/**` unit together with that unit's component-specific
  presentation logic
- `IntentHandler`
  optional input-side role named `*IntentHandler` that exists only in active
  roots; owns one focused `consume(...)` entrypoint per interactive same-root
  or reused `View` surface, interprets each full immutable `*ViewInputEvent`
  snapshot from concrete snapshot fields rather than `source`/`action`
  command discriminators, may read same-root `ContributionModel` state and
  reused child `ContentModel` state when interpretation needs local UI facts,
  mutates only those same-root projection models when the resulting state is
  pure view-layer state, builds exactly one focused work request when a domain
  transition is needed, and calls the matching root `*ApplicationService`
  directly; it does not synthesize fallback `*ViewInputEvent` carriers for its
  own surface
- `View`
  passive JavaFX content named `*View`; renders already prepared presentation
  facts that arrive only through project-free inbound sink channels owned by
  the `View` itself, captures user input, constructs its own same-stem
  `*ViewInputEvent` snapshots directly from current widget/raw-event state,
  keeps no separate semantic local state or decision logic, and emits only
  those fire-and-forget snapshots
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
  leftbartabs/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the active root owns interactive input interpretation
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
  statetabs/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the active root owns interactive input interpretation
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
  dropdowns/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the active root owns interactive input interpretation
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
  slotcontent/<slot>/<entry>/
    <Entry>View.java
    <Entry>ContentModel.java
    <Entry>ViewInputEvent.java       # only for interactive Views
```

Rules:

- every active root is one contribution and therefore has exactly one
  `*Contribution`, exactly one `*Binder`, exactly one aggregate
  `*ContributionModel`, and at least one passive `*View`
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
  only: `*View`, same-stem `*ViewInputEvent`, and `*ContentModel`; input
  interpretation for those units stays in the same-root active
  `*IntentHandler`
- a reusable `slotcontent/**` `*View` stays dumb: it renders flat observable
  state that its own `*ContentModel` already prepared and published into the
  View-owned sink channels, and emits exactly one same-stem `*ViewInputEvent`
  full snapshot
- reusable `slotcontent/**` `*ContentModel`s own component-specific
  presentation state and component-specific presentation logic so the active-
  root `*ContributionModel` can orchestrate child components instead of
  absorbing all reusable component state itself
- reusable input interpretation belongs in the same-root active
  `*IntentHandler`; that ownership does not widen reusable `*View`
  responsibilities
- when passive-View hotspot pressure appears, first move render preparation,
  hit preparation, label/geometry derivation, ordering, selection, and other
  input-relevant facts into the owning `*ContributionModel`,
  `*ContentModel`, or same-context `published/*Model` readback path before
  introducing more helper structure inside the `View`
- passive `View`s must not know projection-model classes directly; if a
  prepared render fact is needed, the owning model or Binder must publish it
  through a project-free sink channel on the `View`
- non-role-bearing standalone files under `src/view/**` are forbidden;
  implementation details must be explicit roles or nested/private helper types
  inside a role file
- `slotcontent/**` is reserved for reusable generic components only
- existing `*ViewModel`, `*PresentationModel`, `*Projector`, component-local
  `View/`, `assembly/`, `Controller/`, `interactor/`, or old `api/` buckets
  are migration debt

## Dependency Direction

```text
Contribution      -> shell.api + same-root Binder
Binder            -> shell.api + same-root ContributionModel + optional same-root IntentHandler
                   + same-root feature Views + same-root ViewInputEvents
                   + reusable slotcontent Views + reusable slotcontent ContentModels
                   + reusable slotcontent ViewInputEvents + root domain ApplicationService types
                   + same-context read-side domain *Model handles
ContributionModel -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types + child ContentModels
ContentModel      -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
IntentHandler     -> same-root ContributionModel + same-root and reused slotcontent ViewInputEvents
                   + reused slotcontent ContentModels + root domain ApplicationService types
                   + same-surface local value/support types
View              -> JavaFX UI APIs + own ViewInputEvent type
                   + project-free prepared-state sink surfaces
                   + same-surface local technical support only
ViewInputEvent    -> JDK/JavaFX technical input/value types + same-surface local support only
Model             -> no shell, view, JavaFX, or data implementation types
Shell             -> shell contracts and generic hosting only
```

Additional rules:

- the Binder may know only its same-root `ContributionModel`, `IntentHandler`,
  feature-specific `View`, same-root `ViewInputEvent` types, reusable
  slotcontent surfaces, direct runtime-service seams, and same-context
  `published/*Model` handles directly
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
  Binder/model assembly and project-free View sink channels instead
- reusable `slotcontent/**` units must not depend on contribution-specific
  Views or support types, and `slotcontent/primitives/**` must not depend on
  non-primitive reusable or contribution-specific components
- `slotcontent/primitives/**` follows that same closed reusable-unit shape; if
  a reusable primitive needs render-ready or hit-ready data, that data belongs
  in the unit's `*ContentModel` and its same-stem `*ViewInputEvent`
- outside the explicitly documented `IntentHandler -> ApplicationService` write
  seam and model-owned `published/**` readback seam, no direct domain/view-
  layer connections are allowed
- direct `View` callback APIs, direct Binder subscriptions to request/token protocols on projection
  models, and any third presentation-state mutation route are forbidden
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
2. that `*View` exposes exactly one outward input seam:
   `onViewInputEvent(Consumer<SameStemViewInputEvent>)`
3. the Binder-installed listener forwards that carrier into the same-root
   `IntentHandler`
4. the same-root `IntentHandler` uses the focused entrypoint for that `View`,
   interprets the full snapshot into exactly one local input-side meaning from
   the concrete snapshot fields, reads any additional UI facts only from the
   same-root `ContributionModel` and reused child `ContentModel`s, and mutates
   only those projection models when the result is pure view-layer state
5. the same-root `ContributionModel` or reused child `ContentModel` publishes
   the updated prepared render facts through the installed project-free
   inbound sink channels on the passive `View`

Direct domain-write roundtrip:

1. an interactive passive `*View` emits exactly one immutable same-stem
   `*ViewInputEvent` full snapshot for its own surface
2. the Binder-installed listener forwards that carrier into the same-root
   `IntentHandler`
3. the same-root `IntentHandler` interprets the full snapshot, builds exactly
   one focused work request, and calls the matching root `*ApplicationService`
   entrypoint directly
4. domain completion emits the new observable same-context domain state
   through a read-side `published/*Model` handle
5. the same-root `ContributionModel` and any child `ContentModel`s that own
   reused component state subscribe to that `published/*Model` readback and
   update only their listener-facing projection state
6. the local projection model derives only the flat observable values needed
   for rendering and local intent interpretation
7. the same-root `ContributionModel` and any child `ContentModel`s publish
   those prepared render facts through the installed project-free inbound sink
   channels on the passive `View`

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

This means:

- `ContributionModel` and `ContentModel` do expose active tool, selection,
  hovered target, and other input-relevant state when the same-root
  `IntentHandler` needs those facts to interpret a full `ViewInputEvent`
- those exposed facts remain projection state only; they are not an
  `IntentHandler` backchannel for reconstructing write-side commands from
  imperative request fields or ad-hoc session mirrors
- `ContributionModel` and `ContentModel` do not expose request fields, command
  carriers, request-token/publish-like outward APIs, service handles, shell
  contracts, or deep nested orchestration state
- `ContributionModel` and `ContentModel` expose observable state only; they do
  not emit separate presentation-event APIs
- pure view-layer state such as open dropdown state, transient widget focus,
  or comparable UI-only mode state may be mutated directly by the local
  `IntentHandler` in the same-root `ContributionModel` or a reused child
  `ContentModel` without a domain roundtrip
- if one same-context `published/*Model` intentionally represents an
  application-owned session rather than authored write-model truth, that
  session may still own authoritative non-persisted interaction facts such as
  editor selection, preview, active tool, or projection settings
  provided those facts return to the view layer only through
  `current()` and `subscribe(...)` on that `published/*Model`
- a `View` without a local `IntentHandler` still stays passive; it does not
  infer business meaning, construct write-side carriers, or mutate model state
  through alternate callback seams
- a reusable unit owns its own `ContentModel`; reusable projection or
  interpretation duties do not shift into the passive `View` itself
- when a reusable shared primitive still needs broad preparation logic after
  that move, the next step is stronger model or readback preparation above the
  primitive, not a spread of free top-level helper files inside the primitive
  package
- `IntentHandler` owns input interpretation and direct service invocation, but
  not view instantiation or shell APIs
- when a domain roundtrip is needed, the `IntentHandler` builds exactly one
  focused work request from the received `ViewInputEvent`; it does not
  synthesize refresh/request protocols or rebuild a richer command/session
  object from projection state
- thin same-context `published/*Model` readback remains the only authoritative
  return path into the view layer
- passive Views do not imperatively query business meaning, do not receive
  presenter-style commands, do not send ad-hoc partial event bags, and do not
  expect synchronous technical acknowledgements from the `IntentHandler`

## References

- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View ContributionModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-model-enforcement.md:1)
- [View ContentModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-content-model-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
