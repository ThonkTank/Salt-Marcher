Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Cross-layer responsibility matrix, dependency direction,
boundary crossings, and the only allowed inter-layer seams for active
SaltMarcher code.

# Layering Architecture Standard

## Goal

SaltMarcher uses one explicit layer architecture across `bootstrap/`,
`shell/`, `src/view/**`, `src/domain/**`, and `src/data/**`.

This standard owns only the cross-layer model: who depends on whom, which
boundaries are public, and which shortcuts are forbidden. Layer-internal rules
live only in the dedicated owner documents for bootstrap, shell, view, domain,
and data.

## Layer Responsibility Matrix

```text
bootstrap/   outer composition root and generic discovery
shell/       passive cockpit host and shell-owned runtime services
src/view/    inbound interface adapters
src/domain/  application core and published language
src/data/    outbound adapters and source-facing adaptation
```

Responsibilities:

- `bootstrap/` owns generic startup, discovery, registration order, and shell
  creation
- `shell/` owns passive cockpit surfaces, shell contracts, lifecycle, and
  shell-scoped runtime services
- `src/view/**` owns shell registration adapters, Binder wiring, passive
  Views, input interpretation, and observable presentation state
- `src/domain/**` owns business meaning, invariants, published language,
  application services, and outbound port interfaces
- `src/data/**` owns concrete adapters, source mechanics, persistence,
  transport, and translation between domain-facing contracts and external
  sources

## Dependency Direction

Source-code dependencies point inward:

1. `bootstrap -> shell`
2. `Contribution -> shell public contracts + own Binder`
3. `Binder -> shell public contracts + own ContributionModel + optional own IntentHandler + same-root Views + reusable slotcontent + domain public boundaries`
4. `ContributionModel/ContentModel -> read-side domain published carriers + JavaFX beans or collections + same-surface local support types`
5. `IntentHandler -> co-located ContributionModel or ContentModel + co-located ViewInputEvent + Binder-injected Consumer<PublishedEvent> sink seams + same-surface local support types`
6. `View -> JavaFX UI APIs + observable ContributionModel or ContentModel surface + reusable slotcontent view bases`
7. `data -> domain public boundaries and domain-owned outbound ports`
8. `domain -> no outer layer`

Additional rules:

- runtime control flow may travel in either direction, but source-code
  dependencies still point inward or invert through interfaces defined by the
  inner layer
- outer-format objects must not leak inward; examples include JavaFX
  scene-graph types, shell host classes, SQL rows, gateway records, and
  source-local infrastructure carriers
- outside the explicitly documented Binder/domain write seam and Binder-owned
  readback seam, no direct domain/view-layer connection is allowed

## Public Boundaries

The only intentional public boundaries across layers are:

- shell-facing contracts under `shell/api/**`
- shell-owned runtime composition under `shell/api/**`, including
  `ShellRuntimeContext`, `ServiceContribution`, and `ServiceRegistry`
- view `*Contribution` roots as shell-facing registration adapters
- view `*Binder` roots as runtime composition adapters
- domain `*ApplicationService` roots as the only public backend boundary below
  the view layer
- `src/domain/<context>/published/**` as carrier-only published language used
  at the root domain boundary
- domain-owned outbound ports declared under named domain modules

## Canonical Cross-Layer Flows

### Registration

1. `bootstrap/` discovers and registers data `*ServiceContribution` roots
2. `bootstrap/` constructs the shell with the populated `ServiceRegistry`
3. `bootstrap/` discovers and registers view `*Contribution` roots
4. routine feature addition must not require feature-specific bootstrap wiring

### Presentation Mutation

SaltMarcher allows exactly two presentation-state mutation cycles:

1. local presentation cycle:
   `View -> ViewInputEvent -> IntentHandler -> co-located ContributionModel or ContentModel -> observable state -> View`
2. domain-write cycle:
   `View -> ViewInputEvent -> IntentHandler -> PublishedEvent -> Binder sink -> ApplicationService -> domain internals -> published/** -> Binder-installed readback wiring -> co-located ContributionModel or ContentModel -> observable state -> View`

Forbidden shortcuts:

- direct View callback APIs besides `onViewInputEvent(...)`
- direct `IntentHandler -> ApplicationService` dependencies
- direct `View -> ApplicationService` paths
- direct domain writes from `ContributionModel` or `ContentModel`
- any third presentation-state mutation route

## Forbidden Patterns

- adjacent-layer pass-through wrappers whose only purpose is diagram symmetry
- `src/view/**` reaching directly into `src/data/**`
- passive Views reaching into shell internals, domain internals, data, or
  `*ApplicationService` types
- `ContributionModel` or `ContentModel` reaching into shell APIs, Binder
  types, concrete view classes, or `*ApplicationService` types
- `IntentHandler` reaching into shell APIs, `bootstrap`, concrete view
  classes, data, or `*ApplicationService` types
- `src/domain/**` depending on `bootstrap`, `shell`, `src/view`, or `src/data`
- `shell/**` owning feature logic
- `bootstrap/**` owning feature-specific business or presentation logic

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
