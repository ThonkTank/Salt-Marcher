Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

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
    <component>/
      <PascalComponentName>ViewContribution.java
      assembly/
      api/
      View/
      ViewModel/
  domain/
    <feature>/
      <PascalFeatureName>ApplicationService.java
      api/
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
```

## Public Entrypoints

Every navigable or shell-registered feature exposes exactly one feature
entrypoint:

- `src/view/<component>/<PascalComponentName>ViewContribution.java`
- `public final`
- public no-arg constructor
- implements `shell.api.ShellViewContribution`

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
  [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1).
- the included build at `tools/gradle/build-harness/` owns repository topology,
  package-path alignment, and service-entrypoint presence rules below
  `src/data/`.
- `checkViewArchitecture` owns the canonical MVVM view-structure blocker below
  `src/view/`.
- `pmdArchitectureMain` owns Java source contracts for those roots, including
  naming, `public final`, public no-arg constructors, and required interfaces
  or methods.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.
- The binding shell-workbench standard defines the semantic responsibilities of
  `AppShell`, contribution specs, contribution roots, shell screens, and the
  allowed shell-facing API surface. Current repository and source checks
  enforce entrypoint topology and some shell contracts, not the full workbench
  role model.
- The binding domain-layer standard defines the semantic responsibilities of
  `api/`, `application/`, and named domain modules inside one bounded context.
  Some current repository checks still encode the previous root bucket model
  for `src/domain/**`; that topology is migration debt and is not the
  canonical target structure.
- The binding data-layer standard defines the semantic responsibilities of
  `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and
  `persistencecore/`.
  Current repository checks enforce the topology, not the full behavioural
  role model.
- The intent wording says that each persistence-exporting feature owns exactly
  one schema declaration.
  The current `build-harness` implementation is stricter and effectively
  expects one schema declaration for every current non-`persistencecore` data
  feature.
  Treat that mismatch as migration debt until the checker can distinguish data
  features that intentionally do not export persistence schema truth.
- The binding MVVM standard defines optional `api/` view buckets for public
  cross-component reuse, and `checkViewArchitecture` is expected to enforce
  that topology directly.

## Packaging Rules

- The root of `src/view/<component>/` is reserved for the feature contribution.
- The root of `src/data/<feature>/` is reserved for the service
  contribution.
- Markdown documentation files with the standard co-located names are allowed
  in those roots and do not count as alternate code entrypoints.
- Presentation classes live under `assembly/`, optional `api/`, `View/`, or
  `ViewModel/`.
- `assembly/` is reserved for slice composition, shell adapters, and
  runtime-session composition.
- A shared runtime-session carrier may live in `api/` when it is intentionally
  part of a public cross-component or multi-contribution boundary.
- `api/` is reserved for the only public view-to-view boundary of a component.
- `ViewModel/` is the home for presentation state, actions, and presentation
  policy.
- The root `*ApplicationService` is the only public client-facing backend
  boundary below the view layer.
- `application/` hosts application services and use-case orchestration. It is
  not the default home for behavior that belongs on an aggregate, entity, or
  value object.
- `api/` and `application/` are the only standard technical buckets directly
  under a domain feature root.
- Additional directories under `src/domain/<feature>/` must be named domain
  modules in the ubiquitous language of that bounded context.
- Legacy root role buckets under `src/domain/**` remain possible in the
  current repo only as migration debt; they are not the canonical target
  structure.
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
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/agent-instructions.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/data-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/styling.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvvm.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 005: MVVM And Assembly Boundary In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-view-mvvm-and-assembly-boundary.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
- [ADR 008: Top-Level Repository Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/008-top-level-repository-taxonomy.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/013-domain-layer-ddd-primary-model.md:1)
- [ADR 010: Data-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/010-data-layer-architecture-model.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
