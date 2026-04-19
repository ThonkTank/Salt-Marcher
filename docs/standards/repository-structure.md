Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

The active view target is organized by SaltMarcher's cockpit model: tab models
under `src/view/models` and passive panel views under `src/view/views`.

## Repository Layout

```text
bootstrap/
shell/
src/
  view/
  domain/
  data/
resources/
docs/
  architecture/
  standards/
  adr/
  references/
  compat/
tools/
  gradle/
  quality/
    skills/
```

Additional constraints:

- `salt-marcher/` is legacy reference material, not the active implementation
  target.
- New top-level feature code must be addable inside `src/`.
- Do not create alternate top-level architecture roots for active feature code.
- Stylesheet files for active code must live directly under `resources/`.
- `tools/gradle/` owns included Gradle builds and verification harnesses.
- `tools/quality/` owns quality-platform configuration, rules, and helper
  scripts.
- `tools/quality/skills/` owns repo-versioned Codex skills and their bundled
  references.
- `docs/compat/` is reserved for deprecated compatibility stubs and must not
  become canonical again.

## Feature Layout

```text
src/
  view/
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
  domain/
    <feature>/
      <PascalFeatureName>ApplicationService.java
      api/              carrier types only
      application/
      <domain-module>/
      <domain-module>/
  data/
    <feature>/
      <PascalFeatureName>ServiceContribution.java
      repository/
      query/
      gateway/
        local/
        remote/
      model/
      mapper/
    persistencecore/
      shared infrastructure reused by multiple persistence features
resources/
  view/
    optional passive-view resources
```

## Public Entrypoints

Every shell-registered view contribution is represented by one model file:

- `src/view/models/<PascalContributionName>Model.java`
- public concrete type unless an explicit future registration contract says
  otherwise
- implements the public shell registration contract for exactly one
  contribution kind
- defines one tab model, one state-tab model, or one top-bar dropdown window
  model

Every passive panel view is represented by one view file:

- `src/view/views/<PascalPanelName>.java`
- defines exactly one panel-content fragment for one fixed shell surface
- exposes model-bindable listeners and user-event emitters
- does not expose domain or shell entrypoints

Every service-exporting data feature exposes exactly one service-registration
entrypoint:

- `src/data/<feature>/<PascalFeatureName>ServiceContribution.java`
- `public final`
- public no-arg constructor
- implements `shell.api.ServiceContribution`

Each persistence-exporting feature also exposes exactly one schema declaration:

- `src/data/<feature>/model/<PascalFeatureName>PersistenceSchema.java`

Documentation files are allowed in feature roots when they use the standard
co-located filenames such as `README.md`, `SPEC.md`, `DOMAIN.md`, `UI.md`,
`PERSISTENCE.md`, and `DELIVERY.md`.

## Enforcement Notes

- The canonical owner model, rule-status vocabulary, and blocking-task mapping
  for these checks live in the
  [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
- The concrete per-rule status and owner mapping for repository-structure
  rules lives in the
  [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).
- the included build at `tools/gradle/build-harness/` owns repository topology,
  package-path alignment, `src/` direct-child topology, included-build
  placement, and service-entrypoint presence rules below `src/data/`.
- Existing `checkViewArchitecture`, PMD, ArchUnit, Error Prone, and
  `build-harness` view checks enforce direct `src/view/models` contribution
  models and `src/view/views` passive panel views for active target code.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.
- The binding shell-workbench standard defines the semantic responsibilities of
  `AppShell`, registration contracts, cockpit surfaces, state-pane precedence,
  and allowed shell-facing API surface.
- The binding domain-layer standard defines the semantic responsibilities of
  `api/`, `application/`, and named domain modules inside one bounded context.
- The binding data-layer standard defines the semantic responsibilities of
  `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and
  `persistencecore/`.

## Packaging Rules

- Target view models live under `src/view/models`.
- Target passive panel views live under `src/view/views`.
- A `view/models` file owns exactly one shell-registered tab, state tab, or
  top-bar dropdown window model.
- A `view/views` file owns exactly one passive panel-content fragment for one
  shell surface.
- View models may depend on shell public contracts, passive views, JavaFX
  beans/collections, and domain application-service boundaries.
- Passive panel views may depend on JavaFX UI APIs and narrow listener/emitter
  contracts but must not depend on shell, domain, data, or ApplicationService
  types.
- Existing `src/view/<component>/`, `*ViewContribution.java`, `View/`,
  `ViewModel/`, `assembly/`, non-shared view `api/`, `Model/`, `Controller/`,
  and `interactor/` structures are migration debt, not target topology.
- The root `*ApplicationService` is the only public client-facing backend
  boundary below the view layer.
- Domain `api/` is carrier-only and must not define callable service, facade,
  repository, port, factory, locator, or gateway contracts.
- `application/` hosts application services and use-case orchestration. It is
  not the default home for behavior that belongs on an aggregate, entity, or
  value object.
- `api/` and `application/` are the only standard technical buckets directly
  under a domain feature root.
- Additional directories under `src/domain/<feature>/` must be named domain
  modules in the ubiquitous language of that bounded context.
- Legacy root role buckets under `src/domain/**` are forbidden by the
  architecture harness.
- Data implementation classes live under `repository/`, `query/`, `gateway/`,
  `model/`, or `mapper/`.
- `src/data/<feature>/*ServiceContribution.java` is a registration root,
  not a public business boundary.
- `repository/` is reserved for canonical-truth persistence adapters.
- `query/` is reserved for exported read-only query adapters.
- `gateway/local/` and `gateway/remote/` are internal concrete-source
  adapters, not public capability roots.
- `model/` is reserved for schema declarations and source-local carrier types.
- `mapper/` is reserved for translation between source-local shapes and
  domain-facing or boundary-facing types.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/agent-instructions.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [ADR 019: Shell Cockpit Tab Model View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
