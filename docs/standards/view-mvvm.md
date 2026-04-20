Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: SaltMarcher cockpit MVVM target model, contribution,
ViewModel, passive-view, and domain-model role boundaries for `src/view/**`.

# Model-View-ViewModel Standard

## Goal

SaltMarcher uses a cockpit-specific Model-View-ViewModel model.

The MVVM Model role is the domain layer. The ViewModel role is a presentation
model that owns view state and user-intent handling. The View role is passive
JavaFX content. A small shell contribution adapter is allowed because
SaltMarcher's passive shell must discover UI entrypoints and attach them to
fixed cockpit slots without hard-coded feature registries.

The roles are:

- `Model`: `src/domain/**`, exposed through root `*ApplicationService`
  boundaries and domain `published/` carriers.
- `ViewModel`: presentation model named `*ViewModel`. Active-root ViewModels
  aggregate cross-slot presentation state and may call domain application
  services. Slotcontent ViewModels interpret active-root signals into
  slot-local projection state and do not call application services.
- `View`: passive JavaFX content named `*View`. Active-root Views are optional
  wrappers around slotcontent counterparts. Slotcontent Views are reusable or
  standalone content for exactly one cockpit slot.
- `Contribution`: discovered shell adapter named `*Contribution`. It owns
  registration metadata only and delegates runtime binding to the root binder.
- `Binder`: one active-root lifecycle and wiring owner named `*Binder`. It owns
  service lookup, ViewModel construction, slotcontent construction, emitter
  wiring, binding, and `ShellBinding` lifecycle hooks.
- `Shell`: the passive cockpit host, fixed surfaces, activation lifecycle,
  details/history hosting, state-pane precedence, and top-bar window hosting.

## Target Topology

Active view code is organized by user-addressable UI entrypoint or by reusable
single-slot content:

```text
src/view/
  leftbartabs/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>Binder.java
      <PascalEntry>ViewModel.java
      <PascalEntry><Surface>View.java  # optional root-local wrapper/specialization
  statetabs/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>Binder.java
      <PascalEntry>ViewModel.java
      <PascalEntry>StateView.java
  dropdowns/
    <entry>/
      <PascalEntry>Contribution.java  # optional; only for shell-discovered dropdowns
      <PascalEntry>Binder.java
      <PascalEntry>ViewModel.java
      <PascalEntry>TopBarView.java    # optional root-local dropdown view
  slotcontent/
    controls/<entry>/
      <PascalEntry>View.java
      <PascalEntry>ViewModel.java
      <PascalEntry>DisplayModel.java
    main/<entry>/
      <PascalEntry>View.java
      <PascalEntry>ViewModel.java
      <PascalEntry>DisplayModel.java
    state/<entry>/
      <PascalEntry>View.java
      <PascalEntry>ViewModel.java
      <PascalEntry>DisplayModel.java
    details/<entry>/
      <PascalEntry>View.java
      <PascalEntry>ViewModel.java
    topbar/<entry>/
      <PascalEntry>View.java
      <PascalEntry>ViewModel.java
resources/
  view/
    leftbartabs/<entry>/<PascalEntry><Surface>.fxml
    statetabs/<entry>/<PascalEntry>StateView.fxml
    dropdowns/<entry>/<PascalEntry>TopBarView.fxml
    slotcontent/<slot>/<entry>/<PascalEntry>View.fxml
```

Rules:

- `src/view/leftbartabs/<entry>/` defines one left-bar tab.
- `src/view/statetabs/<entry>/` defines one global state tab.
- `src/view/dropdowns/<entry>/` defines a dropdown-capable UI unit. It has a
  `*Contribution` only when bootstrap should discover it directly.
- `src/view/slotcontent/<slot>/<entry>/` defines one reusable or standalone
  content unit for exactly one cockpit slot.
- `*Contribution` is shell-discovery only. It must stay thin and delegate
  runtime composition to the co-located `*Binder`.
- Every active root has exactly one `*Binder` and one aggregate `*ViewModel`.
- Existing component-local `View/`, `ViewModel/`, `assembly/`, view `api/`,
  `Model/`, `Controller/`, and `interactor/` buckets are migration debt.

## Fixed Shell Surfaces

The shell owns these cockpit surfaces:

- `COCKPIT_CONTROLS`: top-left controls for the active left-bar tab.
- `COCKPIT_MAIN`: primary work content for the active left-bar tab.
- `COCKPIT_DETAILS`: top-right shell-owned details/history pane.
- `COCKPIT_STATE`: bottom-right state pane.
- `TOP_BAR`: top-bar dropdown window surface.

`COCKPIT_STATE` has explicit precedence. If the active left-bar tab contributes
state content, that content owns the pane. If the active left-bar tab does not
contribute state content, the shell shows registered global runtime
state tabs from `src/view/statetabs/<entry>/`. Encounter-style runtime
state belongs under `src/view/statetabs`, not under `src/view/leftbartabs`.

## Dependency Direction

The target source dependency direction is:

```text
Contribution        -> shell.api + Binder
Binder              -> shell.api + active ViewModel + Views + slotcontent + domain ApplicationService roots
Active ViewModel    -> JavaFX beans/collections + domain ApplicationServices/published
Slotcontent VM      -> JavaFX beans/collections + domain published carriers
View                -> JavaFX UI APIs + narrow callbacks/properties only
Model               -> no shell, view, JavaFX, or data implementation types
Shell               -> shell contracts and generic hosting only
```

Runtime control may flow through listeners, emitters, bindings, callbacks, and
activation hooks. Source dependencies still follow the direction above.

Cross-feature backend access goes only through the foreign feature's root
`*ApplicationService` and exported domain `published/` carrier types.

JDK dependencies in view-layer roles are allowed only when they are ordinary
language, value, collection, optional, functional, or formatting support for the
owning role. Direct file-system, network, SQL, process, reflection, classloader,
timer, executor, thread, persistence, or other infrastructure ownership is not a
general-purpose JDK dependency for Contributions, Binders, ViewModels, or Views.

## Contribution Role

A contribution is the shell-discovered adapter for one UI entrypoint.

Responsibilities:

- expose passive shell registration metadata through `ShellContributionSpec`
- implement `ShellContribution`
- create the co-located `*Binder` during `bind(ShellRuntimeContext)`
- return the binder-created `ShellBinding`
- keep bootstrap generic so adding a new contribution does not require shell or
  bootstrap directory edits

`src/view/leftbartabs/*`, `src/view/statetabs/*`, and shell-contributed
`src/view/dropdowns/*` roots are bootstrap-discovered. `dropdowns` roots may
omit `*Contribution` when they are invoked by another binder. Slotcontent roots
are never bootstrap-discovered.

Allowed dependencies:

- `shell.api.*` public contribution metadata, binding return, and runtime
  context types needed to delegate to the Binder
- the contribution's own `*Binder`
- ordinary JDK language, value, collection, optional, functional, and formatting
  types that do not own infrastructure access

Forbidden behavior:

- feature-specific bootstrap registries
- concrete `shell.host.*` imports
- direct `src.data.*` imports
- direct application-service lookup
- view instantiation or binding
- business invariants that belong in the domain
- presentation state that belongs in the ViewModel
- widget layout or rendering logic that belongs in a View

## Binder Role

A binder owns runtime assembly for one active root.

Responsibilities:

- look up required runtime capabilities from `ShellRuntimeContext`
- instantiate the active-root ViewModel, active-root Views, and slotcontent
  View/ViewModel pairs
- bind view properties, listeners, and emitters to ViewModels
- publish details through shell-owned inspector/history APIs
- return `ShellBinding` slot content and own activation/deactivation hooks

Allowed dependencies:

- shell public contracts allowed for contributions
- the same-root active ViewModel and passive Views
- slotcontent Views, ViewModels, and display models
- detail slotcontent Views and ViewModels when publishing inspector entries
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.published.*` carrier records, enums, and sealed carriers
- JavaFX `Node` and collection types needed for bound slot content

## ViewModel Role

An active-root ViewModel owns aggregate presentation state and user-intent
handling for one `leftbartabs`, `statetabs`, or `dropdowns` root. A
slotcontent ViewModel owns the presentation projection for one reusable
slotcontent unit.

Responsibilities:

- expose bindable presentation state through JavaFX properties or collections
- own selected state, enablement, labels, validation messages, loading state,
  failure state, retry state, and stale-result handling
- active-root ViewModels translate view emitters into model actions and
  application-service calls
- slotcontent ViewModels interpret active-root signals into slot-local
  display state and must not call application services
- map domain or active-root results into view-consumable state
- coordinate presentation state across the owning active root or slotcontent
  unit

Allowed dependencies:

- JavaFX beans and collections
- root `src.domain.<feature>.<Feature>ApplicationService` for active-root
  ViewModels only
- `src.domain.<feature>.published.*` carrier records, enums, and sealed carriers
- private nested presentation helper or carrier types declared inside the owning
  `*ViewModel` when they do not become a second ViewModel for the root
- ordinary JDK language, value, collection, optional, functional, and formatting
  types that do not own infrastructure access

Forbidden dependencies and behavior:

- `shell.*`
- `src.view.*View` classes
- `src.data.*`
- foreign private domain internals outside root application services and
  domain `published/` carriers
- additional top-level `*ViewModel` types in the same active root
- view instantiation, slot binding, or bootstrap discovery
- widget-specific layout and rendering decisions

## View Role

A View is passive JavaFX content for one shell surface, dropdown, detail entry,
or reusable fragment.

Responsibilities:

- build or load JavaFX controls for one panel, dropdown, or reusable fragment
- expose bind targets, observable properties, setters, or callbacks for
  ViewModel-owned state
- expose emitters for technical user gestures
- own widget-local state such as focus, hover, popover visibility, drag state,
  and temporary text still being edited inside one control subtree
- own UI-only helpers such as cell factories, skins, drawing code, menus,
  dialogs, and control adapters when local to the view
- provide reusable or standalone slot content under `src/view/slotcontent`
  when multiple active roots share one cockpit surface structure or when a
  feature publishes detail/dropdown content through a binder

Allowed dependencies:

- JavaFX UI APIs, including scene graph, controls, canvas, animation, stage,
  CSS, FXML, beans, and collections
- same-root passive Views or `src.view.slotcontent.*` passive Views when needed
- narrow listener, callback, or property types from the JDK or JavaFX

Forbidden dependencies and behavior:

- `shell.*`
- `src.domain.*`
- `src.data.*`
- feature-specific ApplicationServices
- cross-panel presentation policy
- business rules
- knowing whether a user gesture generates an encounter, mutates a dungeon, or
  performs any other domain action

## Model Role

The MVVM Model role is fulfilled by `src/domain/**`.

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

The domain-layer standard owns the detailed hexagonal domain-core structure.
This standard owns only the MVVM-facing rule that the view layer treats each
domain feature as a model behind one root application service.

## Lifecycle, Commands, And Async Work

- Long-lived listeners, subscriptions, callbacks, or observers must have
  explicit removal, disposal, weak-listener use, or a documented shell-lifetime
  rationale.
- Direct action methods on a ViewModel are acceptable. A separate command class
  is not required.
- Command availability, disabled reasons, result status, loading state, and
  user-visible failures belong in the ViewModel.
- Blocking I/O must not run on the JavaFX application thread.
- When asynchronous work is introduced, the ViewModel owns loading, failure,
  cancellation, retry, and stale-result semantics.

## Forbidden Patterns

- A `leftbartabs` or `statetabs` root defining zero or more than one shell
  contribution.
- A `dropdowns` root defining more than one shell contribution.
- An active root missing its mandatory `*Binder`.
- A ViewModel instantiating JavaFX views or using shell APIs.
- An active root defining more than one top-level aggregate `*ViewModel`.
- A View importing shell, domain, data, or ApplicationService types.
- An active-root View duplicating a reusable slotcontent surface instead of
  extending, wrapping, or composing the slotcontent View.
- Shell host code importing feature contributions, ViewModels, or Views.
- Domain code importing JavaFX, shell, view, or data implementation types.
- Reintroducing component-local `View/`, `ViewModel/`, `assembly/`,
  `Controller/`, `Model/`, `interactor/`, or non-shared view `api/` buckets as
  target architecture.
- Treating `COCKPIT_DETAILS` as ordinary feature-owned slot content instead of
  shell-owned details/history publication.
- Treating Encounter or other global runtime state as a left-bar tab.
- Treating the state pane as simultaneously owned by an active tab and
  registered state tabs.
- Reflective reach-through such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based bypasses under
  `src/view/**`.

## Verification Notes

Mechanical enforcement coverage for this standard lives in
[Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-view.md:1).
Rules that cannot be expressed as stable source, bytecode, graph, or file-tree
checks remain review-owned there instead of being represented as heuristic
blocking gates.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-view.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/fowler-presentation-model.md:1)
- [JavaFX Properties And Binding](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/oracle-javafx-properties-binding.md:1)
