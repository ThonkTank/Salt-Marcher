Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Shell bootstrap responsibilities, discovery contracts,
instantiation rules, registration order, and startup resolution for passive
shell contributions.

# Shell Discovery And Bootstrap Standard

## Goal

Bootstrap must discover and register shell-facing features generically without
becoming a feature registry.

This document defines bootstrap mechanics only. The binding shell role model,
fixed surface contract, lifecycle vocabulary, and forbidden shell-composition
patterns live in the dedicated
[Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1).

## Bootstrap Responsibilities

`AppBootstrap` is responsible for:

- discovering exported service contributions
- building the shared shell service registry
- constructing `AppShell` with that registry
- discovering shell view contributions
- resolving each contribution into registration metadata plus `ShellScreen`
- registering each resolved contribution into the shell by contribution-spec
  type
- selecting the startup tab and navigating to it

Bootstrap must stay generic. Routine feature addition must not require manual
feature registries, explicit bootstrap imports, or per-feature shell wiring.

## Discovery Contracts

Bootstrap discovers feature and service contributions generically.

### Feature Discovery

- scans `src/view/<component>/` root classes
- expects exactly one root contribution class named
  `<PascalComponentName>ViewContribution`
- expects that class to implement `ShellViewContribution`
- expects a public no-arg constructor
- instantiates discovered contributions reflectively and generically

### Service Discovery

- scans `src/data/<feature>/` root classes
- expects exactly one root service contribution class named
  `<PascalFeatureName>ServiceContribution`
- expects that class to implement `ServiceContribution`
- expects a public no-arg constructor
- registers exported capabilities into the shared shell service registry

## Instantiation Rules

Instantiation is shell-owned and generic:

- discovery loads contribution classes through the application classloader
- interfaces and abstract classes are ignored as non-instantiable roots
- missing or non-public no-arg constructors are bootstrap errors
- unsupported contribution-spec types are bootstrap errors

The shell workbench model allows future lazy `ShellScreen` realization, but
current bootstrap behavior eagerly resolves each discovered
`ShellViewContribution` into:

- `registrationSpec()`
- `createScreen(runtimeContext)`

That eagerness is current behavior, not the long-term contract.

## Registration Order

Bootstrap registers contributions after resolution.

Current registration behavior:

- service contributions are discovered first and populate
  the shell service registry
- the shell is constructed with that registry
- view contributions are discovered next
- resolved view contributions are sorted by contribution key value before
  registration
- each contribution is registered by spec type:
  - `ShellTabSpec`
  - `ShellTopBarSpec`
  - `ShellRuntimeStateSpec`

The key sort is a deterministic registration-order rule. It is not a user-
visible navigation-order contract.

## Startup Resolution

Startup landing is resolved only from `ShellTabSpec` contributions.

Rules:

- exactly one tab may declare `defaultLanding=true`
- multiple default-landing tabs are bootstrap errors
- if no tab declares `defaultLanding=true`, startup falls back to the first tab
  in sorted navigation order:
  - navigation group order
  - navigation group label
  - tab `viewOrder`
  - contribution key

## Responsibilities Excluded From This Document

This standard does not redefine:

- shell workbench role ownership
- fixed slot semantics
- lifecycle meaning of shell activation hooks
- the allowed feature-facing shell API surface
- forbidden shell-composition patterns beyond bootstrap mechanics

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
Concrete rule IDs and checker names are recorded in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

- `build-harness`, `jQAssistant`, and `pmdArchitectureMain` enforce view
  contribution and service contribution root placement, naming, required
  methods, constructor contracts, stateless root shape, and minimal public root
  surfaces used by generic discovery.
- `pmdArchitectureMain` enforces supported contribution-spec selection and
  keeps `defaultLanding` limited to tab contributions.
- `build-harness` enforces literal `ShellTabSpec.defaultLanding` values and
  the single-default-landing startup rule.
- `pmdArchitectureMain` and `architectureTest` enforce generic bootstrap and
  shell wiring: bootstrap and shell must not name concrete feature packages,
  bootstrap may depend on `shell.host.AppShell`, and feature code must stay on
  `shell.api/**`.
- registration order, startup fallback ordering, classloader/reflection
  mechanics, ignored abstract or interface roots, and eager current realization
  remain code-defined behavior reviewed against this document.
- no new gate is introduced; enforcement ownership stays in the existing
  `compileJava`, `pmdArchitectureMain`, `architectureTest`,
  `checkViewArchitecture`, and `:build-harness:check` entrypoints.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
