Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Cross-layer responsibility matrix, dependency direction,
boundary crossings, and the only allowed inter-layer seams for active
SaltMarcher code.

# Layering Architecture Standard

## Goal

SaltMarcher uses one explicit layer architecture across `bootstrap/`,
`shell/`, legacy `src/view/**`, legacy `src/domain/**`, and `src/data/**`.
Migrated `src/features/**` is the target feature-runtime source root once the
layering enforcement transition for that root lands.

This standard owns only the cross-layer model: who depends on whom, which
boundaries are public, and which shortcuts are forbidden. Layer-internal rules
live only in the dedicated owner documents for bootstrap, shell, view, domain,
and data.

For target migrated `src/features/**`, this document routes only to the
[Feature Runtime Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/feature-runtime.md:1).
For any internal legacy `src/view/**` roles, reusable `slotcontent/**` rules,
presentation-state cycles, or view/domain seam details, this document routes only to the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

## Layer Responsibility Matrix

```text
bootstrap/   outer composition root and generic discovery
shell/       passive cockpit host and shell-owned runtime services
src/features/ migrated feature-owned runtime boundaries and shell bindings
src/view/    inbound interface adapters
src/domain/  application core and published language
src/data/    outbound adapters and source-facing adaptation
```

Responsibilities:

- `bootstrap/` owns generic startup, discovery, registration order, and shell
  creation
- `shell/` owns passive cockpit surfaces, shell contracts, lifecycle, and
  shell-scoped runtime services
- target migrated `src/features/**` owns feature runtime boundaries, transient
  feature session state, target resolution, preview, operation dispatch,
  publication, render frames, raw-input UI, storage, and shell wiring after the
  layering enforcement transition for that root lands; its internal role rules
  live only in the Feature Runtime Architecture Standard
- `src/view/**` owns the presentation-layer adapters and observable
  presentation state surface for legacy roots; the internal role split is
  owned only by the View Layer Standard
- `src/domain/**` owns business meaning, internal models, published language,
  family application services, repositories, ports, and same-context domain
  service assembly roots for legacy and non-migrated authored-core code
- `src/data/**` owns legacy and non-migrated concrete adapters, source
  mechanics, persistence, transport, and translation between domain-facing
  contracts and external sources

## Role Ceremoniality Matrix

SaltMarcher does not use one repo-wide "too little logic" rule. Role
substance is judged only against the responsibility of the owning role family.

### Thin Orchestration Or Adapter Roles

These roles MAY stay intentionally thin, delegating, or wiring-focused when
they still own a real boundary responsibility:

- view `*Contribution`
- view `*Binder`
- view `*IntentHandler`
- root domain `<PascalContext>ApplicationService`
- domain `application/*UseCase`
- data `*ServiceContribution`
- domain `*ServiceContribution`
- domain `*ServiceAssembly`

### Passive Or State-Only Roles

These roles MAY stay passive or carrier-oriented. They are not expected to own
decision-heavy logic:

- view `*View`
- view `*ContributionModel`
- view `*ContentModel`
- view `*ViewInputEvent`
- view `*PublishedEvent`
- domain `published/**`
- data `model/**`

### Non-Ceremonial Substantive Roles

These roles MUST not exist only as relay or wrapper ceremony. If they exist,
they must own real decision, translation, composition, validation, or
construction work:

- legacy domain `service/**`
- legacy domain `policy/**`
- legacy domain `factory/**`
- domain `model/**`
- domain repository roles, including the current `*Repository` owners that may
  still live under `port/**` while topology migration catches up
- domain `port/**` listener roles

## Dependency Direction

Source-code dependencies point inward:

1. `bootstrap -> shell`
2. `features -> shell public contracts + documented persistence/authored-fact seams`
3. `view -> shell public contracts + documented domain public boundaries`
4. `data -> domain public boundaries and domain-owned repositories`
5. `domain -> no outer layer`, except direct-root domain service-composition
   files may use the narrow shell runtime registration seam

Additional rules:

- runtime control flow may travel in either direction, but source-code
  dependencies still point inward or invert through interfaces defined by the
  inner layer
- outer-format objects must not leak inward; examples include JavaFX
  scene-graph types, shell host classes, SQL rows, gateway records, and
  source-local infrastructure carriers
- migrated `src/features/**` code must not be forced to preserve legacy
  `src/view/**` or `src/domain/**` role families as a compliance shortcut
- outside the seam families documented by the View Layer Standard, no direct
  domain/view-layer connection is allowed

## Public Boundaries

The only intentional public boundaries across layers are:

- shell-facing contracts under `shell/api/**`
- shell-owned runtime composition under `shell/api/**`, including
  `ShellControls`, `ShellRuntimeContext`, `ServiceContribution`, and
  `ServiceRegistry`
- feature-runtime shell bindings and persistence/authored-fact seams as defined by
  the [Feature Runtime Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/feature-runtime.md:1)
- view `*Contribution` roots as shell-facing registration adapters
- view `*Binder` roots as runtime composition adapters
- domain family `*ApplicationService` roots as the public backend boundary
  below the view layer
- domain `*ServiceContribution` roots and optional `*ServiceAssembly`
  collaborators as shell-facing service registration adapters for same-context
  domain services
- `src/domain/<context>/published/**` as carrier-only published language used
  at the root domain boundary
- domain-owned repository abstractions declared under the domain layer

## Canonical Cross-Layer Flows

### Registration

1. `bootstrap/` discovers and registers data source-adapter
   `*ServiceContribution` roots
2. `bootstrap/` discovers and registers domain service `*ServiceContribution`
   roots
3. `bootstrap/` constructs the shell with the populated `ServiceRegistry`
4. `bootstrap/` discovers and registers view `*Contribution` roots
5. migrated feature shell bindings under `src/features/<feature>/shell/**`
   register only through the feature-runtime shell seam
6. routine feature addition must not require feature-specific bootstrap wiring

### Presentation Mutation

Presentation-state mutation rules are owned only by the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).

Forbidden shortcuts:

- any third presentation-state mutation route

## Forbidden Patterns

- adjacent-layer pass-through wrappers whose only purpose is diagram symmetry
  or naming ceremony around an otherwise unchanged collaborator
- `src/view/**` reaching directly into `src/data/**`
- migrated `src/features/**` reintroducing the legacy
  `Contribution -> Binder -> ContributionModel -> ContentModel ->
  IntentHandler -> ApplicationService -> published/*Model` chain solely for
  compliance with old roots
- view-layer code bypassing its documented shell or domain public boundaries
- `src/domain/**` depending on `bootstrap`, `src/view`, or `src/data`
- `src/domain/**` depending on `shell` outside direct-root
  `*ServiceContribution` and `*ServiceAssembly` composition files
- `shell/**` owning feature logic
- `bootstrap/**` owning feature-specific business or presentation logic

## Review Signals

The layering model also treats several broader architecture-debt shapes as
review signals even when they are not yet hard blockers:

- hub-like tactical roles that fan out into many foreign owners or foreign
  feature scopes
- dense but still acyclic cross-feature coupling between domain and data
  feature scopes
- over-wide public boundary roots such as `*ApplicationService` or
  `*ServiceContribution` owners that accumulate too many collaborators or too
  broad a callable surface

These review signals complement, not replace, the sharper cycle, dependency,
and relay-wrapper blockers. They are intended to surface architecture sprawl
before it turns into hard structural failure.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Feature Runtime Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/feature-runtime.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
