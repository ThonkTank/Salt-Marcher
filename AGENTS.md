# Dictionary

Short definitions of SaltMarcher architecture terms. Terms are defined here once and then used in the rules below.

## Workflow Terms

| Term           | Definition                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Element        | Any single, atomic rendering element that may be part of a user interface.                             |
| Interaction    | A concrete user step such as click, type, drag, or selection.                                          |
| Interactable   | An explicitly interactive visual Element like a button or text field.                                  |
| Selectable     | An Interactable that sets a persisted state which influences further interactions until deselected     | 
| Tool           | A Feature Slice that allows the User to perform a set of related operations to fulfill thematically linked use cases |
| Use Case       | A user-meaningful application task or goal that may coordinate one or more operations.                 |
| User Flow      | An ordered sequence of user interactions and system responses that advances a use case.                |
| Interface      | A set of UI Components and Interactions geared toward enabling a thematically linked set of Use Cases. |
| UI Component   | A subarea of an Interface.                                                                             |
| defaultLanding | A tab-only flag that marks a default landing destination in the user-facing navigation flow.           |

## Architecture Terms

### Architecture and Boundary Terms

| Term               | Definition                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| MVCI               | Presentation pattern with `Model`, `View`, `Controller`, and `Interactor`.                                                                    |
| Clean Architecture | Backend structure with strict inward-pointing dependencies.                                                                                   |
| Feature            | A project-local vertical slice with its own view, domain, and data code. It is not automatically a synonym for `Subdomain` or `Subsystem`.    |
| Feature API        | The only public backend boundary a feature exposes below the view layer. It publishes the operations that presentation code may invoke.       |
| Domain             | The business concepts and rules expressed by the system or a feature slice. It is not the only possible business boundary term in the system. |
| Subdomain          | A business sub-area inside the wider domain that is independent of the project's feature slicing.                                             |
| Subsystem          | A technical sub-area inside the system that is independent of the project's feature slicing.                                                  |
| Responsibility     | A clearly owned concern assigned to one boundary, component, or layer.                                                                        |
| Passive Host       | A shell that exposes slots and registration contracts without owning feature logic.                                                           |
| Shell              | The passive host UI around the application.                                                                                                   |

### Rules and Decision Logic Terms

| Term            | Definition                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Dependency Rule | The rule that dependencies point inward and do not cross forbidden architectural boundaries.                    |
| Rule            | A business or architectural constraint that must hold.                                                          |
| Policy          | A named decision rule that chooses or permits behavior.                                                         |
| Specification   | A reusable rule that tests whether something satisfies defined criteria.                                        |
| Standard Flow   | The default path from user interaction through presentation, domain, and data, then back to presentation state. |

## Implementation Terms

### Presentation Terms

| Term        | Definition                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Model       | JavaFX observable presentation state only.                                                                                                |
| View        | JavaFX layout, bindings, event handlers, and view-local behavior.                                                                         |
| Controller  | Presentation coordinator for actions, lifecycle, background work, and FX-thread handoff.                                                  |
| Interactor  | The presentation-side translation boundary between presentation state and the feature API. It is not a synonym for domain use case logic. |
| Reactive UI | UI behavior driven by observable state and bindings rather than imperative node churn.                                                    |
| ViewBuilder | Java-based builder that constructs a JavaFX view from presentation dependencies.                                                          |

### Domain and Data Terms

| Term                      | Definition                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Operation                 | A concrete business or technical action with a clearly defined purpose.                             |
| Command                   | A state-changing operation.                                                                         |
| Query                     | A read-only operation that returns data and does not change system state.                           |
| Domain Model              | The business-shaped object model expressed by entities, value objects, and related domain concepts. |
| Entity                    | A business object with behavior and invariants.                                                     |
| Value Object              | An immutable domain value with validation and meaning.                                              |
| Repository Interface      | A domain-owned contract for loading or persisting domain objects.                                   |
| Repository Implementation | A data-layer adapter that implements a repository interface and coordinates sources plus mapping.   |
| Data Layer                | Technical adapters around persistence, files, HTTP, and other external systems.                     |
| Data Source               | A concrete local or remote access adapter used by the data layer.                                   |
| Local Data Source         | A data source for database, cache, preferences, or file-based access.                               |
| Remote Data Source        | A data source for HTTP or other remote systems.                                                     |
| Data Model                | A storage-shaped or transport-shaped type used only in the data layer.                              |
| Mapper                    | A translator between data models and domain objects.                                                |
| Persistence Contribution  | The public `*PersistenceContribution.java` class that registers a feature's exported persistence capabilities. |
| Persistence Registry      | The passive shell-owned typed registry of persistence capabilities assembled during bootstrap.       |
| Persistence Schema        | The canonical feature-owned in-code declaration of persisted tables, columns, and additive schema expectations. |

### Shell and Contribution Terms

| Term                  | Definition                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap             | Application startup and generic feature discovery.                                                                                           |
| Feature Entrypoint    | The public `*ViewContribution.java` class that registers a feature with the shell.                                                           |
| Shell Panel           | A shell-owned passive panel package or container that exposes targetable UI areas.                                                           |
| Shell Slot            | A fixed shell-owned target area such as `COCKPIT_MAIN` or `TOP_BAR`.                                                                         |
| Shell Runtime Context | The narrow shell-owned runtime boundary exposed to feature screens.                                                                          |
| Inspector             | The shared shell-owned inspection history surface.                                                                                           |
| InspectorSink         | The runtime port returned by `ShellRuntimeContext.inspector()` for pushing inspector entries.                                                |
| Shell Screen          | The feature-owned object that provides slot content for a registered contribution.                                                           |
| ShellViewContribution | The shell registration contract implemented by a feature entrypoint.                                                                         |
| ShellContributionSpec | Metadata that declares the contribution category and registration details.                                                                   |
| Shell Registry        | The spec-type-based registration path from `ShellViewContribution` into `AppShell.registerTab`, `registerTopBar`, or `registerRuntimeState`. |
| Contribution Type     | The contribution category identified by the spec class, such as tab, top bar, or runtime state.                                              |
| ShellTabSpec          | A tab contribution spec for left-navigation tabs.                                                                                            |
| ShellTopBarSpec       | A contribution spec for always-visible top-bar content.                                                                                      |
| ShellRuntimeStateSpec | A contribution spec for global shared runtime-state content.                                                                                 |
| ShellTabMode          | Mode metadata that controls whether a tab uses shared runtime state or feature-owned editor state.                                           |
| ShellTabMode.RUNTIME  | Tab mode that uses the shared runtime-state panel.                                                                                           |
| ShellTabMode.EDITOR   | Tab mode that may provide feature-owned lower-right state content.                                                                           |
| ContributionKey       | The stable technical key of a contribution.                                                                                                  |
| NavigationGroupSpec   | Open metadata for navigation grouping and ordering.                                                                                          |
| Runtime-State Tab     | A global lower-right state contribution that is not owned by a specific runtime tab.                                                         |
| Runtime-State Panel   | The shared lower-right shell panel used by runtime-state content.                                                                            |
| Persistence Lookup    | The runtime lookup path from `ShellRuntimeContext.persistence()` into the shared `PersistenceRegistry`.                                     |

### Lifecycle and Runtime Mechanics Terms

| Term               | Definition                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Shell Registration | The act of exposing a `ShellContributionSpec` and a `ShellScreen` through `ShellViewContribution`.                                |
| Bootup Discovery   | Generic bootstrap discovery of feature entrypoints under `src/view/<component>/` through `ShellViewDiscovery`.                    |
| Persistence Discovery | Generic bootstrap discovery of persistence entrypoints under `src/data/<feature>/` through `PersistenceContributionDiscovery`.     |
| Panel Mounting     | Static slot-based projection of prepared feature nodes through `ShellScreen.slotContent()`.                                       |
| Inspector Mounting | Dynamic inspector entry publication through `ShellRuntimeContext.inspector().push(...)`, not through `ShellScreen.slotContent()`. |

# Rules

## Structure

### Repository Layout

Use this repository layout for active application code:

```text
bootstrap/      # Application startup and generic feature discovery.
shell/
    host/       # Passive host shell built once at startup.
    panel/      # Passive host panels / slots that contributions target.
src/
    view/       # Presentation code organized by component.
    domain/     # Domain code organized by feature.
    data/       # Data adapters organized by feature.
resources/      # Static resources used by the application.
```

Additional repository constraints:

- `salt-marcher/` is a legacy reference tree, not the active implementation target.
- New top-level features must be addable by creating code only inside `src/`.
- Do not create alternate top-level architecture roots for feature code.

### Allowed Feature Layout

Feature code must follow this structure:

```text
src/
    view/
        <componentName>/
            <PascalComponentName>ViewContribution.java
            Model/
            Controller/
            View/
            interactor/
    domain/
        <featureName>/
            <featureName>API.java
            entity/
            valueobject/
            usecase/
            repository/
    data/
        <featureName>/
            <PascalFeatureName>PersistenceContribution.java
            repository/
            datasource/
                local/
                remote/
            model/
            mapper/
```

Only these feature directories are allowed for new work:

- `src/view/<component>/Model`
- `src/view/<component>/Controller`
- `src/view/<component>/View`
- `src/view/<component>/interactor`
- `src/domain/<feature>/entity`
- `src/domain/<feature>/valueobject`
- `src/domain/<feature>/usecase`
- `src/domain/<feature>/repository`
- `src/data/<feature>/repository`
- `src/data/<feature>/datasource/local`
- `src/data/<feature>/datasource/remote`
- `src/data/<feature>/model`
- `src/data/<feature>/mapper`

### Required Persistence Entrypoint

Every feature that exports persistence capabilities must expose exactly one data root entrypoint:

- It lives at `src/data/<feature>/<PascalFeatureName>PersistenceContribution.java`.
- It declares package `src.data.<feature>`.
- It is a `public final` class.
- It exposes a public no-arg constructor.
- It implements `shell.host.PersistenceContribution`.
- It registers exported capabilities through `PersistenceRegistry.Builder`.
- Its feature must expose exactly one `src/data/<feature>/model/<PascalFeatureName>PersistenceSchema.java`.

### Required Feature Entrypoint

Every navigable or shell-registered feature must expose exactly one feature entrypoint:

- It lives at `src/view/<component>/<PascalComponentName>ViewContribution.java`.
- It declares package `src.view.<component>`.
- It is a `public final` class.
- It exposes a public no-arg constructor.
- It implements `shell.host.ShellViewContribution`.
- It declares exactly one passive contribution spec.
- It returns a feature-owned `ShellScreen`.

### Naming and Directory Constraints

These structural constraints are mandatory:

- The component root under `src/view/<component>/` is reserved for the feature entrypoint file only.
- The feature root under `src/data/<feature>/` is reserved for the persistence entrypoint file only.
- All other presentation classes must live under `Model/`, `Controller/`, `View/`, or `interactor/`.
- `<featureName>API.java` is the only public backend boundary under `src/domain/<feature>/`.
- Do not introduce `service/` or `services/` as a domain directory.
- Do not create feature-owned alternate shell registry directories.
- Do not create a second shell wiring path outside the shell contribution contracts.

## Placement

### Placement Principles

Use these placement principles for all new code:

- Presentation uses MVCI.
- Backend logic behind the UI uses standard Clean Architecture.
- The shell stays passive after construction.
- The interactor is the only presentation-side translation boundary between presentation state and a feature API.
- Feature internals stay hidden behind the feature API.

### Bootstrap

Put code in `bootstrap/` when it exists to start the application or compose the presentation shell.

- Bootstrap builds the shell once at startup.
- Bootstrap discovers feature entrypoints generically.
- Bootstrap may depend on generic shell registration contracts.
- Bootstrap must not become feature orchestration or backend logic.

Why this goes here:

- Startup wiring is an application concern, not a feature concern.
- Generic discovery belongs at the composition boundary, not inside the shell or a feature.

### Shell

Put code in `shell/` when it exists to host passive UI structure and shell-owned runtime surfaces.

- `shell/host` owns the passive host shell and its generic registration contracts.
- `shell/panel` defines passive panels and slot targets.
- The shell may define slot structure and open registration contracts.
- The shell must not know feature business logic or mount features manually through feature-specific wiring.
- The shell must not contain closed feature enums, feature registries, or domain logic.

Why this goes here:

- The shell is a reusable host boundary, not a second application layer.
- Passive slot ownership keeps features decoupled from the host implementation.

### View Layer

Put code in `src/view/<component>/` when it exists to render and coordinate JavaFX presentation behavior.

- `Model` holds JavaFX observable UI state only.
- `View` owns layout, bindings, event handlers, and view-local behavior.
- `Controller` owns action wiring, lifecycle hooks, background-task setup, and FX-thread handoff.
- `interactor` translates interactions and controller requests into feature API calls and maps results back into the presentation model.
- `View` and `Controller` must not depend on domain internals.

Why this goes here:

- Presentation concerns need direct access to JavaFX types and lifecycle.
- Keeping translation logic in the interactor prevents domain leakage into the UI.

### Domain Layer

Put code in `src/domain/<feature>/` when it expresses business meaning or business operations.

- `entity` contains business entities and invariants.
- `valueobject` contains immutable domain values with validation.
- `usecase` contains use case entrypoints for user-meaningful application tasks.
- A use case may internally coordinate command and query operations without creating a separate directory split.
- `repository` contains domain-owned persistence/query contracts.
- `<featureName>API.java` is the only public feature boundary exposed below the view layer.

Why this goes here:

- Business rules belong in the feature core, independent of JavaFX and infrastructure.
- The feature API is the seam that protects internal domain structure from outside callers.

### Data Layer

Put code in `src/data/<feature>/` when it talks to persistence, files, HTTP, caches, or other external systems.

- `<PascalFeatureName>PersistenceContribution.java` is the only public data root entrypoint and registers exported persistence capabilities.
- `repository` contains repository implementations.
- `datasource/local` contains local technical adapters.
- `datasource/remote` contains remote technical adapters.
- `model` contains storage-shaped and transport-shaped data types.
- `<PascalFeatureName>PersistenceSchema.java` in `model/` is the canonical persisted schema declaration for that feature.
- `mapper` converts between data models and domain objects.

Why this goes here:

- Infrastructure concerns must stay outside the domain.
- Data models and transport concerns should not leak upward into domain or presentation code.
- Persistence export wiring must remain feature-owned and discoverable without manual bootstrap edits.

### UI Construction Rules

Use these rules when constructing JavaFX UI:

- UI state lives in observables and bindings.
- Views should react through bindings instead of imperative node churn.
- FXML is not used in this project.
- Views are built in Java code, typically through a `ViewBuilder`.
- Use a `ViewBuilder` when you are configuring existing JavaFX nodes rather than exposing custom view APIs.

## Dependencies

### Dependency Rule

Dependencies point inward.

- Presentation reaches backend content only through the interactor and a feature API.
- Domain defines contracts and business rules.
- Data implements contracts owned by the domain.

### Allowed Dependencies

Only these direct architectural dependencies are allowed:

- `bootstrap -> shell`
- `view/<component>/<PascalComponentName>ViewContribution -> shell.host registration contracts`
- `view/<component>/interactor -> domain/<featureName>/<featureName>API`
- `domain/<featureName>/<featureName>API -> usecase/`
- `usecase/ -> repository/`
- `data/<featureName> -> domain/<featureName>`

### Forbidden Dependencies

These dependencies are forbidden:

- `view/View -> domain/*`
- `view/Controller -> domain/*`
- `view/* -> data/*`
- `shell -> view/*`
- `shell -> view/<component>/interactor`
- `shell -> domain/*`
- `shell -> data/*`
- `shell -> domain internals`
- `bootstrap -> view/<component>`
- `bootstrap -> domain/*`
- `bootstrap -> data/*`
- `domain -> view`
- `domain -> shell`
- `domain -> data`
- `domain -> JavaFX`
- `domain -> HTTP/SQL/JSON/filesystem frameworks`

### Bootup Discovery Contract

The bootup discovery contract is the generic bootstrap path from `src/view/<component>/` into the shell registry.

- `AppBootstrap.createShell()` creates `AppShell`.
- `AppBootstrap` resolves contributions by calling `discoverContributions(shell.runtimeContext())`.
- `ShellViewDiscovery.discover()` scans `src/view/<component>/` root classes.
- Each component root must expose exactly one root class.
- That root class must be named `<PascalComponentName>ViewContribution`.
- The discovered class must implement `ShellViewContribution`.
- The discovered class must expose a public no-arg constructor.
- Discovery resolves `registrationSpec()` and `createScreen(runtimeContext)` before registration.

Bootup discovery template:

```text
AppBootstrap.createShell()
  -> new AppShell()
  -> discovery.discover()
  -> contribution.registrationSpec()
  -> contribution.createScreen(shell.runtimeContext())
  -> shell.registerTab(...) | shell.registerTopBar(...) | shell.registerRuntimeState(...)
  -> navigateTo(startup.key()) when a startup tab is resolved
```

### Persistence Discovery Contract

The persistence discovery contract is the generic bootstrap path from `src/data/<feature>/` into the shared persistence registry.

- `AppBootstrap.createShell()` resolves persistence before feature screens are created.
- `PersistenceContributionDiscovery.discover()` scans `src/data/<feature>/` root classes.
- Each persistence-exporting feature root must expose exactly one root class.
- That root class must be named `<PascalFeatureName>PersistenceContribution`.
- The discovered class must implement `PersistenceContribution`.
- The discovered class must expose a public no-arg constructor.
- The feature must expose exactly one `<PascalFeatureName>PersistenceSchema` in `src/data/<feature>/model/`.

Persistence discovery template:

```text
AppBootstrap.createShell()
  -> persistenceContributionDiscovery.discover()
  -> contribution.register(persistenceRegistryBuilder)
  -> new AppShell(persistenceRegistry)
  -> feature view reads runtimeContext.persistence().require(...)
```

### Shell Registry Contract

The shell registry contract is the spec-type-based dispatch from a feature entrypoint into `AppShell`.

- The feature entrypoint exposes `ShellContributionSpec registrationSpec()`.
- The feature entrypoint exposes `ShellScreen createScreen(ShellRuntimeContext runtimeContext)`.
- `AppBootstrap.register(...)` dispatches by spec type.
- `ShellTabSpec` maps to `AppShell.registerTab(...)`.
- `ShellTopBarSpec` maps to `AppShell.registerTopBar(...)`.
- `ShellRuntimeStateSpec` maps to `AppShell.registerRuntimeState(...)`.
- Unsupported contribution types are invalid.

Shell registry template:

```java
public final class ExampleViewContribution implements ShellViewContribution {

    public ExampleViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("example"),
                new NavigationGroupSpec("group", "Group", 10),
                10,
                false,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Example";
            }

            @Override
            public String getNavigationLabel() {
                return "Ex";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_MAIN, createMainContent());
            }
        };
    }

    private Node createMainContent() {
        return null;
    }
}
```

### Panel Mounting Contract

The panel mounting contract is the static slot-based projection path for prepared feature UI nodes.

- Static shell panel mounting happens only through `ShellScreen.slotContent()`.
- `slotContent()` returns `Map<ShellSlot, Node>`.
- The shell mounts prepared feature-owned nodes into fixed shell-owned slots.
- Required and allowed slots depend on the contribution type.
- Static panel mounting is the only allowed path for top bar, controls, main, details, and runtime-state slot content.

Panel mounting templates:

```java
Map.of(
        ShellSlot.COCKPIT_MAIN, createMainContent(),
        ShellSlot.COCKPIT_CONTROLS, createControls())
```

```java
Map.of(
        ShellSlot.TOP_BAR, createTopBarContent())
```

```java
Map.of(
        ShellSlot.COCKPIT_STATE, createRuntimeStateContent())
```

Panel mounting matrix:

- `ShellTabSpec`: `COCKPIT_MAIN` required, `COCKPIT_CONTROLS` optional
- `ShellTabSpec` + `ShellTabMode.RUNTIME`: `COCKPIT_STATE` forbidden
- `ShellTabSpec` + `ShellTabMode.EDITOR`: `COCKPIT_STATE` optional
- `ShellTopBarSpec`: only `TOP_BAR`
- `ShellRuntimeStateSpec`: only `COCKPIT_STATE`
- `COCKPIT_DETAILS` is a valid static shell slot when feature-owned details content is needed

### Inspector Mounting Contract

The inspector mounting contract is the dynamic runtime path for shared inspector history entries.

- Inspector mounting is dynamic, not slot-based.
- Features access the inspector only through `ShellRuntimeContext.inspector()`.
- The runtime port type is `InspectorSink`.
- Inspector entries are published with `InspectorEntrySpec`.
- Inspector content must not be mounted through `ShellScreen.slotContent()` or direct shell access.

Inspector mounting template:

```java
runtimeContext.inspector().push(new InspectorEntrySpec(
        "Example Inspector",
        exampleKey,
        this::createInspectorContent,
        this::createInspectorFooter));
```

Inspector runtime helpers:

- `clear()` clears the shared inspector history
- `isShowing(entryKey)` checks whether a keyed entry is currently showing

### Registration and Slot Interaction Rules

All shell registration and slot interactions must follow these rules:

- A feature entrypoint implements `ShellViewContribution`.
- A feature entrypoint declares exactly one passive contribution spec.
- Allowed contribution types are `ShellTabSpec`, `ShellTopBarSpec`, and `ShellRuntimeStateSpec`.
- Bootstrap must discover feature entrypoints generically.
- Adding a new feature must not require routine edits in `bootstrap/` or `shell/`.
- There is exactly one allowed shell wiring path for new `src/` content: `ShellViewContribution -> ShellScreen -> ShellSlot`.
- `ShellScreen` may only target `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS`, and `COCKPIT_STATE`.

Slot-specific rules:

- `ShellTabSpec` requires `COCKPIT_MAIN` and may optionally provide `COCKPIT_CONTROLS`.
- `ShellTabSpec` with `ShellTabMode.RUNTIME` must not provide `COCKPIT_STATE`.
- `ShellTabSpec` with `ShellTabMode.EDITOR` may optionally provide `COCKPIT_STATE`.
- `ShellTopBarSpec` may only provide `TOP_BAR`.
- `ShellRuntimeStateSpec` may only provide `COCKPIT_STATE`.
- `defaultLanding` only applies to `ShellTabSpec`.

Runtime interaction rules:

- Navigation groups are open metadata supplied by features, not closed shell enums.
- Runtime-state tabs are global and autonomous.
- Features must not talk to `AppShell`, `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry`, or concrete shell panels as alternate wiring paths.
- Features must read exported persistence capabilities only through `ShellRuntimeContext.persistence()`.

### Standard Interaction Flows

Normal feature flow:

`Bootstrap builds shell -> Bootstrap discovers feature entrypoints under src/view/<component>/ -> Feature entrypoint supplies ShellContributionSpec + ShellScreen -> Bootstrap registers contribution by spec type -> Shell mounts slot content generically into the passive host -> User interaction -> Controller action -> Interactor -> Feature API -> Domain use case -> command/query operation against a domain repository interface <- Data repository implementation -> Data source -> Data model -> Mapper -> Domain model/result -> Interactor -> Presentation model`

Persistence bootstrap flow:

`Bootstrap discovers persistence contributions under src/data/<feature>/ -> Persistence contribution registers typed capabilities into PersistenceRegistry -> AppShell exposes the registry through ShellRuntimeContext.persistence() -> Feature root resolves repository interfaces from the passive registry`

Inspector flow:

`View/Controller/Interactor -> ShellRuntimeContext.inspector().push(...) -> shared shell inspector history`

### Explicit Non-Goals

To keep the architecture stable, do not:

- pass JavaFX types into `domain/` or `data/`
- expose `data/` classes through `<featureName>API.java`
- return data-layer models from use cases
- treat `Feature` as an automatic synonym for `Subdomain` or `Subsystem`
- use `Use Case` as a catch-all term for every user interaction or low-level operation
- call domain content directly from views or controllers
- call repositories or data sources directly from view components
- let the shell compose, start, or mount feature components
- let the shell implement feature logic
- let the shell call feature APIs or interactors directly
- let the shell hold closed feature enums or a manually curated feature registry
- let controllers own application startup or slot mounting as the default convention
- let bootstrap import concrete feature classes from `src/view/<component>/`
- let bootstrap call feature APIs or data adapters directly
- let bootstrap require routine edits outside `src/` when a new feature exports persistence capabilities
- expose internal feature details outside `<featureName>API.java`
- skip the interactor and let a view component talk to a feature API directly
- skip a feature API and let the interactor talk to feature internals for convenience
- introduce `service/` or `services/` as a domain directory or architectural escape hatch
- introduce a second shell wiring path besides `ShellViewContribution -> ShellScreen -> ShellSlot`
- use legacy runtime-service persistence wiring such as `RuntimeServiceProvider` or `RuntimeServiceRegistry`
- use `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry`, or concrete shell panel classes from `src/view/`
- register content directly in `AppShell` from feature code
- create feature-owned alternate registries for top bar, runtime state, or inspector content
- place additional exported persistence wiring files directly under `src/data/<feature>/` besides `<PascalFeatureName>PersistenceContribution.java`
- couple runtime-state content to one specific runtime tab instead of publishing autonomous global runtime-state tabs

## Workflow

### Build and Install Protocol

Build and install steps are mandatory after code changes:

- Run `./gradlew build --console=plain 2>&1` after every completed code change.
- Fix all build failures before proceeding.
- Do not stop at `./gradlew build` alone when the desktop app is the manual test surface.
- By default, run `./gradlew installDesktopApp --console=plain 2>&1` after the build before handoff.
- Skip the reinstall only when the user explicitly waives it or when the task is purely planning or review work.

### Verification Rules

Verification claims must be literal:

- Do not imply that a build, install, manual check, import, migration, or other verification happened unless it actually ran.
- If something was not verified, say so directly and name the missing check.

### Task-Specific Verification

Apply these extra verification rules when relevant:

- Do not add or change automated tests unless explicitly requested.
- The minimum quality gate is `./gradlew build`.
- If you change importer or parser flows, run the relevant crawler or import task.
- If you change schema or storage assumptions, rebuild `game.db` from crawled data and protect user-created data with backups or migration logic.
- Notes about unchecked operations may be ignored.

### Commit Rules

Commit discipline is mandatory:

- Create a focused commit for the completed change unless the user explicitly asks not to commit.
- Use Conventional Commits such as `feat: ...`, `fix: ...`, `refactor: ...`, or `docs: ...`.
- Keep each commit to one concern.
- Call out schema, crawler, backup-format, packaging, or workflow impacts explicitly when relevant.
- Do not hide unrelated cleanup inside a convenience commit.

### Start-of-Task Protocol

Before starting a new implementation request:

1. Inspect the worktree for pre-existing local modifications.
2. Commit those existing modifications.
3. Push them to `main`.
4. Only then begin the newly requested change.

This protocol is mandatory, not advisory.

- The presence of pre-existing local modifications is not a reason to pause; it is the trigger to perform the protocol.
- Only stop and surface a blocker when a concrete obstacle prevents the protocol from being completed safely, such as merge conflicts, missing push credentials, sandbox restrictions that require approval, or suspected secrets in pending changes.
- A dirty tree is not itself a blocker.
