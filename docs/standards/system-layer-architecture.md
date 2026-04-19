Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
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
- `Hexagonal Architecture` / `Ports and Adapters` govern the distinction
  between inbound adapters, outbound adapters, domain-owned ports, and the
  application core.
- `Onion Architecture` governs inward coupling and the externalization of
  infrastructure.
- `Service Layer` governs the public client-facing application boundary exposed
  below the view layer through `*ApplicationService`.
- The dedicated shell-workbench, MVVM, domain-layer, and data-layer standards
  refine the internal role model of each layer. This document does not restate
  those internal rules.

## Layer Responsibility Matrix

SaltMarcher's top-level active code shape is:

```text
bootstrap/   outer composition root and generic discovery
shell/       passive workbench host and shell-owned runtime services
src/view/    inbound interface adapters and presentation behavior
src/domain/  application core, business rules, and domain-owned ports
src/data/    outbound adapters and persistence/external-system adaptation
```

Layer responsibilities:

- `bootstrap/`
  - owns generic startup, discovery, registration order, and shell creation
  - is the outer composition root, not a feature or business-logic home
- `shell/`
  - owns passive workbench surfaces, shell contracts, and shell-scoped runtime
    services
  - stays generic and must not own feature logic
- `src/view/**`
  - is the inbound interface-adapter layer
  - translates FXML/controller gestures, activation hooks, and presentation
    concerns into calls against shell contracts and domain application
    boundaries
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
2. `view -> shell public contracts + domain public boundaries`
3. `data -> domain public boundaries and domain-owned ports`
4. `domain -> no outer layer`

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

- shell-facing contribution contracts under `shell/api/**` such as
  `ShellViewContribution`, `ShellScreen`, and `ShellContributionSpec`
- the shell-owned runtime composition seam under `shell/api/**` consisting of
  `ShellRuntimeContext`, `ServiceContribution`, and `ServiceRegistry`
- root `*ViewContribution` classes as shell-facing view composition adapters
- domain `*ApplicationService` roots as the only callable public
  client-facing backend boundary below the view layer
- `src/domain/<feature>/api/**` as carrier-only public boundary types used by
  those application services
- domain-owned contracts declared in named domain modules as inner backend
  ports, not alternate client boundaries and not `application/` use-case
  coordinators
- data `*ServiceContribution` roots as the registration boundary of one
  data feature, not as a public business boundary

## Canonical Interaction Flows

### Bootstrap And Registration

1. `bootstrap/` discovers service contributions and builds the shared
   shell service registry.
2. `bootstrap/` creates the shell with that registry.
3. `bootstrap/` discovers view contributions, resolves registration metadata,
   and registers shell-facing screens.
4. No routine feature addition should require feature-specific bootstrap logic.

### User-Initiated Application Flow

1. the shell activates a prepared screen
2. FXML-backed `View/` controllers receive user gestures
3. `View/` forwards to `ViewModel/`
4. `ViewModel/` calls a same-feature or foreign public
   `*ApplicationService`
5. domain objects and domain-owned contracts coordinate the use case
6. data adapters implement the required repository or projection contracts
7. results return as domain API carriers into the `ViewModel/`
8. the `View/` renders from presentation state

### Shell-Scoped Runtime Flow

1. a view contribution obtains `ShellRuntimeContext`
2. shell-owned services such as inspector publishing, backend capability
   lookup, or typed runtime sessions are adapted into component-local
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
- Cross-component view reuse goes only through declared Shared View Component
  `api/` packages; foreign shared `View/` and `ViewModel/` packages remain
  private.

## Allowed Exceptions

The allowed outer-layer bridging exceptions are explicit and narrow:

- `bootstrap/` may instantiate and register shell/view/data roots because it
  is the composition root.
- `src/view/<component>/*ViewContribution.java` may use shell contracts because
  shell composition is a root concern of the view layer.
- `src/data/<feature>/*ServiceContribution.java` may use shell service
  registration contracts because backend capability export is a root
  concern of the data layer.
- Inner-layer interfaces may be implemented by outer layers when runtime flow
  needs to cross outward without violating the dependency rule.

These exceptions do not license additional shortcuts below those explicit root
boundaries.

## Forbidden Patterns

- strict adjacent-layer-only pass-through wrappers whose only purpose is to
  satisfy a stacked-diagram aesthetic instead of a real boundary need
- `src/view/**` reaching directly into `src/data/**`
- `src/domain/**` depending on `bootstrap`, `shell`, `src/view`, or
  `src/data`
- `shell/**` owning feature logic or importing feature implementations as
  extension points
- `bootstrap/**` owning feature-specific business or presentation logic
- source-local data shapes or framework types leaking from `src/data/**` into
  `src/domain/**`
- shell implementation classes leaking below the view contribution boundary
- cross-feature imports of foreign private `View/`, `ViewModel/`, `assembly/`,
  non-shared view `api/`, domain modules, `gateway/`, `model/`, or `mapper/`
  buckets
- duplicate rule ownership across shell, view, domain, and data instead of one
  authoritative owner plus translation at boundaries

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix, including system-layer rules, lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current mechanical ownership:

- `./gradlew architectureTest` owns bytecode-visible system dependency
  direction: bootstrap stays out of feature code, shell stays out of
  bootstrap and feature layers, view stays out of bootstrap and data, domain
  stays out of all outer layers, data stays out of bootstrap and view, and
  internal data buckets stay out of shell.
- `./gradlew architectureTest` also owns the `shell.api` / `shell.host` split,
  the bootstrap-only access rule for `shell.host.AppShell`,
  foreign-domain-public-boundary-only access below the view layer, and
  feature-cycle freedom across domain, view, data, and shell package slices.
- `./gradlew checkViewArchitecture` owns the declarative MVVM topology,
  including normal view components and declared Shared View Components, while
  `./gradlew compileJava` owns compiler-precise view-layer dependency bans,
  shell API allowlists, and declared shared view API dependency checks.
- `./gradlew compileJava` owns compiler-precise domain boundary purity:
  public operational members on domain application-service roots and public
  domain `api/` signatures must stay free of outer-layer types, foreign
  private domain types, and same-feature internal domain-module types.
- `./gradlew compileJava` owns root application-service constructor
  composition safety: public/protected constructors may expose only
  same-feature domain-owned port interfaces and public domain boundaries, not
  outer-layer types, foreign private domain types, or same-feature concrete
  application/model collaborators.
- `./gradlew compileJava` owns data adapter boundary purity and role checks:
  gateway public return types stay source-local, repository/query public
  signatures do not leak internal data infrastructure, and public concrete
  adapters satisfy the expected own-feature domain-owned contract role.
- `./gradlew pmdArchitectureMain` owns root-entrypoint contracts, thin
  stateless root contracts, shell source policies, forbidden legacy wiring
  patterns, feature-specific bootstrap/shell wiring bans, and the source-level
  data root registration subset that limits `ServiceRegistry` registrations to
  own-feature application-service roots, nested factories, and domain-owned
  port contracts.
- `./gradlew :build-harness:check` owns repository topology, placement rules,
  required root-presence checks, `ServiceContribution` root placement, and
  backend-port contract exclusion from domain `api/` and `application/`
  packages.
- `./gradlew compileJava` owns compiler-precise service-registry registration
  placement: direct `ServiceRegistry.Builder.register(...)` calls belong only
  in data `*ServiceContribution` roots.

Review-owned rules in this standard:

- minimizing cross-layer seams to the smallest intentional public boundary
- using only the explicit public-boundary list above to remove needless
  pass-through wrappers without widening private access
- deciding whether same-feature data-domain references are genuinely required
  by the adapter role rather than merely convenient
- preserving shell passivity and composition-root discipline beyond the checks
  already encoded mechanically
- keeping coordination logic authored once instead of duplicated across shell,
  view, domain, and data

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 012: System-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/012-system-layer-architecture-model.md:1)
