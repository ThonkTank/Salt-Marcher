Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: SaltMarcher cockpit MVVM target model, tab-model and
panel-view role boundaries, and view-layer dependency rules for `src/view/**`.

# Model-View-ViewModel Standard

## Goal

SaltMarcher uses a cockpit-specific `Model-View-ViewModel (MVVM)` model.

The shell owns the stable cockpit frame. `src/view/models/` owns tab-level view
models that register with that shell frame, bind passive panel views, and call
domain application services. `src/view/views/` owns passive JavaFX panel
content. The MVVM `Model` role remains the existing domain layer behind root
`*ApplicationService` boundaries.

The target roles are:

- `Shell`: the passive cockpit host, fixed surfaces, registration contracts,
  activation lifecycle, details/history hosting, state-pane arbitration, and
  top-bar window hosting.
- `ViewModel`: one tab or top-bar window model per file under
  `src/view/models/`.
- `View`: one passive panel-content fragment per file under
  `src/view/views/`.
- `Model`: `src/domain/**`, exposed through root application services and
  domain `api/` carriers.

The architectural goals are:

- `Cockpit Fit`: SaltMarcher view code is organized around the fixed cockpit
  surfaces the user actually sees, not around generic screen containers.
- `Passive Views`: panel views expose bindable listeners and user-event
  emitters; they do not know feature meaning or domain behavior.
- `Tab-Owned Wiring`: tab models own shell registration, view instantiation,
  view binding, ApplicationService lookup, and presentation policy.
- `Mechanical Clarity`: package placement and allowed API surfaces are narrow
  enough for architecture checks to enforce after the source migration.

## Target Topology

The target active view layout is:

```text
src/view/
  models/
    <PascalTabName>TabModel.java
    <PascalWindowName>WindowModel.java
    ...
  views/
    <PascalPanelName>ControlPanel.java
    <PascalPanelName>MainPanel.java
    <PascalPanelName>StatePanel.java
    <PascalPanelName>DetailsContent.java
    <PascalWindowName>DropdownWindow.java
    ...
resources/
  view/
    <optional-view-resource>.fxml
```

Rules:

- A `view/models` file defines exactly one shell-registered tab model, state
  tab model, or top-bar dropdown window model.
- A `view/views` file defines exactly one panel-content fragment for exactly
  one shell surface.
- Panel views are named for their surface role when practical: control panel,
  main panel, state panel, details content, or dropdown window.
- Existing component folders, `*ViewContribution` roots, `View/`,
  `ViewModel/`, non-shared view `api/`, `assembly/`, `Model/`, `Controller/`,
  and `interactor/` buckets are migration debt, not target topology.
- FXML may be used as a view implementation detail, but FXML is not the
  architectural owner of screen composition. The panel view file remains the
  unit that owns one passive panel fragment.

## Fixed Shell Surfaces

The shell owns these cockpit surfaces:

- `COCKPIT_CONTROLS`: the top-left control panel. It is empty until the active
  tab model binds a control-panel view.
- `COCKPIT_MAIN`: the primary work panel. It is empty until the active tab
  model binds a main-panel view such as a dungeon render canvas.
- `COCKPIT_DETAILS`: the top-right details pane with shell-owned history.
  Feature content reaches it only through the public details/history contract.
- `COCKPIT_STATE`: the bottom-right state pane. The active left-bar tab model
  may claim it; otherwise the shell shows registered state-pane tabs.
- `TOP_BAR`: shell-owned top-bar dropdown window surface.

The shell defines the public contracts by which tab models, state tabs, and
top-bar dropdown windows attach to those surfaces. The shell must not import
feature packages or own feature behavior.

## Dependency Direction

The target source dependency direction is:

```text
view/models -> shell public contracts + view/views + domain ApplicationServices
view/views  -> JavaFX UI APIs + listener/emitter contracts only
domain      -> no shell, view, JavaFX, or data implementation types
shell       -> shell contracts and generic hosting only
```

Runtime control may flow through listeners, emitters, bindings, callbacks, and
activation hooks. Source dependencies still follow the direction above.

Cross-feature backend access goes only through the foreign feature's root
`*ApplicationService` and exported domain `api/` carrier types.

Cross-panel reuse is ordinary private view implementation reuse inside
`view/views` unless the repository later defines a specific public view
contract. Do not recreate broad component-local view `api/` buckets as a target
escape hatch.

## Runtime Interaction

The normal interaction loop is:

1. The shell discovers and registers a tab model, state tab model, or top-bar
   dropdown window model.
2. On realization, the model obtains required shell contracts and domain
   application services.
3. The model instantiates the passive panel views it needs.
4. The model binds view listeners to its presentation state.
5. The model binds view emitters to model actions and relevant domain
   application-service calls.
6. A passive view emits a technical user event.
7. The model translates that event into presentation-state updates or domain
   calls.
8. Domain results return as application-service results and `api` carriers.
9. The model maps those results into presentation state.
10. Bound panel views render the new state.

Any decision that would still matter if the same panel were rendered with a
different widget toolkit belongs in the model or domain layer, not in a view.

## Role Definitions

### Shell

The shell owns fixed cockpit composition.

Responsibilities:

- define fixed cockpit surfaces and public registration contracts
- host empty cockpit panels when no active model supplies content
- activate left-bar tabs, state-pane tabs, and top-bar dropdown windows
- arbitrate `COCKPIT_STATE` between active-tab content and registered state
  tabs
- host details/history content through shell-owned APIs
- own layout persistence, resizing, navigation, and lifecycle calls

Forbidden behavior:

- feature or business logic
- feature-specific imports or manual feature registries
- direct domain service calls for feature behavior
- interpretation of a panel view's business meaning

### `view/models`

`view/models` owns SaltMarcher's ViewModel role.

Each file defines one tab model, one state-tab model, or one top-bar dropdown
window model.

Responsibilities:

- expose shell registration metadata through shell public contracts
- instantiate and bind the passive `view/views` fragments used by that model
- attach panel views to shell surfaces through public shell contracts
- own presentation state, selected state, enablement, visibility, labels,
  validation messages, loading state, failure state, retry state, and
  stale-result handling
- translate view emitters into model actions and ApplicationService calls
- map domain results into view-consumable state
- own cross-panel coordination for one tab or window
- publish details/history content only through shell-owned contracts

Allowed dependencies:

- `shell.api.*` public model registration and surface-binding contracts
- own `src.view.models.*`
- own `src.view.views.*`
- `javafx.beans.*` and `javafx.collections.*` for bindable state
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.api.*` carrier records, enums, and sealed carriers
- general-purpose JDK types

Forbidden dependencies and behavior:

- `src.data.*`
- concrete `shell.host.*`
- foreign private domain internals outside root application services and
  domain `api` carriers
- embedding business invariants that belong in the domain
- letting a passive view decide cross-panel presentation policy

### `view/views`

`view/views` owns SaltMarcher's View role.

Each file defines exactly one passive panel-content fragment for one shell
surface.

Responsibilities:

- build or load JavaFX controls for one panel fragment
- expose listeners, bind targets, or setter methods for model-owned state
- expose emitters, callbacks, or observable events for user gestures
- own widget-local state such as focus, hover, popover visibility, drag state,
  and temporary text still being edited inside one control subtree
- own UI-only helpers such as cell factories, skins, drawing code, menus,
  dialogs, and control adapters when they are local to the panel

Allowed dependencies:

- JavaFX UI APIs, including scene graph, controls, canvas, animation, stage,
  CSS, FXML, beans, and collections
- own `src.view.views.*`
- narrow listener/emitter contracts from `src.view.models.*` only when needed
  for binding
- general-purpose JDK types

Forbidden dependencies and behavior:

- `shell.*`
- `src.domain.*`
- `src.data.*`
- feature-specific ApplicationServices
- cross-panel presentation policy
- business rules
- knowing whether a user gesture generates an encounter, mutates a dungeon, or
  performs any other domain action

### Model

The MVVM `Model` role is fulfilled by `src/domain/**`.

Responsibilities:

- own business language, rules, invariants, policies, domain-owned contracts,
  and application services
- expose exactly one callable client boundary per feature:
  `<Feature>ApplicationService`
- expose only carrier records, enums, and sealed carrier abstractions under
  `src/domain/<feature>/api/**`

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
- Direct action methods on a tab model are acceptable. A separate command class
  is not required.
- Command availability, disabled reasons, result status, loading state, and
  user-visible failures belong in `view/models`.
- Blocking I/O must not run on the JavaFX application thread.
- When asynchronous work is introduced, the model owns loading, failure,
  cancellation, retry, and stale-result semantics.

## Forbidden Patterns

- A `view/views` file defining more than one panel fragment.
- A `view/models` file defining more than one tab/window model.
- Panel views importing shell, domain, data, or ApplicationService types.
- Shell host code importing feature models or views.
- Domain code importing JavaFX, shell, view, or data implementation types.
- Reintroducing component-local `View/`, `ViewModel/`, `assembly/`,
  `Controller/`, `Model/`, `interactor/`, or non-shared view `api/` buckets as
  target architecture.
- Treating `COCKPIT_DETAILS` as ordinary slot content instead of shell-owned
  details/history publication.
- Treating the state pane as simultaneously owned by an active tab and
  registered state tabs.
- Reflective reach-through such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based bypasses under
  `src/view/**`.

## Migration Debt

Current active code and mechanical checks may still reflect the previous
component-local topology with `*ViewContribution`, `View/`, `ViewModel/`, FXML
root loading, and declared shared component `api/` packages. Those structures
describe current state only.

The target model is the cockpit-specific MVVM shape above. Standards work may
lead source and checker migration. Implementation work that touches legacy view
surfaces must move them toward `view/models` plus passive `view/views` unless a
specific compatibility plan says otherwise.

## Verification Notes

Current checks still enforce portions of the previous declarative MVVM model.
The enforcement coverage standard records that current-state mapping.

Target mechanical checks should eventually cover:

- Java view code lives under `src/view/models` or `src/view/views`.
- `view/models` files define one shell-registered tab, state tab, or top-bar
  dropdown window model.
- `view/views` files define one passive panel fragment for one shell surface.
- `view/views` may use JavaFX UI APIs but not shell, domain, data, or
  ApplicationService types.
- `view/models` may use shell public contracts, passive views, JavaFX
  beans/collections, and domain application-service boundaries, but not data or
  concrete shell host types.
- Details/history publication goes through shell-owned contracts.
- State-pane precedence is modelled explicitly.
- Legacy component-local buckets are absent from migrated target code.

New mechanical gates require explicit user request before being added to the
local build/check pipeline.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [ADR 019: Shell Cockpit Tab Model View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/fowler-presentation-model.md:1)
- [JavaFX Properties And Binding](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/oracle-javafx-properties-binding.md:1)
