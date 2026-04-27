Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: SaltMarcher cockpit view-layer target model, topology, fixed
shell surfaces, and allowed domain/view seams for `src/view/**`.

# View Layer Standard

## Goal

SaltMarcher uses a cockpit-specific presentation model architecture for the
view layer.

The domain layer remains the `Model`. `*Contribution` is the shell hook.
`*Binder` performs one-time composition and wiring. `*PresentationModel` owns
bindable projection state and read-only listener intake of domain
`published/**` facts. `*IntentHandler` interprets technical user input and
mutates only its co-located `PresentationModel`. `*View` stays passive and
reacts to observable `PresentationModel` state through bindings or listeners.

The target model deliberately removes `src/view/primitives/` as a canonical
root. Reusable generic view-layer building blocks live only under
`src/view/slotcontent/**`. Feature-specific components belong directly inside
their owning `leftbartabs`, `dropdowns`, or `statetabs` package.

## Roles

- `Model`: `src/domain/**`, exposed to the view layer only through root
  `*ApplicationService` boundaries and explicit `published/**` carrier types
- `Contribution`: shell-discovered adapter named `*Contribution`; owns
  registration metadata only and delegates runtime binding to the co-located
  `*Binder`
- `Binder`: one active-root lifecycle and wiring owner named `*Binder`; owns
  shell lookup, role instantiation, listener wiring, binding, shell-facing
  slot binding, and the explicitly allowed domain-facing seams
- `PresentationModel`: bindable projection surface named
  `*PresentationModel`; owns projection state and listener-facing intake of
  read-side `published/**` carriers for one active root or reusable
  `slotcontent` unit
- `IntentHandler`: optional input-side role named `*IntentHandler`;
  interprets technical user events for one active root or reusable
  `slotcontent` unit and mutates only its co-located `PresentationModel`
- `View`: passive JavaFX content named `*View`; renders observable
  `PresentationModel` state through bindings/listeners and emits only
  technical user events
- `Shell`: the passive cockpit host, fixed surfaces, activation lifecycle,
  details/history hosting, state-pane precedence, and top-bar window hosting

## Target Topology

Active view code is organized by UI entrypoint and reusable generic
`slotcontent` families:

```text
src/view/
  leftbartabs/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>Binder.java
      <PascalEntry>PresentationModel.java
      <PascalEntry>IntentHandler.java       # optional when the root is purely passive
      <PascalEntry>*View.java               # feature-specific colocated views
  statetabs/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>Binder.java
      <PascalEntry>PresentationModel.java
      <PascalEntry>IntentHandler.java       # optional when the root is purely passive
      <PascalEntry>*View.java
  dropdowns/
    <entry>/
      <PascalEntry>Contribution.java        # optional; only for shell-discovered dropdowns
      <PascalEntry>Binder.java
      <PascalEntry>PresentationModel.java
      <PascalEntry>IntentHandler.java       # optional when the root is purely passive
      <PascalEntry>*View.java
  slotcontent/
    controls/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
    main/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
    state/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
    details/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
      <PascalEntry>InspectorEntry.java
    topbar/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
    primitives/<entry>/
      <PascalEntry>View.java
      <PascalEntry>PresentationModel.java   # optional when the reusable view is fully passive
      <PascalEntry>IntentHandler.java       # optional when the reusable unit is non-interactive
resources/
  view/
    leftbartabs/<entry>/
    statetabs/<entry>/
    dropdowns/<entry>/
    slotcontent/<slot>/<entry>/
```

Rules:

- `src/view/leftbartabs/<entry>/` defines one left-bar tab
- `src/view/statetabs/<entry>/` defines one global state tab
- `src/view/dropdowns/<entry>/` defines one dropdown-capable UI unit; it owns
  a `*Contribution` only when bootstrap should discover it directly
- `src/view/slotcontent/<slot>/<entry>/` defines one reusable generic content
  unit; it is not the home for feature-specific one-off components
- `src/view/slotcontent/primitives/<entry>/` is the reusable generic home for
  components that are not tied to exactly one cockpit surface family
- every active root has exactly one `*Binder` and one aggregate
  `*PresentationModel`
- interactive active roots may own exactly one `*IntentHandler`
- reusable `slotcontent` units may own a `*PresentationModel` and/or
  `*IntentHandler` when they publish reusable state or input behavior; fully
  passive reusable views may omit them
- existing target `*ViewModel` files and canonical `src/view/primitives/**`
  ownership are migration debt
- existing component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
  `Model/`, `Controller/`, and `interactor/` buckets remain migration debt

## Fixed Shell Surfaces

The shell owns these cockpit surfaces:

- `COCKPIT_CONTROLS`: top-left controls for the active left-bar tab
- `COCKPIT_MAIN`: primary work content for the active left-bar tab
- `COCKPIT_DETAILS`: top-right shell-owned details/history pane
- `COCKPIT_STATE`: bottom-right state pane
- `TOP_BAR`: top-bar dropdown window surface

`COCKPIT_STATE` has explicit precedence. If the active left-bar tab contributes
state content, that content owns the pane. If the active left-bar tab does not
contribute state content, the shell shows registered global runtime state tabs
from `src/view/statetabs/<entry>/`. Encounter-style runtime state belongs
under `src/view/statetabs`, not under `src/view/leftbartabs`.

## Dependency Direction

The target source dependency direction is:

```text
Contribution      -> shell.api + same-root Binder
Binder            -> shell.api + same-root PresentationModel + optional same-root IntentHandler
                   + same-root feature Views + reusable slotcontent roles
                   + root domain ApplicationService types + domain published carriers
PresentationModel -> read-side domain published carriers + JavaFX beans/collections
                   + same-surface local value/support types
IntentHandler     -> co-located PresentationModel + same-surface local value/support types
View              -> JavaFX UI APIs + observable PresentationModel surface
                   + reusable slotcontent base views/support types
Model             -> no shell, view, JavaFX, or data implementation types
Shell             -> shell contracts and generic hosting only
```

Additional rules:

- the Binder may know only its same-root `PresentationModel`,
  `IntentHandler`, and feature-specific `View` types directly
- the Binder may additionally know reusable `slotcontent` roles in other
  packages when reuse is intentional
- `PresentationModel`, `IntentHandler`, and feature-specific `View` classes
  may extend reusable generic counterparts from `src/view/slotcontent/**`
- that extension seam does not relax shell, data, or domain dependency bans
- outside the explicitly documented Binder/domain and `published/**` readback
  seams, no direct domain/view-layer connections are allowed

## Canonical Interaction Model

The Binder is the only view-layer role that may know domain boundaries, but it
is a composition owner, not a long-lived feature orchestrator.

Construction and wiring:

1. the shell activates a registered contribution
2. the contribution delegates binding to its co-located Binder
3. the Binder obtains runtime services, instantiates same-root roles and any
   needed reusable `slotcontent` roles, wires listeners, bindings, and
   callbacks, and returns a `ShellBinding`
4. after that setup, the Binder does not become the semantic owner of routine
   feature workflow state

Input flow:

1. a passive View emits a technical user event
2. the Binder-installed listener forwards that event into the optional
   `IntentHandler`
3. the `IntentHandler` interprets the event and mutates only its co-located
   `PresentationModel`
4. when domain work is required, the `IntentHandler` invokes a Binder-wired
   callback seam
5. that seam reaches the root `*ApplicationService`

Readback flow:

1. the `*ApplicationService` produces read-side `published/**` facts or
   synchronous result records
2. Binder-owned wiring delivers those facts into listener-facing
   `PresentationModel` intake seams
3. the `PresentationModel` derives observable projection state
4. passive Views react through bindings or listeners; they do not imperatively
   query business meaning and do not receive presenter-style commands

This means:

- `PresentationModel` owns projection logic and local UI state, but not
  external boundary access
- `IntentHandler` owns input interpretation, but not domain lookup, view
  instantiation, or shell APIs
- passive Views react to observable `PresentationModel` state; they do not
  command the `PresentationModel` directly
- Binder-owned runtime callbacks and subscriptions are allowed; Binder-owned
  long-lived feature behavior is not the target model

## View Resource Rules

- FXML is optional implementation detail for a passive View, not the
  architectural unit of composition
- keep view resources under `resources/view/` when resources are needed
- do not use inline FXML scripts
- FXML controllers are passive View classes and follow the View rules
- FXML event methods may emit technical user events, but they must not own
  feature or business decisions

## Correctness Rule

Correct view code follows this target model even when nearby legacy code does
not. Existing `src/view/primitives/**`, lingering `*ViewModel` names, and
feature-specific one-offs under `slotcontent/**` are migration debt. They do
not justify a new placement decision.

## Detailed Role Contracts

Detailed role contracts, lifecycle rules, forbidden patterns, and
verification-note detail live in
[View Layer Role Contracts](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer-role-contracts.md:1).

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/system-layer-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-workbench.md:1)
- [Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1)
- [View Layer Role Contracts](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer-role-contracts.md:1)
- [ADR 027: PresentationModel And IntentHandler View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-027-presentationmodel-intenthandler-view-layer.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/references/view-patterns/fowler-presentation-model.md:1)
- [Fowler Passive View](/home/aaron/Schreibtisch/projects/references/view-patterns/fowler-passive-view.md:1)
