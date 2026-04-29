Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
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

This document is a routing summary, not the owner of layer rules.

The canonical seams are:

- local presentation cycle:
  `View -> ViewInputEvent -> IntentHandler -> ContributionModel or ContentModel -> View`
- domain write transport:
  `View -> ViewInputEvent -> IntentHandler -> PublishedEvent -> Binder sink -> ApplicationService`
- readback:
  `ApplicationService or domain published facts -> Binder readback wiring -> ContributionModel or ContentModel -> View bindings or listeners`

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
- `src/view/slotcontent/<slot>/<entry>/` owns reusable generic Views and, when
  the reusable component owns reusable state or interaction behavior, reusable
  `ContentModel` and `IntentHandler` roles
- `src/view/slotcontent/primitives/<entry>/` is the reusable generic home for
  components that are not tied to exactly one cockpit surface family
- contribution-specific View code may extend reusable `slotcontent/**`
  components, and reusable `slotcontent/**` components may extend
  `slotcontent/primitives/**`; the reverse direction is forbidden
- feature-specific one-off components belong in their owning active-root
  package, not under `slotcontent/**`
- `src/domain/<context>/` owns the hexagonal application core: domain truth,
  invariants, policy decisions, application services, published language, and
  outbound ports
- `src/data/<feature>/` owns outer adapters that implement domain-owned
  outbound ports and confront concrete sources such as SQLite, files, imports,
  or remote systems

Feature documentation follows the same ownership model. System-wide canonical
documents live under `docs/project/<type>/`, feature-owned canonical documents
live under `docs/<feature>/<type>/`, and redirect-only legacy copies must be
removed once the owning document exists.

## Dependency Direction

Dependencies point inward toward the application core:

- bootstrap depends on shell contracts
- shell owns generic cockpit hosting and must not import feature code
- view contributions reach shell public contracts and their own Binder
- Binders reach shell public contracts, same-root `ContributionModels`,
  optional same-root `IntentHandlers`, same-root feature Views, reusable
  `slotcontent`, root domain application-service boundaries, and explicit
  domain `published/**` carriers
- `ContributionModels` and reusable `ContentModels` own projection state and
  derive observable UI state from read-side `published/**` facts and local UI
  state
- optional `IntentHandlers` own component-local input interpretation and may
  reach domain writes only through Binder-injected `Consumer<PublishedEvent>`
  sink seams
- missing `IntentHandler` or missing `ContentModel` does not widen View
  responsibilities; passive/stateless units stay passive rather than absorbing
  interpretation or projection duties
- passive Views react to observable model state and emit full immutable
  per-View technical snapshots without shell, domain, data, or
  ApplicationService dependencies
- domain code owns business rules, published language, and domain-owned
  outbound ports
- data code implements domain-owned outbound ports and externalizes source and
  infrastructure details

Below the view layer, the only public client-facing backend boundary is a
feature's `*ApplicationService`.

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

The view layer target follows SaltMarcher's cockpit view-layer model:
contributions own shell registration, Binders own one-time runtime wiring,
`ContributionModels` and reusable `ContentModels` own observable projection state, optional
`IntentHandlers` own input interpretation, and Views own passive JavaFX
content. Detailed rules live only in the dedicated
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

## Canonical Layer Owners

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)

## Mechanical Enforcement Owners

- `docs/project/architecture/enforcement/` owns the matching mechanical
  enforcement truth for layer and role invariants
- `patterns/` defines the architectural intent; `enforcement/` defines which
  of those invariants are currently mechanical, candidate, or review-owned
- verification operation and Gradle gate entrypoints live under
  `docs/project/verification/`, not as separate architecture harness documents

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
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Aggregate Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-aggregate-enforcement.md:1)
- [Domain Entity Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-entity-enforcement.md:1)
- [Domain Value Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-value-enforcement.md:1)
- [Domain Policy Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-policy-enforcement.md:1)
- [Domain Factory Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-factory-enforcement.md:1)
- [Domain Service Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-service-enforcement.md:1)
- [Domain Event Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-event-enforcement.md:1)
- [Domain Specification Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-specification-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
