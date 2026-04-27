Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: Detailed role contracts, lifecycle rules, inheritance seams,
and forbidden patterns for the SaltMarcher cockpit view layer.

# View Layer Role Contracts

## Purpose

This subordinate standard defines the detailed role contracts for
Contributions, Binders, PresentationModels, IntentHandlers, Views, and the
Model role behind the SaltMarcher cockpit view-layer topology.

The umbrella
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
remains the source of truth for the overall goal, topology, fixed shell
surfaces, and dependency direction.

## Contribution Role

A contribution is the shell-discovered adapter for one UI entrypoint.

Responsibilities:

- expose passive shell registration metadata through `ShellContributionSpec`
- implement `ShellContribution`
- create the co-located `*Binder` during `bind(ShellRuntimeContext)`
- return the Binder-created `ShellBinding`
- keep bootstrap generic so adding a new contribution does not require shell or
  bootstrap directory edits

`src/view/leftbartabs/*`, `src/view/statetabs/*`, and shell-contributed
`src/view/dropdowns/*` roots are bootstrap-discovered. `dropdowns` roots may
omit `*Contribution` when another root opens them. `slotcontent` roots are
never bootstrap-discovered.

Allowed dependencies:

- `shell.api.*` types needed for registration and delegation
- the contribution's own `*Binder`
- ordinary JDK language, value, collection, optional, functional, and
  formatting types that do not own infrastructure access

Forbidden behavior:

- feature-specific bootstrap registries
- concrete `shell.host.*` imports
- direct `src.data.*` imports
- direct application-service lookup
- role instantiation outside the owning Binder
- business invariants that belong in the domain
- projection state that belongs in the `PresentationModel`
- widget layout or rendering logic that belongs in a View

## Binder Role

A Binder owns one-time runtime assembly for one active root.

Responsibilities:

- look up required runtime capabilities from `ShellRuntimeContext`
- instantiate the same-root `PresentationModel`, optional `IntentHandler`,
  feature-specific Views, and needed reusable `slotcontent` roles
- bind passive View state listeners and bind targets to observable
  `PresentationModel` state
- forward View emitters into the optional `IntentHandler`
- install callback seams that the `IntentHandler` may invoke when domain work
  is required
- install readback delivery from root `*ApplicationService` results and
  `published/**` carriers into listener-facing `PresentationModel` intake seams
- publish details through shell-owned inspector/history APIs
- return `ShellBinding` slot content and own activation/deactivation hooks

Allowed dependencies:

- shell public contracts allowed for contributions
- the same-root `PresentationModel`, optional `IntentHandler`, and
  feature-specific Views
- reusable `slotcontent` Views, `PresentationModels`, optional
  `IntentHandlers`, and detail `InspectorEntry` adapters when reuse is
  intentional
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.published.*` carrier records, enums, and sealed
  carriers
- JavaFX `Node` and collection types needed for bound slot content

Forbidden dependencies and behavior:

- direct `src.data.*` imports
- feature-specific shell host imports
- long-lived domain knowledge outside composition and callback wiring
- observing `PresentationModel` request fields as the normal way to trigger
  domain work
- pushing projection logic down into Views
- pushing domain-boundary knowledge into `PresentationModel` or
  `IntentHandler`
- using foreign feature-specific active-root roles outside the intended reuse
  seam

## PresentationModel Role

An active-root `PresentationModel` owns aggregate observable projection state
for one `leftbartabs`, `statetabs`, or `dropdowns` root. A reusable
`slotcontent` `PresentationModel` owns reusable projection state for one
generic `slotcontent` unit.

Responsibilities:

- expose observable projection state through JavaFX properties or collections
- own selected state, enablement, labels, validation messages, loading state,
  failure state, retry state, stale-result handling, and other user-visible
  projection state
- expose listener-facing intake seams for read-side `published/**` carriers
- derive presentation state from published domain facts, local UI state, and
  same-surface support values
- keep presentation decisions out of Views and out of the domain model

Allowed dependencies:

- read-side `src.domain.<feature>.published.*` carrier records, enums, and
  sealed carriers
- JavaFX beans and collections
- same-surface local support/value types
- reusable generic `slotcontent` `PresentationModel` bases when the role is an
  intentional extension of a reusable generic component
- ordinary JDK language, value, collection, optional, functional, and
  formatting types that do not own infrastructure access

Forbidden dependencies and behavior:

- `shell.*`
- `src.view.*View` classes
- sibling or foreign `*Binder` classes
- `src.data.*`
- root `*ApplicationService` types
- published write/query carriers such as `*Command`, `*Query`, `*Operation`,
  or `*Edit`
- foreign private domain internals
- local domain-call callbacks
- view instantiation, slot binding, bootstrap discovery, or service lookup
- widget-specific layout and rendering decisions

## IntentHandler Role

An `IntentHandler` is the optional input-side role for one active root or one
reusable `slotcontent` unit.

Responsibilities:

- interpret technical user gestures into component-local state changes on the
  co-located `PresentationModel`
- invoke Binder-installed callback seams when domain work is required
- normalize, validate, and classify raw user input before any outward
  application action is attempted
- keep user-input interpretation out of Views and out of the Binder where the
  logic is component-specific

Allowed dependencies:

- the co-located `*PresentationModel`
- same-surface local helper or carrier types that do not cross the view-layer
  boundary
- reusable generic `slotcontent` `IntentHandler` bases when the role is an
  intentional extension of a reusable generic component
- ordinary JDK language, value, collection, optional, and functional types

Forbidden dependencies and behavior:

- `shell.*`
- `src.view.*View` classes
- `src.data.*`
- root `*ApplicationService` types
- direct domain `published/**` carriers
- foreign private domain internals
- view instantiation, shell lookup, bootstrap discovery, or service lookup

## View Role

A View is passive JavaFX content for one shell surface, dropdown, detail
entry, or reusable fragment.

Responsibilities:

- build or load JavaFX controls for one panel, dropdown, or reusable fragment
- expose bind targets, observable properties, setters, or listeners that react
  to `PresentationModel`-owned state
- expose emitters for technical user gestures
- own widget-local state such as focus, hover, popover visibility, drag state,
  and temporary text still being edited inside one control subtree
- own UI-only helpers such as cell factories, skins, drawing code, menus,
  dialogs, and control adapters when local to the view
- provide reusable generic content under `src/view/slotcontent/**` when
  multiple active roots share the same structure or behavior
- keep reusable Inspector entry construction in slotcontent-owned
  `*InspectorEntry` adapters instead of duplicating detail-entry assembly in
  active-root Binders

Allowed dependencies:

- JavaFX UI APIs, including scene graph, controls, canvas, animation, stage,
  CSS, FXML, beans, and collections
- the observable `PresentationModel` surface for the same active root or
  reusable `slotcontent` unit
- reusable generic `slotcontent` View bases when the role is an intentional
  extension of a reusable generic component
- narrow listener, callback, or property types from the JDK or JavaFX

Forbidden dependencies and behavior:

- `shell.*`
- `src.domain.*`
- `src.data.*`
- feature-specific `*ApplicationService` types
- sibling `*IntentHandler` types
- direct imperative commands into a `PresentationModel`
- cross-panel presentation policy
- business rules
- knowing whether a user gesture generates an encounter, mutates a dungeon, or
  performs any other domain action

## Model Role

The view-layer `Model` role is fulfilled by `src/domain/**`.

Responsibilities:

- own business language, rules, invariants, policies, domain-owned outbound
  ports, and application services
- expose exactly one callable client boundary per feature:
  `<Feature>ApplicationService`
- expose only carrier records, enums, and sealed carrier abstractions under
  `src/domain/<feature>/published/**`

Forbidden dependencies:

- `src.view.*`
- `shell.*`
- `javafx.*`
- `src.data.*` implementation types

## Lifecycle And Async Work

- Long-lived listeners, subscriptions, callbacks, or observers must have
  explicit removal, disposal, weak-listener use, or a documented shell-lifetime
  rationale.
- Blocking I/O must not run on the JavaFX application thread.
- When asynchronous work is introduced, Binder-owned setup may install the
  necessary callbacks and subscriptions, while the `PresentationModel` owns the
  resulting loading, failure, cancellation, retry, and stale-result projection.

## Forbidden Patterns

- a `leftbartabs` or `statetabs` root defining zero or more than one shell
  contribution
- a `dropdowns` root defining more than one shell contribution
- an active root missing its mandatory `*Binder` or `*PresentationModel`
- a `PresentationModel` or `IntentHandler` importing shell APIs
- an `IntentHandler` importing anything other than its co-located
  `PresentationModel`, same-surface local support, or ordinary JDK support
- a `PresentationModel` instantiating JavaFX views
- a `View` importing shell, domain, data, or `*ApplicationService` types
- a Binder import of domain types other than root `*ApplicationService` types
  and explicit `published/**` carriers
- an active-root View duplicating a reusable generic `slotcontent` surface
  instead of extending, wrapping, or composing it
- shell host code importing feature contributions, role files, or Views
- domain code importing JavaFX, shell, view, or data implementation types
- reintroducing component-local `View/`, `ViewModel/`, `assembly/`,
  `Controller/`, `Model/`, `interactor/`, or non-shared view `api/` buckets as
  target architecture
- treating feature-specific one-off components as canonical `slotcontent`
  instead of colocating them in the owning active root
- treating `COCKPIT_DETAILS` as ordinary feature-owned slot content instead of
  shell-owned details/history publication
- reflective reach-through such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based bypasses under
  `src/view/**`

## Verification Notes

Mechanical enforcement coverage for this standard lives in
[Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1).
Rules that cannot yet be expressed as stable source, bytecode, graph, or
file-tree checks remain `Candidate` or `Review-Owned` there instead of being
represented as heuristic blocking gates.

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1)
