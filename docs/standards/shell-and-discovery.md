Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Shell bootstrap responsibilities, discovery contracts,
instantiation rules, registration order, and startup resolution for passive
shell contributions.

# Shell Discovery And Bootstrap Standard

## Goal

Bootstrap must discover and register shell-facing UI contributions and backend
service contributions generically without becoming a feature registry.

This document defines bootstrap mechanics only. The shell role model, fixed
cockpit surfaces, lifecycle vocabulary, and forbidden shell-composition
patterns live in the dedicated
[Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1).

## Bootstrap Responsibilities

`AppBootstrap` is responsible for:

- discovering exported service contributions
- building the shared shell service registry
- constructing `AppShell` with that registry
- discovering shell-facing UI contributions
- resolving each discovered contribution into passive registration metadata
  plus surface bindings
- registering each resolved contribution into the shell by contribution kind
- selecting the startup tab and navigating to it

Bootstrap must stay generic. Routine feature addition must not require manual
feature registries, explicit bootstrap imports, or per-feature shell wiring.

## Discovery Contracts

Bootstrap discovers backend service contributions and UI contributions
generically.

### UI Contribution Discovery

Target discovery:

- scans `src/view/leftbartabs/<entry>/`, `src/view/statetabs/<entry>/`, and
  `src/view/dropdowns/<entry>/`
- considers only direct concrete classes named `*Contribution`
- expects each contribution to implement `shell.api.ShellContribution`
- expects a public no-arg constructor unless a future registration contract
  explicitly defines another generic construction shape
- instantiates discovered contributions reflectively and generically

Contribution roots mean:

- `src/view/leftbartabs/<entry>/`: one left-bar-tab contribution
- `src/view/statetabs/<entry>/`: one global state tab
  contribution
- `src/view/dropdowns/<entry>/`: zero or one shell-discovered dropdown
  contribution

`src/view/slotcontent/**` is not a bootstrap discovery root. Detail content is
published through the shell-owned details/history API from the owning binder
instead of being discovered as an independent startup root.

### Service Discovery

- scans `src/data/<feature>/` root classes
- expects exactly one root service contribution class whose name ends with
  `ServiceContribution`
- relies on source-layout gates to enforce the canonical
  `<Context Name>ServiceContribution` file name for contexts whose directory
  token is not a simple PascalCase spelling
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
- UI contributions are discovered next
- resolved UI contributions are sorted by contribution key before registration
- each contribution is registered by contribution kind:
  - left-bar tab
  - global state tab
  - top-bar dropdown window

The key sort is a deterministic registration-order rule. It is not a user-
visible navigation-order contract.

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

State tabs and top-bar dropdown windows are never startup
landing targets. Encounter is a state tab, so it must not
participate in startup navigation selection.

## Responsibilities Excluded From This Document

This standard does not redefine:

- shell workbench role ownership
- fixed cockpit surface semantics
- state-pane precedence
- lifecycle meaning of shell activation hooks
- the allowed feature-facing shell API surface
- MVVM contribution, ViewModel, View, and Model placement rules
- forbidden shell-composition patterns beyond bootstrap mechanics

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
Concrete rule IDs and checker names are recorded in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current checks enforce the target discovery shape where it has a stable static
surface:

- UI contribution discovery from `src/view/leftbartabs`, `src/view/statetabs`,
  and shell-contributed `src/view/dropdowns`
- one shell-registered `*Contribution` per left-bar/state tab root and zero
  or one per dropdown root
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
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
