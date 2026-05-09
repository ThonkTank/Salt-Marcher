Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: System-wide routing summary and entry point into the canonical
layer-owner standards under `docs/project/architecture/patterns/` and their
matching mechanical enforcement documents under
`docs/project/architecture/enforcement/`.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes fixed cockpit surfaces, registration
contracts, and shell-owned runtime services. View-layer contributions register
UI entrypoints, and root-local Binders perform one-time composition and
wiring without feature-specific bootstrap or shell-host logic.

This document is a routing summary, not the owner of layer rules. View-layer
roles, seams, reusable `slotcontent/**` rules, and presentation-state cycles
are owned only by the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive cockpit host and shell contracts
src/view/    cockpit contributions, Binders, ContributionModels, optional IntentHandlers,
             feature-specific colocated Views, and reusable slotcontent
src/domain/  hexagonal application core by context
src/data/    outbound adapters by feature
resources/   static resources and centralized stylesheets
docs/        canonical project and feature documentation, compatibility stubs, and references
tools/       build infrastructure, quality platforms, and engineering scripts
```

## System Model

- `bootstrap/` creates the shell and discovers service contributions and UI
  contributions generically
- `shell/` owns passive cockpit surfaces: top-left controls, primary main
  panel, top-right details/history, bottom-right state pane, top-bar dropdown
  windows, navigation, activation, and shared runtime-session state
- `src/view/leftbartabs/<entry>/` owns one left-bar tab contribution, its
  Binder, aggregate `ContributionModel`, optional
  `IntentHandler`, and feature-specific colocated Views
- `src/view/statetabs/<entry>/` owns one global state-tab contribution, its
  Binder, aggregate `ContributionModel`, optional
  `IntentHandler`, and feature-specific colocated Views
- `src/view/dropdowns/<entry>/` owns one shell-hung dropdown-window
  contribution, its Binder, aggregate `ContributionModel`, optional
  `IntentHandler`, and feature-specific colocated Views
- `src/view/slotcontent/**` owns reusable generic UI units; the internal role
  shape and all reusable-view rules are owned only by the
  [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- `src/domain/<context>/` owns the application core: domain truth, internal
  models, family-scoped application services, published language, repositories,
  and ports; detailed role and seam rules are owned only by the
  [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- `src/data/<feature>/` owns outer adapters that satisfy domain-owned
  repository abstractions and confront concrete sources such as SQLite, files,
  imports, or remote systems

Feature documentation follows the same ownership model. System-wide canonical
documents live under `docs/project/<type>/`, feature-owned canonical documents
live under `docs/<feature>/<type>/`, and redirect-only legacy copies must be
removed once the owning document exists.

## Dependency Direction

Dependencies point inward toward the application core:

- bootstrap depends on shell contracts
- shell owns generic cockpit hosting and must not import feature code
- view contributions reach shell public contracts and the documented domain
  public boundaries; the internal View/Binder/Model/IntentHandler contract is
  owned only by the
  [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- domain code owns business rules, internal models, published language,
  repositories, and ports
- data code satisfies domain-owned repository abstractions and externalizes
  source and infrastructure details

Below the view layer, the public backend boundary is a context's one-or-more
family `*ApplicationService` roots.

## Registration Model

The application registers feature UI through UI contributions and exported
runtime capabilities through service contributions.

- shell public contracts provide registration metadata, fixed surface binding,
  lifecycle hooks, details/history publication, and runtime context
- `src/view/leftbartabs/**` contributes left-bar tabs
- `src/view/statetabs/**` contributes global state tabs
- `src/view/dropdowns/**` contributes top-bar dropdown windows through exactly
  one `*Contribution` per active root
- `shell/api/ServiceContribution` lets outer composition adapters register
  typed root application services into the shared shell service registry
- `shell/api/ShellRuntimeContext` provides shell-owned shared services such as
  runtime-capability lookup, details/history publishing, and per-shell runtime
  sessions

The view layer follows SaltMarcher's cockpit view-layer model. Detailed rules
live only in the dedicated
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

## Canonical Architecture Owners

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)

## Mechanical Enforcement Owners

- `docs/project/architecture/enforcement/` owns the matching mechanical
  enforcement truth for layer and role invariants
- `shell-layer-enforcement.md` owns shell-wide topology, fixed public shell
  surface, and shell-wide dependency-cleanliness claims
- `shell-app-shell-enforcement.md` owns the passive shell host role contract
- `shell-runtime-context-enforcement.md` owns the shell-scoped runtime gateway
  contract
- `patterns/` defines the architectural intent; `enforcement/` defines which
  of those invariants are currently mechanical, candidate, or review-owned
- for domain roles, `domain-layer.md` owns the architecture and the split
  `domain-*.md` enforcement files own only role-local gate inventory and
  current mechanical drift
- the styling package is split between layer-wide centralized styling ownership
  and passive-`View` direct-render styling ownership
- verification operation and Gradle gate entrypoints live under
  `docs/project/verification/`, not as separate architecture harness documents
- `verification-core.md` owns the four-layer verification split and the public
  verification-surface ownership model for runtime wrappers, Gradle lifecycle
  surfaces, focused bundles, and private rule engines

## Documentation Map

- `AGENTS.md` for project-wide rules and documentation governance
- `docs/project/architecture/` for canonical project-wide architecture
  guidance, with owner standards under `patterns/` and mechanical owner docs
  under `enforcement/`
- `docs/<feature>/` for canonical feature documentation grouped by type

## References

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
- [View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Domain Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-model-enforcement.md:1)
- [Domain Helper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
- [Domain Constants Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-constants-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-repository-enforcement.md:1)
- [Data Query Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-query-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Data Mapper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-mapper-enforcement.md:1)
- [Data Persistencecore Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
