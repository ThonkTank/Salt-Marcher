Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
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
src/view/    inbound interface adapters: contributions, ViewModels, passive views
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
  - uses `*Binder` classes to adapt ViewModels and passive slotcontent into
    shell bindings
  - uses active-root `*ViewModel` classes to translate user intent and
    presentation concerns into calls against domain application boundaries
  - uses slotcontent `*ViewModel` classes only for slot-local projection of
    active-root or domain-published signals
  - uses passive `*View` classes for JavaFX controls that render ViewModel
    state and emit technical user events
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
3. `Binder -> shell public contracts + own ViewModel + passive views +
   slotcontent + domain public boundaries`
4. `Active ViewModel -> domain public boundaries + JavaFX beans/collections`
   and `slotcontent ViewModel -> domain published carriers + JavaFX
   beans/collections`
5. `View -> JavaFX UI APIs + reusable passive views`
6. `data -> domain public boundaries and domain-owned outbound ports`
7. `domain -> no outer layer`

Additional rules:

- The repository shape is layered, but the dependency model is onion-style.
  Outer layers may skip an intermediate layer only when the dependency lands on
  an explicit intentional public boundary.
- Runtime control flow may travel in either direction. Source-code
  dependencies must still point inward or invert through interfaces defined on
  the inner side of the boundary.
- Outer-format objects must not leak inward. Examples include JavaFX
  scene-graph types inside domain code, shell host classes, gateway records,
  SQL rows, and source-local infrastructure shapes.

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
- data `*ServiceContribution` roots as the registration boundary of one data
  feature, not as a public business boundary

## Canonical Interaction Flows

### Bootstrap And Registration

1. `bootstrap/` discovers service contributions and builds the shared shell
   service registry.
2. `bootstrap/` creates the shell with that registry.
3. `bootstrap/` discovers view contributions, resolves registration metadata,
   and registers shell-facing left-bar tabs, state tabs, and top-bar dropdown windows.
4. No routine feature addition should require feature-specific bootstrap logic.

### User-Initiated Application Flow

1. the shell activates a registered contribution
2. the contribution delegates binding to its co-located Binder
3. the Binder obtains runtime services, instantiates the ViewModel, active
   views, and needed slotcontent, then returns a `ShellBinding`
4. the Binder binds passive view emitters and bind targets to ViewModel state
   and actions
5. a passive view emits a user event
6. the ViewModel translates the event into presentation state or a call to a
   same-feature or foreign public `*ApplicationService`
7. domain objects and domain-owned ports coordinate the use case
8. data adapters implement the required write or read-only ports
9. results return as domain published carriers into the ViewModel
10. the ViewModel translates domain facts into presentation state or display
   models
11. passive views render the updated state

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
  is the composition root.
- View contributions may use shell contracts for registration and delegation
  to their Binder. Cockpit binding itself belongs to the Binder.
- `src/data/<feature>/*ServiceContribution.java` may use shell service
  registration contracts because backend capability export is a root concern
  of the data layer.
- Inner-layer interfaces may be implemented by outer layers when runtime flow
  needs to cross outward without violating the dependency rule.

These exceptions do not license additional shortcuts below those explicit root
boundaries.

## Forbidden Patterns

- strict adjacent-layer-only pass-through wrappers whose only purpose is to
  satisfy a stacked-diagram aesthetic instead of a real boundary need
- `src/view/**` reaching directly into `src/data/**`
- passive views reaching into shell, domain, data, ViewModel, or
  ApplicationService types
- ViewModels reaching into shell APIs or concrete view classes
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
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix, including system-layer rules, lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [ADR 012: System-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/012-system-layer-architecture-model.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
