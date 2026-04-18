# ADR 005: MVVM And Assembly Boundary In The View Layer

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher already separates active code into `view`, `domain`, and `data`,
but the internal role boundaries inside `src/view/**` are still too weak.
Several components use mixed buckets for JavaFX widget construction,
presentation state, domain orchestration, runtime-session composition, and
shell-facing assembly. That weakens decoupling and deduplication because the
codebase has no single professional pattern vocabulary for view-layer
responsibilities.

At the same time, the current model still leaves three architectural decisions
too vague:

- whether presentation logic lives in the view or in a dedicated presentation
  owner
- whether root entrypoints may perform routine slice wiring directly
- how cross-component view reuse is allowed to happen without collapsing
  component boundaries

## Decision

SaltMarcher adopts `Model-View-ViewModel (MVVM)` as the canonical view-layer
architecture model.

- `View/` owns JavaFX node construction, rendering, bindings, dialogs, popups,
  and widget-local ephemeral state.
- `ViewModel/` owns presentation state, user-triggered actions, presentation
  policy, and domain-API interaction.
- `assembly/` owns shell adapters, runtime-session composition, and slice
  construction that wires shell-owned services into the MVVM slice.
- Root `*ViewContribution` classes are thin shell-registration entrypoints and
  delegate routine slice wiring into `assembly/`.
- Cross-component reuse is explicit and public only; private foreign view
  buckets remain forbidden.

The detailed rules for allowed dependencies and enforcement ownership live in
the view-layer standard, not in this ADR.

## Consequences

- Existing view components that still split presentation logic across legacy
  `Model/`, `Controller/`, and `interactor/` buckets are migration debt rather
  than precedent.
- Existing components that store presentation state in `javafx.*` types must
  be migrated toward `ViewModel`-owned framework-free state over time.
- The repository structure standard permits `assembly/`, optional `api/`,
  `View/`, and `ViewModel/` below `src/view/<component>/`.
- Every view component, including historically `*shared`-named components,
  still owns exactly one `*ViewContribution` root entrypoint.
- The shell-workbench standard must describe shell access as a root or
  `assembly/` concern, never a `View` or `ViewModel` concern, and the shell
  discovery/bootstrap standard must keep bootstrap mechanics separate from that
  role model.
- Architecture enforcement must cover the canonical MVVM bucket topology,
  framework-free `ViewModel` state, root-to-assembly-only wiring, and
  public-only reuse boundaries as the single blocking path.

## Alternatives Considered

### Keep the current pragmatic bucket usage

Rejected because it preserves ambiguous ownership and makes conformance a
matter of interpretation instead of a project rule.

### Standardize on Fowler Passive View

Rejected because SaltMarcher wants the `View` to retain simple binding and
projection work, while moving presentation decisions into a dedicated
`ViewModel`.

### Invent a project-local umbrella term instead of using MVVM

Rejected because it hides the use of an established professional model behind
non-standard terminology and makes the architecture harder to learn.

### Encode all details only in feature-local `UI.md` documents

Rejected because the role model is a system-wide architecture rule and needs
one centralized source of truth.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvvm.md:1)
- [ADR 007: Shared View API Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/007-shared-view-api-boundary.md:1)
