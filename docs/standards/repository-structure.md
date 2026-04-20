Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

The active view target is organized by SaltMarcher's cockpit contribution
model: discovered contribution roots under `src/view/tabs`,
`src/view/topbar`, and `src/view/state`; reserved detail roots under
`src/view/details`; and reusable generic passive views under `src/view/views`.

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
- Stylesheet files for active code must be centralized in
  `resources/salt-marcher.css`.
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
        <PascalEntry>View.java
    state/
      <entry>/
        <PascalEntry>Contribution.java
        <PascalEntry>ViewModel.java
        <PascalEntry>View.java
    details/
      <entry>/
        <PascalEntry>ViewModel.java
        <PascalEntry>View.java
    views/
      <PascalReusableView>.java
      <PascalReusableBaseView>.java
  domain/
    <feature>/
      <PascalFeatureName>ApplicationService.java
      published/        published language carriers only
      application/
      <domain-module>/
        aggregate/
        entity/
        value/
        policy/
        repository/
        factory/
        service/
        event/
        specification/
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
      sqlite/
      model/
resources/
  view/
    optional passive-view resources
```

## Public Entrypoints

Every shell-registered UI contribution is represented by one contribution
root:

- `src/view/tabs/<entry>/<PascalEntry>Contribution.java` for one left-bar tab
- `src/view/topbar/<entry>/<PascalEntry>Contribution.java` for one top-bar
  dropdown window
- `src/view/state/<entry>/<PascalEntry>Contribution.java` for one global
  runtime state-panel tab
- `src/view/details/<entry>/` owns detail-entry ViewModels and passive views
  published through shell-owned details/history APIs; it is not scanned for
  bootstrap-discovered contributions

A contribution class is `public final`, has a public no-arg constructor,
implements `shell.api.ShellContribution`, and defines exactly one shell
contribution.

Every contribution-owned or detail-owned ViewModel is represented by one
`*ViewModel.java` file in the same root. It owns presentation state and
user-intent handling, not shell discovery or view instantiation.

Every contribution-owned or detail-owned passive view is represented by one
`*View.java` file in the same root. It defines exactly one panel, dropdown,
state, or detail fragment for one shell surface.

Reusable generic passive views and base views may live directly under
`src/view/views/`. Feature-owned concrete views must not be moved there simply
to share a package; they stay in the owning contribution root and may extend
the reusable generic view.

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
- The included build at `tools/gradle/build-harness/` owns repository
  topology, package-path alignment, `src/` direct-child topology,
  included-build placement, and service-entrypoint presence rules below
  `src/data/`.
- Existing `checkViewArchitecture`, PMD, ArchUnit, Error Prone, and
  `build-harness` view checks enforce contribution-root placement, root
  composition, co-located ViewModel/passive View ownership, and FXML resource
  placement for active target view code.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.
- The shell-workbench standard defines the semantic responsibilities of
  `AppShell`, registration contracts, cockpit surfaces, state-pane precedence,
  and allowed shell-facing API surface.
- The domain-layer standard defines the semantic responsibilities of
  `published/`, `application/`, fachlich named domain modules, and module role
  packages inside one real domain context.
- The data-layer standard defines the semantic responsibilities of
  `repository/`, `query/`, `gateway/`, `model/`, `mapper`, and
  `persistencecore/`.

## Packaging Rules

- Active target view code lives under `src/view/tabs`, `src/view/topbar`,
  `src/view/state`, `src/view/details`, or reusable `src/view/views`.
- Contribution-owned Java files are direct files under
  `src/view/<area>/<entry>/`.
- Reusable generic view and base-view Java files are direct files under
  `src/view/views/`.
- A contribution root under `tabs`, `topbar`, or `state` owns exactly one
  shell-registered contribution.
- A detail root owns ViewModel and view content only, not a shell-registered
  contribution.
- A `*ViewModel` file owns presentation state for its contribution.
- A `*View` file owns exactly one passive panel, dropdown, state, or detail
  fragment.
- Contributions may depend on shell public contracts, own ViewModels, own
  Views, JavaFX `Node`, and domain application-service boundaries.
- ViewModels may depend on JavaFX beans/collections and domain
  application-service boundaries, but not shell, views, data, or concrete
  shell host types.
- Passive views may depend on JavaFX UI APIs and narrow listener/emitter
  contracts but must not depend on shell, domain, data, or ApplicationService
  types.
- Existing `src/view/<component>/`, `*ViewContribution.java`, `View/`,
  `ViewModel/`, `assembly/`, non-shared view `api/`, `Model/`, `Controller/`,
  and `interactor/` structures are migration debt, not target topology.
- The root `*ApplicationService` is the only public client-facing backend
  boundary below the view layer.
- Domain `published/` is carrier-only and must not define callable service,
  facade, repository, port, factory, locator, or gateway contracts.
- `application/` hosts application services and use-case orchestration. It is
  not the default home for behavior that belongs on an aggregate, entity, or
  value object.
- `published/` and `application/` are the only standard technical buckets
  directly under a domain context root.
- Additional directories under `src/domain/<feature>/` must be named domain
  modules in the ubiquitous language of that bounded context.
- Named domain modules must contain Java files only under allowed role
  subpackages: `aggregate/`, `entity/`, `value/`, `policy/`, `repository/`,
  `factory/`, `service/`, `event/`, and `specification/`.
- Legacy domain `api/` buckets, root role buckets, direct Java files under
  named domain modules, and `src/domain/mapcore/**` are forbidden by the
  architecture harness.
- Data implementation classes live under `repository/`, `query/`,
  `gateway/`, `model/`, or `mapper/`.
- `src/data/<feature>/*ServiceContribution.java` is a registration root, not a
  public business boundary.
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
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
