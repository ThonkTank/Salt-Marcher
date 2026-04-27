Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: Binding system-wide layer architecture model, top-level
dependency direction, boundary crossings, and allowed cross-layer seams.

# System Layer Architecture Standard

## Goal

SaltMarcher uses a system-wide layer architecture so the top-level repository
shape, dependency direction, and cross-layer seams are defined once for the
whole application.

The goal is not to replace the dedicated shell, view, domain, or data
standards. This document defines how those layers interact so changes stay
local, duplicate coordination logic is avoided, and infrastructure details do
not spread into the application core.

## Layer Responsibility Matrix

```text
bootstrap/   outer composition root and generic discovery
shell/       passive cockpit workbench host and shell-owned runtime services
src/view/    inbound interface adapters: contributions, Binders, PresentationModels,
             optional IntentHandlers, passive Views, and reusable slotcontent
src/domain/  application core, business rules, and domain-owned ports
src/data/    outbound adapters and persistence/external-system adaptation
```

Layer responsibilities:

- `bootstrap/`
  - owns generic startup, discovery, registration order, and shell creation
  - is the outer composition root, not a feature or business-logic home
- `shell/`
  - owns passive cockpit surfaces, shell contracts, details/history hosting,
    state-pane precedence, and shell-scoped runtime services
  - stays generic and must not own feature logic
- `src/view/**`
  - is the inbound interface-adapter layer
  - uses `*Contribution` classes for shell registration only
  - uses `*Binder` classes for one-time assembly, listener wiring, shell slot
    binding, and the explicitly allowed domain-facing seams
  - uses `*PresentationModel` classes to expose observable projection state and
    derive what the user should see from read-side `published/**` facts and
    local UI state
  - uses optional `*IntentHandler` classes only for component-local input
    interpretation and `PresentationModel` mutation
  - uses passive `*View` classes for JavaFX controls that react to observable
    `PresentationModel` state and emit technical user events
- `src/domain/**`
  - is the application core
  - owns business meaning, invariants, application services, exported boundary
    types, named domain modules, and domain-owned outbound ports
- `src/data/**`
  - is the outbound adapter layer
  - implements domain-owned ports and translates between domain-facing
    contracts and concrete sources such as SQLite or future remote systems

## Dependency Rule And Boundary Crossings

The binding source-dependency rule is inward-only:

1. `bootstrap -> shell`
2. `Contribution -> shell public contracts + own Binder`
3. `Binder -> shell public contracts + own PresentationModel + optional own
   IntentHandler + same-root feature Views + reusable slotcontent + domain
   public boundaries`
4. `PresentationModel -> domain read-side published carriers + JavaFX
   beans/collections + same-surface local support/value types`
5. `IntentHandler -> co-located PresentationModel + same-surface local
   support/value types`
6. `View -> JavaFX UI APIs + observable PresentationModel surface + reusable
   slotcontent view bases`
7. `data -> domain public boundaries and domain-owned outbound ports`
8. `domain -> no outer layer`

Additional rules:

- runtime control flow may travel in either direction; source-code
  dependencies must still point inward or invert through interfaces defined on
  the inner side of the boundary
- outer-format objects must not leak inward; examples include JavaFX
  scene-graph types inside domain code, shell host classes, gateway records,
  SQL rows, and source-local infrastructure shapes
- outside the explicitly documented Binder/domain and `published/**` readback
  seams, no direct domain/view-layer connections are allowed

The canonical intentional public boundaries are:

- shell-facing contracts under `shell/api/**`
- the shell-owned runtime composition seam under `shell/api/**`, including
  `ShellRuntimeContext`, `ServiceContribution`, and `ServiceRegistry`
- view `*Contribution` roots as shell-facing registration adapters
- view `*Binder` roots as runtime composition adapters
- domain `*ApplicationService` roots as the only callable public
  client-facing backend boundary below the view layer
- `src/domain/<feature>/published/**` as carrier-only published-language types
  used by those application services
- domain-owned outbound ports declared in named domain modules as inner backend
  ports, not alternate client boundaries

## Canonical Interaction Flows

### Bootstrap And Registration

1. `bootstrap/` discovers service contributions and builds the shared shell
   service registry
2. `bootstrap/` creates the shell with that registry
3. `bootstrap/` discovers view contributions, resolves registration metadata,
   and registers shell-facing left-bar tabs, state tabs, and top-bar dropdown
   windows
4. no routine feature addition should require feature-specific bootstrap logic

### User-Initiated Application Flow

1. the shell activates a registered contribution
2. the contribution delegates binding to its co-located Binder
3. the Binder obtains runtime services, instantiates same-root roles and
   reusable slotcontent, wires listeners, bindings, and callbacks, and returns
   a `ShellBinding`
4. a passive View emits a technical user event
5. Binder-installed wiring forwards that event into the optional
   `IntentHandler`
6. the `IntentHandler` mutates only its co-located `PresentationModel`
7. when domain work is required, the `IntentHandler` invokes a Binder-installed
   callback seam
8. that seam reaches a same-feature or foreign public `*ApplicationService`
9. results return as read-side domain published carriers or synchronous result
   records
10. Binder-owned readback wiring delivers those facts into listener-facing
    `PresentationModel` intake seams
11. the `PresentationModel` translates them into observable presentation state
12. passive Views react through bindings or listeners

### Shell-Scoped Runtime Flow

1. a contribution receives `ShellRuntimeContext` from the shell
2. shell-owned services such as details/history publishing, backend capability
   lookup, or typed runtime sessions are adapted by the co-located Binder into
   active-root collaborators
3. backend service lookup is a composition concern used to fetch root
   application services and other runtime collaborators
4. the shell remains passive: it hosts surfaces and scoped services, but it
   does not take over feature behavior

## Allowed Exceptions

- `bootstrap/` may instantiate and register shell/view/data roots because it
  is the composition root
- view contributions may use shell contracts for registration and delegation to
  their Binder
- `src/data/<feature>/*ServiceContribution.java` may use shell service
  registration contracts because it is the current outer composition adapter
  that builds concrete port adapters and registers the root domain application
  service
- inner-layer interfaces may be implemented by outer layers when runtime flow
  needs to cross outward without violating the dependency rule

## Forbidden Patterns

- strict adjacent-layer-only pass-through wrappers whose only purpose is to
  satisfy a stacked-diagram aesthetic instead of a real boundary need
- `src/view/**` reaching directly into `src/data/**`
- passive Views reaching into shell, domain, data, foreign
  `PresentationModel`, or `ApplicationService` types
- `PresentationModels` reaching into shell APIs, concrete view classes,
  binders, or `*ApplicationService` types
- `IntentHandlers` reaching into shell APIs, concrete view classes, data,
  `published/**`, or `*ApplicationService` types
- `src/domain/**` depending on `bootstrap`, `shell`, `src/view`, or `src/data`
- `shell/**` owning feature logic or importing feature implementations as
  extension points
- `bootstrap/**` owning feature-specific business or presentation logic
- source-local data shapes or framework types leaking from `src/data/**` into
  `src/domain/**`
- shell implementation classes leaking below the contribution boundary
- duplicate rule ownership across shell, view, domain, and data instead of one
  authoritative owner plus translation at boundaries

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix, including system-layer rules, lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1).

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-workbench.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/data-layer.md:1)
- [ADR 027: PresentationModel And IntentHandler View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-027-presentationmodel-intenthandler-view-layer.md:1)
