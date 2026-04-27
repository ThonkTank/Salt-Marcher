Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: System-wide architecture summary and entry point into the
architecture documentation set.

# Architecture Overview

## Purpose

SaltMarcher is structured as a passive-shell JavaFX application with feature
slices under `src/`. The shell exposes fixed cockpit surfaces, registration
contracts, and shell-owned runtime services. View-layer contributions register
UI entrypoints, and root-local Binders perform one-time composition and
wiring without feature-specific bootstrap or shell-host logic.

The canonical seams are:

- input: `View -> Binder-installed listener -> IntentHandler -> Binder-installed callback -> ApplicationService`
- readback: `ApplicationService -> published/** -> PresentationModel -> View bindings/listeners`

## Repository Shape

```text
bootstrap/   application startup and generic discovery
shell/       passive cockpit host and shell contracts
src/view/    cockpit contributions, Binders, PresentationModels, optional IntentHandlers,
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
- `src/view/leftbartabs/<entry>/` owns one left-bar tab, its shell
  contribution, Binder, aggregate `PresentationModel`, optional
  `IntentHandler`, and feature-specific colocated Views
- `src/view/statetabs/<entry>/` owns one global state tab, its shell
  contribution, Binder, aggregate `PresentationModel`, optional
  `IntentHandler`, and feature-specific colocated Views
- `src/view/dropdowns/<entry>/` owns one dropdown-capable UI unit; its shell
  contribution is optional and exists only when bootstrap should discover it
- `src/view/slotcontent/<slot>/<entry>/` owns reusable generic Views and, when
  the reusable component owns reusable state or interaction behavior, reusable
  `PresentationModel` and `IntentHandler` roles
- `src/view/slotcontent/primitives/<entry>/` is the reusable generic home for
  components that are not tied to exactly one cockpit surface family
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
live under `docs/<feature>/<type>/`, compatibility stubs live in `docs/compat/`,
and code-local markdown may remain only as routing stubs.

## Dependency Direction

Dependencies point inward toward the application core:

- bootstrap depends on shell contracts
- shell owns generic cockpit hosting and must not import feature code
- view contributions reach shell public contracts and their own Binder
- Binders reach shell public contracts, same-root `PresentationModels`,
  optional same-root `IntentHandlers`, same-root feature Views, reusable
  `slotcontent`, root domain application-service boundaries, and explicit
  domain `published/**` carriers
- `PresentationModels` own aggregate or reusable projection state and derive
  observable UI state from read-side `published/**` facts and local UI state
- optional `IntentHandlers` own component-local input interpretation and do
  not call domain boundaries directly without a Binder-installed callback seam
- passive Views react to observable `PresentationModel` state and emit
  technical user gestures without shell, domain, data, or ApplicationService
  dependencies
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
- `src/view/dropdowns/**` may contribute top-bar dropdown windows when a
  `*Contribution` is present
- `shell/api/ServiceContribution` lets outer composition adapters register
  typed root application services into the shared shell service registry
- `shell/api/ShellRuntimeContext` provides shell-owned shared services such as
  runtime-capability lookup, details/history publishing, and per-shell runtime
  sessions

The view layer target follows SaltMarcher's cockpit view-layer model:
contributions own shell registration, Binders own one-time runtime wiring,
`PresentationModels` own observable projection state, optional
`IntentHandlers` own input interpretation, and Views own passive JavaFX
content. Detailed rules live only in the dedicated
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1).

## Documentation Map

- `AGENTS.md` for project-wide rules and documentation governance
- `docs/project/architecture/` for canonical project-wide architecture
  guidance, standards, and ADRs
- `docs/<feature>/` for canonical feature documentation grouped by type
- `docs/compat/` for deprecated compatibility stubs that point at canonical
  documents elsewhere
- `docs/adr/`, `docs/architecture/`, `docs/standards/`, and `docs/features/`
  for legacy compatibility stubs during migration only

## References

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/system-layer-architecture.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-workbench.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [ADR 027: PresentationModel And IntentHandler View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-027-presentationmodel-intenthandler-view-layer.md:1)
