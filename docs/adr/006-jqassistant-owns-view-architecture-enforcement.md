# ADR 006: Layered View-Architecture Enforcement

- Status: Accepted
- Date: 2026-04-18

## Context

This ADR remains the historical owner split for the current view-architecture
checks. The target view topology is now defined by
[ADR 017: Declarative MVVM View Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/017-declarative-mvvm-view-boundary.md:1)
and requires later checker migration.

SaltMarcher's view-architecture rules had been split across multiple tools
without a clear contract for which engine should own which kind of rule.
The temporary follow-up decision to move everything into `jQAssistant` reduced
duplication, but it left two problems open:

- compiler-precise MVVM bans such as `ViewModel` framework independence and
  public `api/` signature leaks are awkward to express and debug in Cypher
  alone
- the repository still carried two competing jQAssistant dialects for one
  documented architecture model

## Decision

SaltMarcher uses a layered enforcement model for view architecture, with
compiler-precise rules enforced during `compileJava` and graph-shaped MVVM
rules enforced through the central `check` aggregate.

- `jQAssistant` owns graph-shaped view rules:
  - component topology
  - bucket placement for `*Assembly` and `*ShellAdapter` naming contracts
  - root-entrypoint count
  - cross-component boundaries
- `Error Prone` owns compiler-precise source rules:
  - root-entrypoint delegation and direct `ShellRuntimeContext` wiring bans
  - shell API allowlist checks on the view composition boundary
  - `assembly/` and `View/` dependency bans
  - `ViewModel` framework independence
  - `api/` dependency bans
  - presentation-state placement and reflection-bypass bans
  - public `api/` signature bans on leaking private view types
- `ArchUnit` keeps outer-layer dependency direction and cycle rules, but not
  component-internal view-bucket contracts.
- `build-harness` keeps repository and persistence topology checks, but not
  dedicated view-architecture ownership.

The rollout of the owner split and blocking entrypoints is complete:

- `checkViewArchitecture` remains the explicit reporting task for current
  graph-shaped view architecture.
- The central `check` aggregate runs current jQAssistant view-topology analysis
  through `checkViewArchitecture`; `build` reaches it through Gradle's standard
  `build -> check` lifecycle.
- Focused `compileJava` invocations do not run jQAssistant graph analysis.
- The former preview-only rules are folded into that single blocking task.
- Legacy-compatible structural dialects are removed instead of being kept as
  parallel rule sets.
- The per-rule status of what is `Enforced`, `Candidate`, or `Review-Only`
  remains documented in the architecture-enforcement harness standard.

## Consequences

- View-architecture ownership is split by rule shape instead of by historical
  accident.
- The repository now has one mechanically enforced MVVM source of truth instead
  of a blocking legacy harness plus a second target harness.
- Shared-component naming no longer creates silent root-entrypoint exceptions;
  only explicit `api/` boundaries define cross-component reuse.

## Alternatives Considered

### Keep `jQAssistant` as the exclusive owner

Rejected because compiler-precise signature and framework bans would still be
modeled in the wrong engine and would produce poorer feedback than
compile-time diagnostics.

### Keep the old fragmented ownership

Rejected because SaltMarcher would continue to duplicate the same policy in
multiple tools without a clean rule-shape boundary.

## Related Documents

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [ADR 017: Declarative MVVM View Boundary](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/017-declarative-mvvm-view-boundary.md:1)
