# ADR 005: Strict MVCI Roles In The View Layer

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher already separates active code into `view`, `domain`, and `data`,
but the internal role boundaries inside `src/view/**` are still too weak.
Several components use `interactor/` as a mixed bucket for business logic,
JavaFX widget construction, runtime-session composition, and shell-facing
assembly. That weakens the value of MVCI as a coupling boundary because the
bucket names imply roles that the code does not consistently uphold.

At the same time, the current model still leaves three architectural decisions
too vague:

- whether the presentation state is framework-bound or framework-free
- whether root entrypoints may perform routine slice wiring directly
- how cross-component view reuse is allowed to happen without collapsing
  component boundaries

## Decision

SaltMarcher adopts a strict passive-view MVCI model inside the view layer.

- `Controller/` is the public action boundary of a component slice and depends
  only on its own `interactor/`.
- `View/` owns JavaFX node construction, rendering, bindings, dialogs, popups,
  and local ephemeral widget state.
- `Model/` owns canonical presentation state as plain state rather than
  JavaFX-specific property graphs.
- `interactor/` owns presentation orchestration and domain-API interaction, but
  is not a bucket for scene-graph construction or shell wiring.
- `assembly/` owns shell adapters, runtime-session composition, and slice
  construction that wires shell-owned services into the MVCI slice.
- Root `*ViewContribution` classes are thin shell-registration entrypoints and
  delegate routine slice wiring into `assembly/`.
- Cross-component reuse is explicit and public only; private foreign MVCI
  buckets remain forbidden.

The detailed rules for allowed dependencies and enforcement ownership live in
the view-layer standard, not in this ADR.

## Consequences

- Existing view components that currently mix scene-graph ownership or runtime
  assembly into `interactor/` must be migrated over time.
- Existing components that store presentation state in `javafx.*` types inside
  `Model/` must be migrated toward plain state over time.
- The repository structure standard now permits `assembly/` below
  `src/view/<component>/`.
- The shell and discovery standard must describe shell access as a root or
  `assembly/` concern, never an interactor concern.
- Architecture enforcement must eventually cover framework-free model state,
  root-to-assembly-only wiring, and public-only reuse boundaries in addition to
  today's bucket checks.

## Alternatives Considered

### Keep the current pragmatic bucket usage

Rejected because it preserves ambiguous ownership and makes MVCI conformance a
matter of interpretation instead of a project rule.

### Allow `interactor/` to remain a mixed bucket for logic and JavaFX widgets

Rejected because it collapses the distinction between view construction and
business logic coordination.

### Allow JavaFX property graphs to remain the canonical presentation model

Rejected because it couples authored state to the UI framework and weakens the
boundary between passive view and rendering details.

### Encode all details only in feature-local `UI.md` documents

Rejected because the role model is a system-wide architecture rule and needs
one centralized source of truth.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [View MVCI Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvci.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
