Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shell bootstrap responsibilities, discovery contracts,
instantiation rules, registration order, and startup resolution for passive
shell contributions.

# Shell Discovery And Bootstrap Standard

## Goal

Bootstrap must discover and register shell-facing view models and backend
service contributions generically without becoming a feature registry.

This document defines bootstrap mechanics only. The binding shell role model,
fixed cockpit surfaces, lifecycle vocabulary, and forbidden shell-composition
patterns live in the dedicated
[Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1).

## Bootstrap Responsibilities

`AppBootstrap` is responsible for:

- discovering exported service contributions
- building the shared shell service registry
- constructing `AppShell` with that registry
- discovering shell-facing tab models, state-tab models, and top-bar dropdown
  window models
- resolving each discovered model into passive registration metadata plus
  surface bindings
- registering each resolved model into the shell by contribution kind
- selecting the startup tab and navigating to it

Bootstrap must stay generic. Routine feature addition must not require manual
feature registries, explicit bootstrap imports, or per-feature shell wiring.

## Discovery Contracts

Bootstrap discovers backend service contributions and view models generically.

### View Model Discovery

Target discovery:

- scans `src/view/models/`
- expects each concrete model file to define exactly one tab model, state-tab
  model, or top-bar dropdown window model
- expects discovered models to implement the public shell registration
  contract for their contribution kind
- expects a public no-arg constructor unless the future registration contract
  explicitly defines another generic construction shape
- instantiates discovered models reflectively and generically

Current migration state:

- old `src/view/<component>/<Component>ViewContribution` roots implementing
  `ShellViewContribution` are migration debt
- active target code is discovered from `src/view/models` through
  `ShellContributionModel`

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
- view models are discovered next
- resolved view models are sorted by contribution key before registration
- each model is registered by contribution kind:
  - left-bar tab model
  - state-pane tab model
  - top-bar dropdown window model

The key sort is a deterministic registration-order rule. It is not a user-
visible navigation-order contract.

## Startup Resolution

Startup landing is resolved only from left-bar tab models.

Rules:

- exactly one tab model may declare `defaultLanding=true`
- multiple default-landing tab models are bootstrap errors
- if no tab declares `defaultLanding=true`, startup falls back to the first tab
  in sorted navigation order:
  - navigation group order
  - navigation group label
  - tab view order
  - contribution key

State-pane tabs and top-bar dropdown windows are never startup landing targets.

## Responsibilities Excluded From This Document

This standard does not redefine:

- shell workbench role ownership
- fixed cockpit surface semantics
- state-pane precedence
- lifecycle meaning of shell activation hooks
- the allowed feature-facing shell API surface
- forbidden shell-composition patterns beyond bootstrap mechanics

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
Concrete rule IDs and checker names are recorded in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current checks enforce the target model-discovery shape where it has a stable
static surface:

- model discovery from `src/view/models`
- one shell-registered contribution model per model file
- generic model instantiation
- supported contribution-kind selection
- single startup default among left-bar tab models
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
- [ADR 019: Shell Cockpit Tab Model View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
