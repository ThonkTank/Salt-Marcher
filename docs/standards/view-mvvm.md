Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Declarative MVVM target model, view-role boundaries, and
view-layer dependency rules for `src/view/**`.

# Model-View-ViewModel Standard

## Goal

SaltMarcher uses `Model-View-ViewModel (MVVM)` with declarative JavaFX views.
The target model keeps markup, presentation state, and business logic in three
separate roles:

- `View`: FXML markup plus minimal JavaFX code-behind for UI-only concerns.
- `ViewModel`: bindable presentation state and user-triggered actions.
- `Model`: the existing domain layer exposed through one root application
  service per domain feature.

The architectural goals are:

- `Declarative UI`: screen structure is authored in FXML so UI composition is
  visible as markup instead of hidden in procedural Java node construction.
- `Decoupling`: the view binds to a view model; the view model calls the
  domain model; the domain model knows nothing about either.
- `Mechanical Clarity`: allowed and forbidden Java/JavaFX APIs express the
  role boundary well enough for architecture checks to enforce the target over
  time.

## Pattern Alignment

- The canonical pattern name is `Model-View-ViewModel (MVVM)`.
- Fowler `Presentation Model` is the conceptual ancestor: presentation state
  and behavior are pulled out of widgets into a GUI-independent model.
- WPF/Silverlight-style MVVM is the target shape: declarative markup owns the
  view tree, bindings connect view controls to the view model, and code-behind
  stays thin.
- JavaFX implements the same target through FXML, `FXMLLoader`, controller
  code-behind, JavaFX properties, and property binding.
- Clean Architecture governs dependency direction: source dependencies point
  from outer presentation code toward the domain model, never back outward.

## Target Topology

The target view-component layout is:

```text
src/view/
  <component>/
    <PascalComponentName>ViewContribution.java
    View/
      <PascalComponentName>Controller.java
      ...
    ViewModel/
      <PascalComponentName>ViewModel.java
      ...
resources/
  view/
    <component>/
      <component>.fxml
      ...
```

Rules:

- The component root contains exactly one `*ViewContribution.java`.
- `View/` contains FXML controllers, view factories needed to load FXML, and
  UI-only helper classes.
- `ViewModel/` contains presentation state, presentation actions, and
  presentation-only value types.
- FXML files live under `resources/view/<component>/`.
- New or substantially refactored view code targets this topology.
- Existing `assembly/`, view `api/`, `Model/`, `Controller/`, and
  `interactor/` buckets are migration debt, not precedent for new work.

## Dependency Direction

The source dependency direction is:

```text
*ViewContribution -> View + ViewModel + shell public API + domain root service
View              -> ViewModel
ViewModel         -> domain root service + domain api carriers
domain            -> no view, shell, JavaFX, or data implementation types
```

Runtime control may move through callbacks, bindings, listeners, and shell
activation hooks. Source dependencies still follow the direction above.

Cross-feature backend access below the view layer goes through the foreign
feature's root `*ApplicationService` and its `api/` carrier types. No view code
may import foreign domain modules or data adapters.

## Runtime Interaction

The normal interaction loop is:

1. FXML defines the controls, layout, static visual structure, and bindings.
2. A `View/` controller receives a JavaFX event or binding callback.
3. The controller translates the technical event into a named view-model
   action.
4. The `ViewModel` updates presentation state and calls a domain application
   service when business behavior is needed.
5. Domain results return as carrier objects.
6. The `ViewModel` maps those results into bindable presentation properties.
7. The FXML/controller-visible UI updates through JavaFX binding or a small
   explicit refresh from the view model.

The view may contain glue that is unavoidably tied to JavaFX controls. Any
decision that would still matter if the same screen were rendered differently
belongs in the view model or domain model.

## Role Definitions

### Root Entrypoint

`<Component>ViewContribution.java` is the shell-facing adapter for one
component.

Responsibilities:

- expose shell registration metadata through `registrationSpec()`
- create or obtain the component `ViewModel`
- load the FXML-backed `View`
- adapt the prepared view root into the fixed shell slots returned by
  `ShellScreen`
- obtain shell-owned runtime services only as needed for composition

Allowed dependencies:

- `shell.api.*` public contribution and runtime-context types
- own `View/` and `ViewModel/`
- `javafx.fxml.FXMLLoader` and `javafx.scene.Node` as composition boundary
  types
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.api.*` carrier types only when needed at the boundary
- general-purpose JDK types

Forbidden behavior:

- business rules
- UI layout construction beyond loading FXML and assigning slot roots
- persistence or data-adapter access
- long-lived mutable feature state unrelated to shell lifecycle

### `View/`

`View/` owns JavaFX-facing view code.

Responsibilities:

- define FXML controllers and UI-only helper classes
- bind controls to view-model properties and observable collections
- extract gestures and call view-model actions
- own local widget state such as focus, selection models, popover visibility,
  drag state, and temporary text still being edited in one control subtree
- own JavaFX dialogs, popups, menus, cell factories, skins, and control
  adapters

Allowed dependencies:

- `javafx.fxml.*`
- `javafx.scene.*`, `javafx.stage.*`, `javafx.animation.*`, `javafx.util.*`,
  `javafx.css.*`, and other JavaFX UI APIs
- `javafx.beans.*` and `javafx.collections.*`
- own `View/` and `ViewModel/`
- general-purpose JDK types

Forbidden dependencies:

- `shell.*`
- `src.domain.*`
- `src.data.*`
- foreign private view component packages

Forbidden behavior:

- calling domain or data services
- owning business rules
- owning presentation decisions shared by multiple controls
- mapping domain results into user-facing presentation state except for
  trivial formatting that is local to one control

### `ViewModel/`

`ViewModel/` owns view-independent presentation state and actions.

Responsibilities:

- expose bindable properties, observable lists, and presentation snapshots
- expose user-triggered actions such as load, save, generate, select, clear,
  reroll, or delete
- own presentation policy: enablement, visibility, selected item, validation
  messages, status text, loading state, failure state, retry state, and stale
  result handling
- translate domain results into presentation state
- call same-feature or foreign root domain application services
- own synchronization state that must survive UI refresh or is shared across
  multiple controls

Allowed dependencies:

- own `ViewModel/`
- `javafx.beans.*` and `javafx.collections.*` for bindable presentation state
- root `src.domain.<feature>.<Feature>ApplicationService`
- `src.domain.<feature>.api.*` carrier records, enums, and sealed carrier
  abstractions
- general-purpose JDK types

Forbidden dependencies:

- `javafx.scene.*`
- `javafx.stage.*`
- `javafx.fxml.*`
- `shell.*`
- `src.data.*`
- own `View/`
- foreign private view component packages
- foreign domain internals outside root application services and `api/`
  carriers

### Model

The MVVM `Model` role is fulfilled by `src/domain/**`.

Responsibilities:

- own business language, business rules, invariants, policies, domain-owned
  contracts, and application services
- expose exactly one callable client boundary per feature:
  `<Feature>ApplicationService`
- expose only carrier records, enums, and sealed carrier abstractions under
  `src/domain/<feature>/api/**`

Forbidden dependencies:

- `src.view.*`
- `shell.*`
- `javafx.*`
- `src.data.*` implementation types

The domain layer standard owns the detailed DDD structure. This standard owns
only the MVVM-facing rule that the view layer treats each domain feature as a
model behind one root application service.

## FXML Rules

- New view roots and substantial view rewrites should use FXML.
- FXML may declare controls, layout, static properties, includes, style
  classes, and bindings.
- FXML must not contain inline scripts.
- FXML controllers may use `@FXML` fields and methods only for UI wiring.
- Controller methods referenced from FXML must delegate non-UI decisions to the
  view model.
- `FXMLLoader` setup belongs at the root contribution or in a small own
  `View/` factory, not in the view model.
- Existing programmatic JavaFX views are migration debt until converted; they
  may be touched only when the change moves them toward the target model.

## Lifecycle, Commands, And Async Work

- Long-lived listeners, subscriptions, callbacks, or observers must have
  explicit removal, disposal, weak-listener use, or a documented shell-lifetime
  rationale.
- Direct action methods on a view model are acceptable. A separate command
  class is not required.
- Command availability, disabled reasons, result status, loading state, and
  user-visible failures must be exposed by the view model instead of inferred
  by controls.
- Blocking I/O must not run on the JavaFX application thread.
- When asynchronous work is introduced, the view model owns loading, failure,
  cancellation, retry, and stale-result semantics.

## Forbidden Patterns

- `ViewModel/` returning `Node`, `Control`, `Scene`, `Stage`, `Parent`, or any
  other scene-graph/window type
- `ViewModel/` importing `javafx.fxml.*` or loading FXML
- `ViewModel/` building dialogs, popups, menus, cells, or layout nodes
- `View/` calling domain or data services directly
- `View/` owning presentation decisions that multiple controls depend on
- `View/` or `ViewModel/` importing shell API
- `src/domain/**` importing JavaFX, shell, view, or data implementation types
- new `assembly/`, `api/`, `Model/`, `Controller/`, or `interactor/` buckets
  under `src/view/<component>/`
- reflective reach-through such as `Class.forName(...)`,
  `ClassLoader.loadClass(...)`, or equivalent lookup-based bypasses under
  `src/view/**`

## Migration Debt

Current active code still contains programmatic JavaFX views, `assembly/`
composition packages, view `api/` packages, and legacy `Model/`, `Controller/`,
and `interactor/` buckets. Those structures describe current state only.

The target model is the declarative MVVM shape above. Standards work may update
documentation before source code and checker migration. Implementation work
that touches legacy view surfaces must move them toward the target shape rather
than copying the legacy topology.

## Verification Notes

Current checks still enforce the transitional topology that existed before the
declarative MVVM refactor. The enforcement coverage standard records that
current-state mapping.

Target mechanical checks should eventually cover:

- FXML files live under `resources/view/<component>/`
- `View/` may use JavaFX UI APIs and own FXML controllers
- `ViewModel/` may use only `javafx.beans.*` and `javafx.collections.*`, not
  scene graph, stage, or fxml APIs
- `View/` does not import domain, data, or shell
- `ViewModel/` imports only root application services and domain `api/`
  carriers from `src.domain.*`
- root view contributions are the only shell-facing composition adapters
- legacy view buckets are absent from target components

New mechanical gates require explicit user request before being added to the
local build/check pipeline.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [ADR 017: Declarative MVVM View Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/017-declarative-mvvm-view-boundary.md:1)
- [Microsoft MVVM Reference](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/microsoft-maui-mvvm.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/fowler-presentation-model.md:1)
- [Oracle JavaFX FXML Introduction](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/oracle-javafx-fxml-introduction.md:1)
- [JavaFX Properties And Binding](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/view-patterns/oracle-javafx-properties-binding.md:1)
