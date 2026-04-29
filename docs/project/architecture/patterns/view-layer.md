Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
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
projection-model role. They own the complete state surface relevant to their
own scope: render text, render data, labels, enablement, selections, active
tools, and the other input-relevant facts needed so the local `IntentHandler`
can interpret user input. They do not own shell APIs, domain commands,
application services, or hidden orchestration channels.

The role lists in this standard are exhaustive. Anything not explicitly named
as allowed content, allowed dependency, or allowed responsibility does not
belong in that role.

## Roles

- `Model`
  `src/domain/**`, exposed to the view layer only through root
  `*ApplicationService` boundaries and explicit read-side domain
  `published/**` carrier types
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
  bindable projection surface named `*ContributionModel`; owns all
  contribution-relevant observable state for one shell-hung contribution,
  including both render-relevant and input-relevant facts
- `ContentModel`
  bindable projection surface named `*ContentModel`; owns the reusable
  render-relevant and input-relevant state of one reusable `slotcontent/**`
  unit when that unit has state of its own
- `IntentHandler`
  optional input-side role named `*IntentHandler`; consumes one full
  immutable `*ViewInputEvent` snapshot per interactive View surface for one
  active root or reusable `slotcontent` unit, interprets that snapshot,
  mutates only its co-located model, and publishes only through
  Binder-installed `Consumer<*PublishedEvent>` sink seams when domain work is
  required
- `View`
  passive JavaFX content named `*View`; renders observable model state,
  captures user input, and emits only fire-and-forget `*ViewInputEvent`
  snapshots
- `ViewInputEvent`
  immutable, co-located technical full-snapshot carrier named
  `*ViewInputEvent`; each interactive passive `*View` owns exactly one
  same-stem such carrier and each carrier belongs only to its local
  interactive view surface
- `PublishedEvent`
  optional same-root write-side carrier named `*PublishedEvent`; it is built
  by the `IntentHandler`, consumed only through a Binder-installed sink seam,
  and never emitted directly by a `View`
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
    <Entry>IntentHandler.java         # optional only when the contribution exposes no interactive View
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
    <Entry>*PublishedEvent.java       # optional write-side sink carriers
  statetabs/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the contribution exposes no interactive View
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
    <Entry>*PublishedEvent.java       # optional write-side sink carriers
  dropdowns/<entry>/
    <Entry>Contribution.java
    <Entry>Binder.java
    <Entry>ContributionModel.java
    <Entry>IntentHandler.java         # optional only when the contribution exposes no interactive View
    <Entry>*View.java                 # at least one
    <Entry>*ViewInputEvent.java       # only for interactive Views
    <Entry>*PublishedEvent.java       # optional write-side sink carriers
  slotcontent/<slot>/<entry>/
    <Entry>View.java
    <Entry>ContentModel.java          # optional only for fully passive/stateless reusable units
    <Entry>IntentHandler.java         # optional only when the reusable unit exposes no interactive View
    <Entry>ViewInputEvent.java        # only for interactive reusable Views
    <Entry>PublishedEvent.java        # optional write-side sink carriers
    <Entry>InspectorEntry.java        # details only
    MapRenderScene.java               # allowed mapcanvas support values only
    CanvasPointerEvent.java           # allowed mapcanvas support values only
```

Rules:

- every active root is one contribution and therefore has exactly one
  `*Contribution`, exactly one `*Binder`, exactly one aggregate
  `*ContributionModel`, and at least one passive `*View`
- active roots may define zero or one root-local `*IntentHandler`
- active roots with an `*IntentHandler` require same-stem
  `*ViewInputEvent` carriers for each interactive passive `*View`
- active roots may additionally define write-side `*PublishedEvent` carriers
  when domain work must cross the Binder/ApplicationService seam
- reusable `slotcontent/**` units must not define `*Contribution` or `*Binder`
- reusable `slotcontent/**` units may define zero or one `*ContentModel` and
  zero or one `*IntentHandler`
- interactive reusable `slotcontent/**` units with an `*IntentHandler` must
  own exactly one `*ContentModel`
- the absence of an `*IntentHandler` never expands `*View` responsibilities;
  non-interactive units remain passive and must not interpret intent, mutate
  model state from callbacks, or publish write-side carriers
- the absence of a `*ContentModel` never expands `*View` or parent-model
  responsibilities; a reusable unit without a `*ContentModel` is passive and
  stateless rather than a hidden place for reusable projection logic
- non-rollentragende eigenstaendige Dateien under `src/view/**` are forbidden;
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
                   + optional same-root PublishedEvents
                   + reusable slotcontent roles + root domain ApplicationService types
                   + domain published carriers
ContributionModel -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
ContentModel      -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
IntentHandler     -> co-located ContributionModel or ContentModel + co-located ViewInputEvents
                   + Binder-injected Consumer<PublishedEvent> sink seams
                   + same-surface local value/support types
View              -> JavaFX UI APIs + observable ContributionModel or ContentModel surface
                   + own ViewInputEvent type + reusable slotcontent base views/support types
ViewInputEvent    -> JDK/JavaFX technical input/value types + same-surface local support only
PublishedEvent    -> JDK value types + same-surface local support only
Model             -> no shell, view, JavaFX, or data implementation types
Shell             -> shell contracts and generic hosting only
```

Additional rules:

- the Binder may know only its same-root `ContributionModel`, `IntentHandler`,
  feature-specific `View`, same-root `ViewInputEvent` types, and optional
  same-root write-side `PublishedEvent` types directly
- the Binder may additionally know reusable `slotcontent` roles when reuse is
  intentional
- feature-specific `View` classes may extend reusable generic counterparts from
  `src/view/slotcontent/**`
- reusable generic `slotcontent/**` Views or components may extend
  `src/view/slotcontent/primitives/**`
- the inheritance direction is one-way only:
  contribution-specific -> reusable `slotcontent/**` -> `slotcontent/primitives/**`
- reusable `slotcontent/**` units must not depend on contribution-specific
  Views or support types, and `slotcontent/primitives/**` must not depend on
  non-primitive reusable or contribution-specific components
- outside the explicitly documented Binder/domain and `published/**` readback
  seams, no direct domain/view-layer connections are allowed
- direct `View` callback APIs, direct `IntentHandler -> ApplicationService`
  calls, and any third presentation-state mutation route are forbidden

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
2. that `*View` exposes exactly one outward input seam:
   `onViewInputEvent(Consumer<SameStemViewInputEvent>)`
3. the Binder-installed listener forwards that carrier into the optional
   `IntentHandler`
4. the `IntentHandler` interprets the full snapshot into exactly one local
   input-side meaning and mutates only its co-located model
5. passive Views react through bindings or listeners to the updated
   `ContributionModel` or `ContentModel`

Domain-write cycle:

1. an interactive passive `*View` emits exactly one immutable same-stem
   `*ViewInputEvent` full snapshot for its own surface
2. the Binder-installed listener forwards that carrier into the optional
   `IntentHandler`
3. the `IntentHandler` interprets the full snapshot, builds exactly one
   write-side `*PublishedEvent`, and publishes it only through a
   Binder-installed `Consumer<*PublishedEvent>` sink seam
4. the Binder-owned sink translates that carrier into exactly one root
   `*ApplicationService` entrypoint call
5. domain completion changes published domain state and surfaces read-side
   `published/**` facts through the `*ApplicationService` boundary
6. Binder-owned readback wiring delivers those facts into listener-facing
   model intake seams
7. the model derives only the flat observable values needed for rendering and
   local intent interpretation
8. passive Views react through bindings or listeners

This means:

- `ContributionModel` and `ContentModel` do expose active tool, selection,
  hovered target, and other input-relevant state when the local
  `IntentHandler` needs those facts to interpret a full `ViewInputEvent`
- `ContributionModel` and `ContentModel` do not expose request fields, command
  carriers, service handles, shell contracts, or deep nested orchestration
  state
- `ContributionModel` and `ContentModel` expose observable state only; they do
  not emit separate presentation-event APIs
- a `View` without a local `IntentHandler` still stays passive; it does not
  infer business meaning, construct write-side carriers, or mutate model state
  through alternate callback seams
- a reusable unit without a `ContentModel` still stays passive/stateless; it
  does not shift reusable projection or interpretation duties into the `View`
  itself
- `IntentHandler` owns input interpretation and write-side carrier
  publication, but not domain lookup, direct service invocation, view
  instantiation, or shell APIs
- one root `*ApplicationService` entrypoint must not be fed by more than one
  same-root write-side `*PublishedEvent` type; needing several carriers for
  one entrypoint is a modelling error
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
- [View InspectorEntry Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-inspector-entry-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)
