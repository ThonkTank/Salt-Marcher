Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
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

## Pattern Alignment

- `Clean Architecture` governs the dependency rule: source-code dependencies
  point inward toward higher-level policy, and boundary carriers are shaped for
  the inner side.
- `Hexagonal Architecture` / `Ports and Adapters` govern inbound adapters,
  outbound adapters, domain-owned ports, and the application core.
- `Onion Architecture` governs inward coupling and infrastructure
  externalization.
- `Service Layer` governs the public client-facing application boundary below
  the view layer through `*ApplicationService`.
- The dedicated shell-workbench, MVVM, domain-layer, and data-layer standards
  refine the internal role model of each layer.

## Layer Responsibility Matrix

SaltMarcher's top-level active code shape is:

```text
bootstrap/   outer composition root and generic discovery
shell/       passive cockpit workbench host and shell-owned runtime services
src/view/    inbound interface adapters: tab models and passive panel views
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
  - uses `view/models` to translate shell activation, view emitters, and
    presentation concerns into calls against shell contracts and domain
    application boundaries
  - uses `view/views` for passive panel content that renders model state and
    emits technical user events
- `src/domain/**`
  - is the application core
  - owns business meaning, invariants, application services, exported boundary
    types, named domain modules, and domain-owned contracts
- `src/data/**`
  - is the outbound adapter layer
  - implements domain-owned ports and translates between domain-facing
    contracts and concrete sources such as SQLite or future remote systems

## Dependency Rule And Boundary Crossings

The binding source-dependency rule is inward-only:

1. `bootstrap -> shell`
2. `view/models -> shell public contracts + view/views + domain public
   boundaries`
3. `view/views -> JavaFX UI APIs + narrow listener/emitter contracts`
4. `data -> domain public boundaries and domain-owned ports`
5. `domain -> no outer layer`

Additional rules:

- The repository shape is layered, but the dependency model is onion-style.
  Outer layers may skip an intermediate layer only when the dependency lands on
  an explicit intentional public boundary defined below.
- Data adapters may use own-feature domain types required by their
  domain-owned repository, read-model, mapper, and application-service factory
  contracts. Foreign-feature data access remains limited to foreign public
  domain boundaries.
- Outer layers must not reach into foreign private buckets just because they
  are deeper. The target must still be an intentional public boundary.
- Runtime control flow may travel in either direction. Source-code
  dependencies must still point inward or invert through interfaces defined on
  the inner side of the boundary.
- Data crossing a layer boundary should be simple commands, queries, results,
  snapshots, or other intentional carriers shaped for the inner side of the
  boundary.
- Outer-format objects must not leak inward. Examples include JavaFX
  scene-graph types, shell host classes, gateway records, SQL rows, transport
  payload DTOs, and other source-local infrastructure shapes.

The canonical intentional public boundaries are:

- shell-facing contracts under `shell/api/**`
- the shell-owned runtime composition seam under `shell/api/**`, including
  `ShellRuntimeContext`, `ServiceContribution`, and `ServiceRegistry`
- `src/view/models/**` model roots as shell-facing view-model composition
  adapters
- domain `*ApplicationService` roots as the only callable public
  client-facing backend boundary below the view layer
- `src/domain/<feature>/api/**` as carrier-only public boundary types used by
  those application services
- domain-owned contracts declared in named domain modules as inner backend
  ports, not alternate client boundaries
- data `*ServiceContribution` roots as the registration boundary of one data
  feature, not as a public business boundary

## Canonical Interaction Flows

### Bootstrap And Registration

1. `bootstrap/` discovers service contributions and builds the shared shell
   service registry.
2. `bootstrap/` creates the shell with that registry.
3. `bootstrap/` discovers view models, resolves registration metadata, and
   registers shell-facing tabs, state tabs, and top-bar dropdown windows.
4. No routine feature addition should require feature-specific bootstrap logic.

### User-Initiated Application Flow

1. the shell activates a registered tab model
2. the model instantiates and binds passive panel views
3. a passive view renders model state through listeners or bind targets
4. a passive view emits a user event
5. the model translates the event into presentation state or a call to a same-
   feature or foreign public `*ApplicationService`
6. domain objects and domain-owned contracts coordinate the use case
7. data adapters implement the required repository or projection contracts
8. results return as domain API carriers into the model
9. the model maps results into presentation state
10. passive views render the updated state

### Shell-Scoped Runtime Flow

1. a view model obtains `ShellRuntimeContext`
2. shell-owned services such as details/history publishing, backend capability
   lookup, or typed runtime sessions are adapted into model-local
   collaborators
3. backend capability lookup is a composition concern used to assemble or fetch
   application-service factories and other runtime collaborators; it is not a
   second client-facing backend boundary
4. the shell remains passive: it hosts surfaces and scoped services, but it
   does not take over feature behavior

### Cross-Feature Flow Below The View Layer

- Cross-feature backend access goes only through foreign public
  `*ApplicationService` roots and foreign `api/` types.
- Foreign domain internals, foreign private view buckets, and foreign private
  data buckets are not valid shortcuts.
- Passive views do not perform cross-feature access at all; view models own
  that boundary crossing.

## Allowed Exceptions

The allowed outer-layer bridging exceptions are explicit and narrow:

- `bootstrap/` may instantiate and register shell/view/data roots because it
  is the composition root.
- `src/view/models/**` may use shell contracts because shell registration and
  cockpit binding are model-root concerns of the view layer.
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
- passive `src/view/views/**` reaching into shell, domain, data, or
  ApplicationService types
- `src/domain/**` depending on `bootstrap`, `shell`, `src/view`, or `src/data`
- `shell/**` owning feature logic or importing feature implementations as
  extension points
- `bootstrap/**` owning feature-specific business or presentation logic
- source-local data shapes or framework types leaking from `src/data/**` into
  `src/domain/**`
- shell implementation classes leaking below the view-model boundary
- cross-feature imports of foreign private view, domain, or data buckets
- duplicate rule ownership across shell, view, domain, and data instead of one
  authoritative owner plus translation at boundaries

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix, including system-layer rules, lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current mechanical ownership still reflects portions of the previous
component-local view topology. Target mechanical ownership should migrate so
`src/view/models` owns shell/domain boundary use and `src/view/views` remains
passive JavaFX-only panel content.

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
- [ADR 019: Shell Cockpit Tab Model View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
