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
- `ViewModel`: one presentation model next to its owning contribution or detail
  entry, named `*ViewModel`.
- `View`: one passive panel, dropdown, or detail view next to its owning
  contribution or detail entry, named for its fixed shell surface
  (`*ControlsView`, `*MainView`, `*StateView`, `*TopBarView`, or
  `*DetailsView`); reusable generic views may live directly under
  `src/view/views/` and end with `*View`.
- `Contribution`: one discovered shell adapter named `*Contribution`; it owns
  shell registration, service lookup, view instantiation, and binding.
- `Shell`: the passive cockpit host, fixed surfaces, activation lifecycle,
  details/history hosting, state-pane precedence, and top-bar window hosting.

## Target Topology

Active view code is organized by shell contribution kind, shell-owned detail
entry, or reusable view role:

```text
src/view/
  tabs/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>ViewModel.java
      <PascalEntry>ControlsView.java
      <PascalEntry>MainView.java
      <PascalEntry>StateView.java
  topbar/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>ViewModel.java
      <PascalEntry>TopBarView.java
  state/
    <entry>/
      <PascalEntry>Contribution.java
      <PascalEntry>ViewModel.java
      <PascalEntry>StateView.java
  details/
    <entry>/
      <PascalEntry>ViewModel.java
      <PascalEntry>DetailsView.java
  views/
    <PascalReusableView>.java
resources/
  view/
    tabs/<entry>/<PascalEntry><Surface>.fxml
    topbar/<entry>/<PascalEntry>TopBarView.fxml
    state/<entry>/<PascalEntry>StateView.fxml
    details/<entry>/<PascalEntry>DetailsView.fxml
    views/<PascalReusableView>.fxml
```

Rules:

- `src/view/tabs/<entry>/` defines one left-bar tab contribution.
- `src/view/topbar/<entry>/` defines one top-bar dropdown-window
  contribution.
- `src/view/state/<entry>/` defines one global runtime state-panel tab
  contribution.
- `src/view/details/<entry>/` defines detail-pane entry content published
  through the shell-owned details/history API. It is not a discovered shell
  contribution root.
- `src/view/views/` is only for reusable generic passive views shared by
  multiple contribution roots. Owned views stay next to their contribution and
  may extend reusable generic views when a shared surface such as a dungeon map
  canvas or dungeon control panel needs tab-specific specialization.
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
state-panel tabs from `src/view/state/<entry>/`. Encounter-style runtime state
belongs under `src/view/state`, not under `src/view/tabs`.

## Dependency Direction

The target source dependency direction is:

```text
Contribution -> shell.api + ViewModel + Views + domain ApplicationService roots
ViewModel    -> JavaFX beans/collections + domain ApplicationServices/published
View         -> JavaFX UI APIs + narrow callbacks/properties only
Model        -> no shell, view, JavaFX, or data implementation types
Shell        -> shell contracts and generic hosting only
```

Runtime control may flow through listeners, emitters, bindings, callbacks, and
activation hooks. Source dependencies still follow the direction above.

Cross-feature backend access goes only through the foreign feature's root
`*ApplicationService` and exported domain `published/` carrier types.

JDK dependencies in view-layer roles are allowed only when they are ordinary
language, value, collection, optional, functional, or formatting support for the
owning role. Direct file-system, network, SQL, process, reflection, classloader,
timer, executor, thread, persistence, or other infrastructure ownership is not a
general-purpose JDK dependency for Contributions, ViewModels, or Views.

## Contribution Role

A contribution is the shell adapter for one discovered UI entrypoint.

Responsibilities:

- expose passive shell registration metadata through `ShellContributionSpec`
- implement `ShellContribution`
- look up required runtime capabilities from `ShellRuntimeContext`
- instantiate the owning ViewModel and passive views
- bind view properties, listeners, and emitters to the ViewModel
- return `ShellBinding` slot content for the contribution kind
- keep bootstrap generic so adding a new contribution does not require shell or
  bootstrap directory edits

Only `src/view/tabs/*`, `src/view/topbar/*`, and `src/view/state/*`
contribution roots are bootstrap-discovered. Detail-pane entries do not own
top-level startup contributions; they are published through the shell-owned
details/history API.

Allowed dependencies:

- `shell.api.*` public contribution, binding, slot, context, and details
  contracts allowed by the shell API allowlist
- the contribution's own `*ViewModel`
- the contribution's own passive `*View` classes and reusable
  `src.view.views.*`
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.published.*` carrier records, enums, and sealed carriers
- JavaFX `Node` and collection types needed to return bound slot content
- ordinary JDK language, value, collection, optional, functional, and formatting
  types that do not own infrastructure access

Forbidden behavior:

- feature-specific bootstrap registries
- concrete `shell.host.*` imports
- direct `src.data.*` imports
- business invariants that belong in the domain
- presentation state that belongs in the ViewModel
- widget layout or rendering logic that belongs in a View

## ViewModel Role

A ViewModel owns presentation state and user-intent handling for one
contribution or detail entry.

Responsibilities:

- expose bindable presentation state through JavaFX properties or collections
- own selected state, enablement, labels, validation messages, loading state,
  failure state, retry state, and stale-result handling
- translate view emitters into model actions and application-service calls
- map domain results into view-consumable state
- coordinate presentation state across the contribution's own views

Allowed dependencies:

- JavaFX beans and collections
- root `src.domain.<feature>.<Feature>ApplicationService`
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
- additional top-level `*ViewModel` types in the same contribution or detail root
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
- provide reusable generic base views under `src/view/views/` when multiple
  contribution-owned views share one cockpit surface structure

Allowed dependencies:

- JavaFX UI APIs, including scene graph, controls, canvas, animation, stage,
  CSS, FXML, beans, and collections
- reusable `src.view.views.*` views when needed
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

- own business language, rules, invariants, policies, domain-owned contracts,
  and application services
- expose exactly one callable client boundary per feature:
  `<Feature>ApplicationService`
- expose only carrier records, enums, and sealed carrier abstractions under
  `src/domain/<feature>/published/**`

Forbidden dependencies:

- `src.view.*`
- `shell.*`
- `javafx.*`
- `src.data.*` implementation types

The domain-layer standard owns the detailed DDD structure. This standard owns
only the MVVM-facing rule that the view layer treats each domain feature as a
model behind one root application service.

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

- A contribution root defining more than one shell contribution.
- A ViewModel instantiating JavaFX views or using shell APIs.
- A contribution or detail root defining more than one top-level `*ViewModel`.
- A View importing shell, domain, data, or ApplicationService types.
- A contribution-owned tab View duplicating a reusable generic surface instead
  of extending the generic View under `src/view/views`.
- Shell host code importing feature contributions, ViewModels, or Views.
- Domain code importing JavaFX, shell, view, or data implementation types.
- Reintroducing component-local `View/`, `ViewModel/`, `assembly/`,
  `Controller/`, `Model/`, `interactor/`, or non-shared view `api/` buckets as
  target architecture.
- Treating `COCKPIT_DETAILS` as ordinary feature-owned slot content instead of
  shell-owned details/history publication.
- Treating Encounter or other global runtime state as a left-bar tab.
- Treating the state pane as simultaneously owned by an active tab and
  registered runtime state tabs.
- Reflective reach-through such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based bypasses under
  `src/view/**`.

## Verification Notes

Current checks enforce the target mechanical parts that have a stable static
shape:

- Java view code lives under `src/view/tabs`, `src/view/topbar`,
  `src/view/state`, `src/view/details`, or reusable `src/view/views`.
- Contribution roots define one `*Contribution`, one `*ViewModel`, and the
  passive `*View` files needed by that contribution.
- Detail entries define `*ViewModel` and `*View` content only; they do not
  define bootstrap-discovered `*Contribution` roots.
- Reusable `src/view/views` Java files are passive `*View` files and may be
  base Views for contribution-owned concrete Views.
- Contributions may use the allowed shell API subset, co-located ViewModels,
  co-located Views, reusable generic passive Views, detail-entry ViewModels and
  Views when publishing shell Inspector entries, JavaFX `Node`, and domain
  application-service boundaries; each contribution root must construct the
  shell spec matching its area (`tabs` -> `ShellTabSpec`, `topbar` ->
  `ShellTopBarSpec`, `state` -> `ShellRuntimeStateSpec`), and must not use
  direct JDK infrastructure APIs.
- ViewModels may use JavaFX beans/collections and domain application-service
  boundaries, but not shell, views, data, concrete shell host types, or
  foreign view-root ViewModels, and must not use direct JDK infrastructure APIs.
- Views may use JavaFX UI APIs but not shell, domain, data, or
  ApplicationService types; contribution-owned Views may reference only
  co-located passive Views or reusable generic passive/base Views, and must not
  use direct JDK infrastructure APIs. Direct rendering is a View
  implementation technique; reusable visual values used by direct renderers
  still come from the centralized styling standard.
- Optional FXML resources live directly under
  `resources/view/{tabs,topbar,state,details}/<entry>/` or
  `resources/view/views`, use passive View controllers matching the same
  area-specific suffixes, and do not use inline scripts.
- State-pane precedence is modeled explicitly.
- Legacy component-local buckets are absent from migrated target code.

Semantic placement quality that cannot be expressed as stable source, bytecode,
graph, or file-tree rules remains review-owned.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/fowler-presentation-model.md:1)
- [JavaFX Properties And Binding](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/oracle-javafx-properties-binding.md:1)
