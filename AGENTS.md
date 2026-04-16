# Dictionary

Short definitions of SaltMarcher architecture terms. Terms are defined here once and then used in the rules below.

## Architecture and System Terms

| Term | Definition |
| --- | --- |
| MVCI | Presentation pattern with `Model`, `View`, `Controller`, and `Interactor`. |
| Clean Architecture | Backend structure with strict inward-pointing dependencies. |
| Feature | A bounded functional area with its own view, domain, and data code. |
| Feature API | The only public backend boundary a feature exposes below the view layer. |
| Dependency Rule | The rule that dependencies point inward and do not cross forbidden architectural boundaries. |
| Standard Flow | The default path from UI event through presentation, domain, and data, then back to presentation state. |
| Passive Host | A shell that exposes slots and registration contracts without owning feature logic. |
| Feature Entrypoint | The public `*ViewContribution.java` class that registers a feature with the shell. |
| Shell Registration | The act of exposing a `ShellContributionSpec` and a `ShellScreen` through `ShellViewContribution`. |

## Presentation Terms

| Term | Definition |
| --- | --- |
| Model | JavaFX observable state for presentation only. |
| View | JavaFX layout, bindings, event handlers, and view-local behavior. |
| Controller | Presentation coordinator for actions, lifecycle, background work, and FX-thread handoff. |
| Interactor | Translation boundary between presentation state and the feature API. |
| Reactive UI | UI behavior driven by observable state and bindings rather than imperative node churn. |
| ViewBuilder | Java-based builder that constructs a JavaFX view from presentation dependencies. |

## Domain and Data Terms

| Term | Definition |
| --- | --- |
| Domain | The business core of a feature. |
| Entity | A business object with behavior and invariants. |
| Value Object | An immutable domain value with validation and meaning. |
| Use Case | A single business action or business question. |
| Repository Interface | A domain-owned contract for loading or persisting domain objects. |
| Repository Implementation | A data-layer adapter that implements a repository interface and coordinates sources plus mapping. |
| Data Layer | Technical adapters around persistence, files, HTTP, and other external systems. |
| Data Source | A concrete local or remote access adapter used by the data layer. |
| Local Data Source | A data source for database, cache, preferences, or file-based access. |
| Remote Data Source | A data source for HTTP or other remote systems. |
| Data Model | A storage-shaped or transport-shaped type used only in the data layer. |
| Mapper | A translator between data models and domain objects. |

## Shell and Contribution Terms

| Term | Definition |
| --- | --- |
| Bootstrap | Application startup and generic feature discovery. |
| Shell | The passive host UI around the application. |
| Shell Panel | A shell-owned passive panel package or container that exposes targetable UI areas. |
| Shell Slot | A fixed shell-owned target area such as `COCKPIT_MAIN` or `TOP_BAR`. |
| Shell Runtime Context | The narrow shell-owned runtime boundary exposed to feature screens. |
| Inspector | The shared shell-owned inspection history surface. |
| InspectorSink | The runtime port returned by `ShellRuntimeContext.inspector()` for pushing inspector entries. |
| Shell Screen | The feature-owned object that provides slot content for a registered contribution. |
| ShellViewContribution | The shell registration contract implemented by a feature entrypoint. |
| ShellContributionSpec | Metadata that declares the contribution category and registration details. |
| Contribution Type | The contribution category identified by the spec class, such as tab, top bar, or runtime state. |
| ShellTabSpec | A tab contribution spec for left-navigation tabs. |
| ShellTopBarSpec | A contribution spec for always-visible top-bar content. |
| ShellRuntimeStateSpec | A contribution spec for global shared runtime-state content. |
| ShellTabMode | Mode metadata that controls whether a tab uses shared runtime state or feature-owned editor state. |
| ShellTabMode.RUNTIME | Tab mode that uses the shared runtime-state panel. |
| ShellTabMode.EDITOR | Tab mode that may provide feature-owned lower-right state content. |
| ContributionKey | The stable technical key of a contribution. |
| NavigationGroupSpec | Open metadata for navigation grouping and ordering. |
| defaultLanding | A tab-only flag that marks a default landing destination. |
| Runtime-State Tab | A global lower-right state contribution that is not owned by a specific runtime tab. |
| Runtime-State Panel | The shared lower-right shell panel used by runtime-state content. |

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
- All other presentation classes must live under `Model/`, `Controller/`, `View/`, or `interactor/`.
- `<featureName>API.java` is the only public backend boundary under `src/domain/<feature>/`.
- Do not introduce `service/` or `services/` as a domain directory.
- Do not create feature-owned alternate shell registry directories.
- Do not create a second shell wiring path outside the shell contribution contracts.

### Minimal Feature Skeleton

Use this skeleton when introducing a new top-level feature:

```text
src/
    view/
        encounter/
            EncounterViewContribution.java
            Model/
            Controller/
            View/
            interactor/
    domain/
        encounter/
            encounterAPI.java
            entity/
            valueobject/
            usecase/
            repository/
    data/
        encounter/
            repository/
            datasource/
                local/
                remote/
            model/
            mapper/
```

## Placement

### Placement Principles

Use these placement principles for all new code:

- Presentation uses MVCI.
- Backend logic behind the UI uses standard Clean Architecture.
- The shell stays passive after construction.
- The interactor is the only translation boundary between presentation state and a feature API.
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
- `interactor` translates UI intent into feature API calls and maps results back into the presentation model.
- `View` and `Controller` must not depend on domain internals.

Why this goes here:

- Presentation concerns need direct access to JavaFX types and lifecycle.
- Keeping translation logic in the interactor prevents domain leakage into the UI.

### Domain Layer

Put code in `src/domain/<feature>/` when it expresses business meaning or business operations.

- `entity` contains business entities and invariants.
- `valueobject` contains immutable domain values with validation.
- `usecase` contains one business action or question per use case.
- `repository` contains domain-owned persistence/query contracts.
- `<featureName>API.java` is the only public feature boundary exposed below the view layer.

Why this goes here:

- Business rules belong in the feature core, independent of JavaFX and infrastructure.
- The feature API is the seam that protects internal domain structure from outside callers.

### Data Layer

Put code in `src/data/<feature>/` when it talks to persistence, files, HTTP, caches, or other external systems.

- `repository` contains repository implementations.
- `datasource/local` contains local technical adapters.
- `datasource/remote` contains remote technical adapters.
- `model` contains storage-shaped and transport-shaped data types.
- `mapper` converts between data models and domain objects.

Why this goes here:

- Infrastructure concerns must stay outside the domain.
- Data models and transport concerns should not leak upward into domain or presentation code.

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
- Inspector content is pushed through `ShellRuntimeContext.inspector()`.
- Runtime-state tabs are global and autonomous.
- Features must not talk to `AppShell`, `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry`, or concrete shell panels as alternate wiring paths.

### Standard Interaction Flows

Normal feature flow:

`Bootstrap builds shell -> Bootstrap discovers feature entrypoints under src/view/<component>/ -> Feature entrypoint supplies ShellContributionSpec + ShellScreen -> Bootstrap registers contribution by spec type -> Shell mounts slot content generically into the passive host -> View event -> Controller action -> Interactor -> Feature API -> Domain use case -> Domain repository interface <- Data repository implementation -> Data source -> Data model -> Mapper -> Domain result -> Interactor -> Presentation model`

Inspector flow:

`View/Controller/Interactor -> ShellRuntimeContext.inspector().push(...) -> shared shell inspector history`

### Explicit Non-Goals

To keep the architecture stable, do not:

- pass JavaFX types into `domain/` or `data/`
- expose `data/` classes through `<featureName>API.java`
- return data-layer models from use cases
- call domain content directly from views or controllers
- call repositories or data sources directly from view components
- let the shell compose, start, or mount feature components
- let the shell implement feature logic
- let the shell call feature APIs or interactors directly
- let the shell hold closed feature enums or a manually curated feature registry
- let controllers own application startup or slot mounting as the default convention
- let bootstrap import concrete feature classes from `src/view/<component>/`
- let bootstrap call feature APIs or data adapters directly
- expose internal feature details outside `<featureName>API.java`
- skip the interactor and let a view component talk to a feature API directly
- skip a feature API and let the interactor talk to feature internals for convenience
- introduce `service/` or `services/` as a domain directory or architectural escape hatch
- introduce a second shell wiring path besides `ShellViewContribution -> ShellScreen -> ShellSlot`
- use `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry`, or concrete shell panel classes from `src/view/`
- register content directly in `AppShell` from feature code
- create feature-owned alternate registries for top bar, runtime state, or inspector content
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
