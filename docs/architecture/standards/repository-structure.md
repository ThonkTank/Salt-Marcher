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
      Model/
      Controller/
      View/
      interactor/
  domain/
    <feature>/
      <feature>API.java
      entity/
      valueobject/
      usecase/
      repository/
  data/
    <feature>/
      <PascalFeatureName>PersistenceContribution.java
      repository/
      datasource/
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
- implements `shell.host.ShellViewContribution`

Every persistence-exporting feature exposes exactly one persistence entrypoint:

- `src/data/<feature>/<PascalFeatureName>PersistenceContribution.java`
- `public final`
- public no-arg constructor
- implements `shell.host.PersistenceContribution`

Each persistence-exporting feature also exposes exactly one schema declaration:

- `src/data/<feature>/model/<PascalFeatureName>PersistenceSchema.java`

Documentation files are allowed in feature roots when they use the standard
co-located filenames such as `README.md`, `SPEC.md`, `DOMAIN.md`, `UI.md`,
`PERSISTENCE.md`, and `DELIVERY.md`.

## Enforcement Notes

- the included build at `tools/gradle/build-harness/` owns repository topology,
  package-path alignment, and persistence-entrypoint presence rules below
  `src/data/`.
- `checkMvci` owns allowed view buckets and the exactly-one root entrypoint
  rule below `src/view/`.
- `pmdArchitectureMain` owns Java source contracts for those roots, including
  naming, `public final`, public no-arg constructors, and required interfaces
  or methods.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.
- The binding view MVCI standard now also defines optional `api/` view buckets
  for public cross-component reuse. That stricter topology is source of truth
  even where current `checkMvci` rules still lag behind it.

## Packaging Rules

- The root of `src/view/<component>/` is reserved for the feature contribution.
- The root of `src/data/<feature>/` is reserved for the persistence
  contribution.
- Markdown documentation files with the standard co-located names are allowed
  in those roots and do not count as alternate code entrypoints.
- Presentation classes live under `assembly/`, optional `api/`, `Model/`,
  `Controller/`, `View/`, or `interactor/`.
- `assembly/` is reserved for slice composition, shell adapters, and
  runtime-session assembly.
- `api/` is reserved for the only public view-to-view boundary of a component.
- `interactor/` is not a bucket for JavaFX widget construction or shell-facing
  assembly.
- `<feature>API.java` is the only public backend boundary below the view layer.
- Do not introduce `service/` or `services/` as a domain directory.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/agent-instructions.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/styling.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [View MVCI Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvci.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 005: Strict MVCI Roles In The View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/005-strict-view-mvci-and-assembly-bucket.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
- [ADR 008: Top-Level Repository Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/008-top-level-repository-taxonomy.md:1)
