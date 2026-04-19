Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shell bootstrap responsibilities, discovery contracts,
instantiation rules, registration order, and startup resolution for passive
shell contributions.

# Shell Discovery And Bootstrap Standard

## Goal

Bootstrap must discover and register shell-facing view contributions and
backend service contributions generically without becoming a feature registry.

This document defines bootstrap mechanics only. The binding shell role model,
fixed cockpit surfaces, lifecycle vocabulary, and forbidden shell-composition
patterns live in the dedicated
[Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1).

## Bootstrap Responsibilities

`AppBootstrap` is responsible for:

- discovering exported service contributions
- building the shared shell service registry
- constructing `AppShell` with that registry
- discovering shell-facing left-tab, top-bar, and runtime-state contributions
- resolving each discovered contribution into passive registration metadata
  plus surface bindings
- registering each resolved contribution into the shell by contribution kind
- selecting the startup tab and navigating to it

Bootstrap must stay generic. Routine feature addition must not require manual
feature registries, explicit bootstrap imports, or per-feature shell wiring.

## Discovery Contracts

Bootstrap discovers backend service contributions and view contributions
generically.

### View Contribution Discovery

Target discovery:

- scans `src/view/tabs/*`, `src/view/topbar/*`, and `src/view/state/*`
- expects each contribution segment to expose exactly one concrete
  `*Contribution` root class
- expects discovered roots to implement `shell.api.ShellContribution`
- expects a public no-arg constructor unless a future generic registration
  contract explicitly defines another construction shape
- instantiates discovered contributions reflectively and generically
- does not scan `src/view/details/*`

Detail entries are not startup contributions. They are published through the
shell-owned details/history API.

Old `src/view/<component>/<Component>ViewContribution` roots and
`ShellViewContribution` names are migration debt.

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
- missing or non-public generic constructors are bootstrap errors
- unsupported contribution kinds are bootstrap errors

The shell workbench model allows future lazy realization. Current bootstrap
behavior may eagerly resolve discovered contribution roots into registration
metadata and prepared screen content. That eagerness is current behavior, not
the long-term contract.

## Registration Order

Bootstrap registers contributions after resolution.

Target registration behavior:

- service contributions are discovered first and populate the shell service
  registry
- the shell is constructed with that registry
- view contributions are discovered next
- resolved view contributions are sorted by contribution key before
  registration
- each contribution is registered by contribution kind:
  - left-bar tab
  - state-pane tab
  - top-bar dropdown window

The key sort is a deterministic registration-order rule. It is not a
user-visible navigation-order contract.

## Startup Resolution

Startup landing is resolved only from left-bar tab contributions.

Rules:

- exactly one tab contribution may declare `defaultLanding=true`
- multiple default-landing tab contributions are bootstrap errors
- if no tab declares `defaultLanding=true`, startup falls back to the first tab
  in sorted navigation order:
  - navigation group order
  - navigation group label
  - tab view order
  - contribution key

State-pane tabs and top-bar dropdown windows are never startup landing targets.

## Verification Notes

Current checks enforce the target discovery shape where it has a stable static
surface:

- contribution discovery from `src/view/tabs/*`, `src/view/topbar/*`, and
  `src/view/state/*`
- one shell-registered `*Contribution` per contribution segment
- generic contribution instantiation
- supported contribution-kind selection
- single startup default among left-bar tab contributions
- generic bootstrap and shell wiring with no concrete feature imports

Runtime discovery ordering and reflection error wording remain review-owned
unless they become stable build-time policy surfaces.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
