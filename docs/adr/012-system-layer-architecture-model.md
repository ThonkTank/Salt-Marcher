# ADR 012: System-Layer Architecture Model

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher now has binding architecture standards for the shell, view,
domain, and data layers. What is still missing is one canonical decision for
how those layers interact as a whole.

Without that system-wide model, several high-impact questions stay too
implicit:

- whether SaltMarcher follows a strict adjacent-layer stack or an inward-only
  dependency model
- how `bootstrap` and `shell` fit into the same architecture picture as
  `view`, `domain`, and `data`
- which cross-layer seams are intentional public boundaries and which are
  forbidden shortcuts
- how to reduce change blast radius without creating redundant pass-through
  wrappers

The current repository already points in a clear direction. `ArchUnit` encodes
top-level dependency boundaries between `bootstrap`, `shell`, `src.view`,
`src.domain`, and `src.data`. The dedicated layer standards already describe
their internal role models. What is missing is one binding document that
connects those pieces into a single system-layer model.

## Decision

SaltMarcher adopts a dedicated system-layer architecture model for the whole
active application.

- The repository shape remains `bootstrap`, `shell`, `view`, `domain`, and
  `data`.
- The normative dependency rule is inward-only, aligned with Clean
  Architecture and Onion Architecture rather than with a strict adjacent-layer
  stack.
- `bootstrap` is the composition root and generic discovery owner.
- `shell` is the passive workbench host layer.
- `view` is the inbound interface-adapter layer.
- `domain` is the application core and the single authored home of business
  rules and domain-owned ports.
- `data` is the outbound adapter layer that implements domain-owned ports and
  externalizes persistence details.
- Outer layers may skip an intermediate layer only when they depend on an
  explicit intentional public boundary. They may not bypass public boundaries
  or reach into foreign private buckets.
- Boundary crossings must use intentional boundary carriers, not framework or
  source-local detail objects.

The detailed rules live in the system-layer architecture standard, not in this
ADR.

## Consequences

- SaltMarcher now has one canonical source of truth for the top-level layer
  graph, dependency direction, and cross-layer seam rules.
- The dedicated shell, view, domain, and data standards can stay focused on
  their internal role models instead of duplicating system-wide dependency
  rules.
- The architecture explicitly avoids the classic `UI -> BLL -> DAL`
  pass-through tendency that widens change blast radius and encourages wrapper
  duplication.
- `bootstrap` and `shell` now have a stable place in the same model as the
  feature layers without collapsing shell hosting into the view layer.
- Existing `ArchUnit` rules remain the primary mechanical owner of top-level
  dependency direction; stronger seam-minimization and boundary-purity rules
  remain review-owned until an existing gate can own them cleanly.

## Alternatives Considered

### Keep the interaction rules implicit across `overview`, `ArchUnit`, and the layer-specific standards

Rejected because it leaves the most important whole-system dependency
decisions split across summaries, code, and multiple standards without one
binding source.

### Adopt a strict adjacent-layer-only `N-Layer` model

Rejected because it would encourage pass-through wrappers and make SaltMarcher
less aligned with the inward-only dependency rule already implied by the
current architecture and references.

### Treat `shell` as just another part of the view layer

Rejected because SaltMarcher's shell is a passive workbench host with its own
fixed contracts, lifecycle, and runtime services. Collapsing it into the view
layer would blur ownership and weaken shell passivity.

### Treat `data` as a lower sublayer directly below `view`

Rejected because SaltMarcher already models `src/data/**` as infrastructure
detail that implements domain-owned ports. Direct `view -> data` coupling would
increase blast radius and duplicate domain decisions outside the core.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/system-layer-architecture.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvvm.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/data-layer.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)

## External Research Basis

- [The Clean Architecture local mirror](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/clean-architecture.md:1)
- [Hexagonal Architecture local mirror](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/cockburn-hexagonal-architecture.md:1)
- [Onion Architecture Part 3 local mirror](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/palermo-onion-part-3.md:1)
- [Service Layer local mirror](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/application-layer/fowler-service-layer.md:1)
- [Common Web Application Architectures local mirror](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/microsoft-common-web-application-architectures.md:1)
