Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Quality-platform operating model, public proof routes, and
retained outcome-gate policy during the architecture migration.

# Quality Platforms Standard

## Goal

SaltMarcher uses structural build gates for automated confidence,
production-path behavior harnesses for behavior proof, and manual testing only
for desktop interaction or UI judgment that cannot be mechanically qualified.

This standard owns the public quality-platform operating model. It does not
restore the retired role-family enforcement doctrine removed by the
architecture migration.

## Public Proof Routes

- `tools/gradle/run-staged-verification.sh production-handoff`
  is the broad production-code handoff route.
- `tools/gradle/run-staged-verification.sh focused-handoff --path
  <repo-package-or-resource-dir> [--area <area>]`
  is the scoped local route for narrow package/resource work when the selected
  surface actually consumes that scope.
- Documentation-only and instruction-surface changes use `git diff --check`
  plus any owner-named proof from `AGENTS.md`; removed documentation gates are
  not public proof routes.
- Focused behavior harness tasks remain the proof owner for behavior
  scenarios. They are not replaced by compile, PMD, or architecture structure
  checks.

Private Gradle tasks, bundle selectors, engine-local diagnostics, and
build-harness internals are useful during repair, but they are not public
handoff routes unless a retained owner explicitly promotes them.

## Retained Outcome Gates

The migration keeps outcome checks binding:

- Java compilation and included-build integrity
- package cycles and layer dependency direction
- behavior-harness registration topology and declared Gradle task inputs
- owner-named documentation proof for changed documentation surfaces
- quality hygiene gates such as PMD, SpotBugs, CPD, Lizard, near-miss checks,
  compiled-artifact hygiene, packaging-resource checks, and dead-code
  reachability

The migration removes role-family form inventories and role-taxonomy teaching.
Do not recreate them as quality-platform policy.

## Behavior Harness Policy

Behavior changes, user-reported misbehavior, new features, and new
behavior-bearing concepts need an owning behavior harness or a recorded
Harness Gap. Harnesses should exercise production routes and inspect
production state, persisted data, published models, rendered facts, or named
owner APIs.

Harness scenarios and assertions are frozen during migration passes except for
separate wiring-port commits owned by the roadmap.

## Custom Checker Policy

Standard tools are the default home for quality and architecture rules:

- PMD for generic source smells and metrics
- SpotBugs for bytecode bug and security-smell discovery
- ArchUnit for dependency, module, boundary, and cycle rules
- Error Prone for compiler-local symbol, method-call, signature, and AST rules
- build-harness for source-tree topology and repository file/resource policy

New first-party checkers must name the gap that standard tools cannot express,
the public proof route that exposes the result, and the retirement condition.
This governance rule does not add a gate by itself.

## References

- [Quality Platforms Local Gates](quality-platforms-local-gates.md)
- [Quality Platforms Local Entrypoints](quality-platforms-local-entrypoints.md)
- [Verification Core Architecture](../architecture/verification-core.md)
- [Harness Gaps](harness-gaps.md)
