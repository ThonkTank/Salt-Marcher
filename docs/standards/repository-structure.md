Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

The active view target is organized by SaltMarcher's cockpit slotcontent
model: shell-discovered left-bar tabs under `src/view/leftbartabs`, state
tabs under `src/view/statetabs`, dropdown-capable roots under
`src/view/dropdowns`, and reusable single-slot content under
`src/view/slotcontent`.

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
    leftbartabs/
      <entry>/
        <PascalEntry>Contribution.java
        <PascalEntry>Binder.java
        <PascalEntry>ViewModel.java
        <PascalEntry>ControlsView.java  optional root-local wrapper
        <PascalEntry>MainView.java      optional root-local wrapper
        <PascalEntry>StateView.java     optional root-local wrapper
    statetabs/
      <entry>/
        <PascalEntry>Contribution.java
        <PascalEntry>Binder.java
        <PascalEntry>ViewModel.java
        <PascalEntry>StateView.java
    dropdowns/
      <entry>/
        <PascalEntry>Contribution.java  optional shell-discovered adapter
        <PascalEntry>Binder.java
        <PascalEntry>ViewModel.java
        <PascalEntry>TopBarView.java    optional root-local dropdown view
    slotcontent/
      <slot>/
        <entry>/
          <PascalEntry>View.java
          <PascalEntry>ViewModel.java
          <PascalEntry>DisplayModel.java
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
        port/
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

- `src/view/leftbartabs/<entry>/<PascalEntry>Contribution.java` for one
  left-bar tab
- `src/view/statetabs/<entry>/<PascalEntry>Contribution.java` for one global
  state tab
- `src/view/dropdowns/<entry>/<PascalEntry>Contribution.java` for one
  shell-discovered dropdown; dropdown roots may omit this file when another
  binder invokes them

A contribution class is `public final`, has a public no-arg constructor,
implements `shell.api.ShellContribution`, and defines exactly one shell
contribution.

Every active root owns exactly one `*Binder.java` file. The binder owns
runtime service lookup, View/ViewModel construction, emitter wiring, slot
binding, details publication, and lifecycle hooks.

Every active-root ViewModel is represented by one `*ViewModel.java` file in
the same root. It owns aggregate presentation state and user-intent handling,
not shell discovery or view instantiation.

Reusable or standalone single-slot content lives under
`src/view/slotcontent/<slot>/<entry>/`. Slotcontent Views are passive JavaFX
content; slotcontent ViewModels are optional projection models and must not
call application services.

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
  `build-harness` view checks enforce active-root placement, Binder ownership,
  slotcontent placement, dependency direction, and FXML resource placement for
  active target view code.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.
- The shell-workbench standard defines the semantic responsibilities of
  `AppShell`, registration contracts, cockpit surfaces, state-pane precedence,
  and allowed shell-facing API surface.
- The domain-layer standard defines the semantic responsibilities of
  `published/`, `application/`, domain-concept modules, outbound ports, and
  optional tactical role packages inside one real domain context.
- The data-layer standard defines the semantic responsibilities of runtime
  composition adapters, port adapters, source adapters, source-local models,
  optional mappers, and shared persistence infrastructure.

## Packaging Rules

- Active target view code lives under `src/view/leftbartabs`,
  `src/view/statetabs`, `src/view/dropdowns`, or `src/view/slotcontent`.
- Active-root Java files are direct files under `src/view/<area>/<entry>/`.
- Slotcontent Java files are direct files under
  `src/view/slotcontent/<slot>/<entry>/`.
- A root under `leftbartabs` or `statetabs` owns exactly one
  shell-registered contribution.
- A root under `dropdowns` owns zero or one shell-registered contribution.
- Every active root owns exactly one `*Binder` and one aggregate `*ViewModel`.
- A `*ViewModel` file owns presentation state for its active root or
  slotcontent unit.
- A `*View` file owns exactly one passive panel, dropdown, state, or detail
  fragment.
- Contributions may depend on shell public contracts and their own Binder.
- Binders may depend on shell public contracts, own ViewModels, own Views,
  slotcontent Views/ViewModels, JavaFX `Node`, and domain application-service
  boundaries.
- Active-root ViewModels may depend on JavaFX beans/collections and domain
  application-service boundaries, but not shell, views, data, or concrete
  shell host types. Slotcontent ViewModels may depend on domain `published`
  carriers but not application services.
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
- Named domain modules must contain Java files only under allowed tactical role
  subpackages: `aggregate/`, `entity/`, `value/`, `policy/`, `port/`,
  `factory/`, `service/`, `event/`, and `specification/`. A module uses only
  the roles it needs; the allowlist is not a required concept inventory.
- Legacy domain `api/` buckets, root role buckets, direct Java files under
  named domain modules, and `src/domain/mapcore/**` are forbidden by the
  architecture harness.
- Data implementation classes live under `repository/`, `query/`,
  `gateway/`, `model/`, or `mapper/` according to the current physical
  adapter layout.
- `src/data/<feature>/*ServiceContribution.java` is a runtime composition
  adapter that registers the root domain application service; it is not a
  public business boundary and not persistence logic.
- `repository/` is reserved for write-model port adapters.
- `query/` is reserved for read-only port adapters.
- `gateway/local/` and `gateway/remote/` are internal concrete source adapters,
  not public capability roots.
- `model/` is reserved for source-local schema declarations and carrier types.
- `mapper/` is reserved for non-trivial translation between source-local shapes
  and domain-facing or boundary-facing types.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/agent-instructions.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [ADR 024: Domain And Data Concept Simplification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/024-domain-data-concept-simplification.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/styling.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
