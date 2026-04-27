# ADR 008: Top-Level Repository Taxonomy

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher's repository root had started to mix runtime application roots,
included Gradle builds, quality-platform configuration, engineering scripts,
and deprecated documentation entrypoints in one flat surface. That made the
root harder to scan and blurred the difference between active application code,
supporting engineering infrastructure, and compatibility leftovers.

The active application still benefits from keeping its runtime-oriented roots
visible at the repository top level. At the same time, supporting engineering
assets need stronger grouping so they can grow without competing with product
code for root-level attention.

## Decision

SaltMarcher uses three distinct top-level categories:

- runtime application roots stay visible at repository root:
  `bootstrap/`, `shell/`, `src/`, `resources/`, `docs/`, `.github/`, and the
  Gradle entry files
- engineering infrastructure is grouped under `tools/`
- deprecated document entrypoints live under `docs/compat/`

Within `tools/`:

- `tools/gradle/` owns included builds such as `build-logic/` and
  `build-harness/`
- `tools/quality/` owns quality-platform configuration, custom rules,
  incubating quality projects, and engineering helper scripts

This taxonomy reorganizes repository structure only. It does not introduce new
active architecture roots for feature code, which must still live under `src/`.

## Consequences

- The root directory stays focused on application runtime structure and primary
  repository entrypoints.
- Growth in verification tooling, rule projects, and helper scripts is directed
  into `tools/` instead of adding more root clutter.
- Deprecated central documentation can remain available for compatibility
  without competing with current architecture documents under `docs/`.
- Build wiring and standards documentation must use the grouped `tools/...`
  paths as the new source of truth.

## Alternatives Considered

### Keep adding new roots at repository top level

Rejected because root discoverability would continue to degrade as technical
subsystems grow.

### Move all active application roots under a new umbrella such as `app/`

Rejected because it would create unnecessary churn in the active runtime code
layout and weaken the immediate visibility of SaltMarcher's application
structure.

### Leave compatibility documents mixed into `docs/`

Rejected because deprecated entrypoints would continue to compete visually with
active architecture sources.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
