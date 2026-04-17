Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

## Repository Layout

```text
bootstrap/
build-logic/
shell/
src/
  view/
  domain/
  data/
resources/
```

Additional constraints:

- `salt-marcher/` is legacy reference material, not the active implementation
  target.
- `build-logic/` owns reusable Gradle convention plugins and typed custom build
  tasks for the active implementation.
- New top-level feature code must be addable inside `src/`.
- Do not create alternate top-level architecture roots for active feature code.
- Stylesheet files for active code must live directly under `resources/`.

## Feature Layout

```text
src/
  view/
    <component>/
      <PascalComponentName>ViewContribution.java
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

- `build-harness` owns repository topology, package-path alignment, and the
  exactly-one-root presence rules for documented or exporting features.
- `pmdArchitectureMain` owns Java source contracts for those roots, including
  naming, `public final`, public no-arg constructors, and required interfaces
  or methods.
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints.

## Packaging Rules

- The root of `src/view/<component>/` is reserved for the feature contribution.
- The root of `src/data/<feature>/` is reserved for the persistence
  contribution.
- Markdown documentation files with the standard co-located names are allowed
  in those roots and do not count as alternate code entrypoints.
- Presentation classes live under `Model/`, `Controller/`, `View/`, or
  `interactor/`.
- `<feature>API.java` is the only public backend boundary below the view layer.
- Do not introduce `service/` or `services/` as a domain directory.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/styling.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
