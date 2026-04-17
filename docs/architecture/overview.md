Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: System-wide architecture summary and entry point into the
architecture documentation set.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes registration contracts and fixed target
areas. Features provide UI contributions and backend capabilities through those
contracts instead of through feature-specific wiring in bootstrap.

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive host shell and slot contracts
src/view/    presentation code by component
src/domain/  domain logic by feature
src/data/    infrastructure adapters by feature
resources/   static resources
```

## System Model

- `bootstrap/` creates the shell and discovers feature and persistence
  contributions generically.
- `shell/` owns passive runtime surfaces such as navigation, slots, and
  inspector history.
- `src/view/<component>/` owns presentation behavior and user interaction.
- `src/domain/<feature>/` owns business meaning, invariants, and feature APIs.
- `src/data/<feature>/` owns persistence and external-system adapters.

## Dependency Direction

Dependencies point inward:

- bootstrap depends on shell contracts.
- view code reaches backend content through a feature interactor and feature
  API.
- domain code defines business rules and repository contracts.
- data code implements domain-owned contracts.

The shell must remain passive. It may define slots and registration contracts,
but it must not own feature logic.

## Registration Model

The application registers feature UI through shell contributions and exported
persistence through persistence contributions.

- `ShellViewContribution` provides `ShellContributionSpec` and `ShellScreen`.
- `PersistenceContribution` registers typed persistence capabilities into the
  shared registry.
- Bootstrap discovers both generically. Adding a feature should not require
  routine shell or bootstrap edits.

## Documentation Map

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/001-documentation-governance.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
