Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Aggregate entrypoints, staged handoff routing, and concurrent
local invocation policy for SaltMarcher quality platforms.

# Quality Platforms Local Entrypoints

## Purpose

This subordinate standard owns local aggregate entrypoints and concurrent
worktree invocation policy beneath the umbrella
[Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1).
Individual local gate behavior lives in
[Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1).

## Central Aggregate

`./gradlew check --console=plain` is the local full build-health blocker and
the single central aggregate for repository-owned blocking Gradle checks.

`check` routes through `production-handoff`. It exists for Gradle convention
compatibility; it must not reconstruct or own a second production check graph.

The shared owner list behind `production-handoff` lives in the typed
verification lifecycle catalog; root build scripts must not add those owners
separately.

`pmdMain` and `spotbugsMain` are central blocking gates and may also be run as
focused direct entrypoints. `pmdStrictMain` remains the focused text-first PMD
entrypoint, but derives its report from the `pmdMain` XML result instead of
running a second PMD scan.

## Public Handoff Routes

`tools/gradle/run-staged-verification.sh production-handoff` is the default
implementation-handoff route required by `AGENTS.md` for production-code
changes. The wrapper is runtime-only: it forwards the canonical surface name to
one same-named Gradle lifecycle task, and the verification core expands
`production-handoff` directly: assemble, all non-documentation harness checks
over production code, the quality-hygiene tool owners, and CKJM reporting
inside Gradle.

For check-only implementation work limited to concrete enforcement packages or
verification-only wiring under `tools/**`, `build.gradle.kts`, or
`settings.gradle.kts`, the required handoff proof is the smallest task that
exercises the affected package plus `production-handoff` when shared
production-code routing changes. Focused package and layer-surface tasks remain
technical diagnostics, not public proof owners.

`./gradlew checkDocumentationEnforcement --console=plain` is the focused
`Blocking Local Gate` for Markdown-backed architecture and enforcement
documentation checks. It is intentionally outside `check` and `build` so
documentation-only changes use a narrower proof route.

A completed implementation pass is incomplete until the required
production-code handoff, check-only package/layer rerun, or
documentation-enforcement rerun has completed, or a concrete blocker has been
reported.

Public local proof entrypoints are:

- `tools/gradle/run-staged-verification.sh production-handoff`
  Aggregates the public production-code handoff route through assemble,
  all non-documentation production-code harness checks, the quality-hygiene
  tool owners, and CKJM reporting.
- `./gradlew checkDocumentationEnforcement --console=plain`
  Aggregates focused Markdown-backed architecture and enforcement-document
  coverage through `:build-harness:documentationEnforcementCheck` plus the
  coalesced per-surface documentation tasks registered inside build-harness.
Internal `verify*Bundle` selector tasks may still exist for typed harness
selection and internal ownership routing, but they are not public proof
entrypoints and must not replace the canonical production-handoff command
above. Canonical layer-surface tasks such as `checkViewEnforcement` may still
exist as technical diagnostics and focused local rerun points, but they are not
separate public production-code proof owners.
Build-harness topology and documentation metadata is coalesced by layer surface
and rule kind before Gradle execution; role-local owner metadata names are not
public or runnable proof entrypoints unless this document explicitly lists them
as utility gates.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`pmdStrictMain`, `checkRewriteNearMisses`, `rewriteDryRun`, `spotbugsMain`,
`cpdMain`, `lizardMain`, `ckjmMain`,
repository/resource policy checks, technical `check*Enforcement` layer
surfaces, and `checkDocumentationEnforcement`, each run through
`./gradlew <task> --console=plain`. Investigation tasks are not alternate
handoff entries.

## Runtime Wrapper Policy

For wrapper-based local runs, failure aggregation across independent gates is a
runtime-wrapper concern. `tools/gradle/run-observable-gradle.sh` adds Gradle
`--continue` to wrapper-based runs so long handoff and investigation runs
report the full current failure set without moving that policy into the
convention-plugin layer or reconstructing private task families in shell.
Callers that need first-failure diagnosis may pass wrapper option
`--fail-fast` before the task or staged surface name; the wrapper then omits
its default `--continue` and rejects a contradictory extra Gradle `--continue`.

By default, `production-handoff` inherits that wrapper-level `--continue`
behavior through the staged handoff route, so the canonical
implementation-handoff route reports the broader current failure set in one
run. The staged handoff still fails overall when any blocking dependency fails.
`tools/gradle/run-staged-verification.sh --fail-fast production-handoff`
preserves the same public staged surface while opting out of wrapper-level
failure aggregation for local diagnosis.
Direct raw `./gradlew` invocations remain explicit and only aggregate failures
when the caller passes `--continue`.

Additional Gradle investigation flags may be passed after `--`, but runtime
wrappers own invocation defaults such as `--console=plain`. If callers pass
wrapper-owned runtime flags again through the extra-args channel, the runtime
wrapper ignores them and logs the filtered arguments instead of forwarding
duplicate built-in Gradle options.

When Gradle startup fails with a known environment problem, the observable
runtime wrapper emits a post-failure diagnostic hint from the captured log. For
example, environments without required IPv4 bind support are reported as an
environment issue rather than a checker failure. This hint is not a pre-Gradle
socket preflight.

## Parallel Local Worktrees

Local Gradle gates support concurrent agent work through checkout separation,
not through wrapper-managed same-worktree isolation.

Parallel implementation work MUST use one linked git worktree plus one branch
per agent. The preferred local shape is:

1. create a linked worktree under `build/codex-worktrees/<topic>/`
2. create or switch to an agent-owned branch inside that worktree
3. implement and verify there with the normal public Gradle entrypoints
4. merge back into the repo-root `SaltMarcher/` checkout only after the
   required local verification surface is green
5. remove the temporary linked worktree and delete the temporary local branch
   once the verified result lives in the real local working tree

This keeps each agent's mutable `build/` and `.gradle/` state naturally scoped
to its own filesystem tree. The harness no longer creates per-invocation
`.gradle/isolated-runs/**` roots, synthetic included-build mirrors,
wrapper-published plugin repositories, generated descriptor snapshots, or
wrapper-owned retained-failure export surfaces.

The verification core still computes focused bundle selection during settings
evaluation and still registers the same technical layer surfaces,
`checkDocumentationEnforcement`, and staged lifecycle tasks. The included
builds and bundle descriptors are resolved directly from the active worktree
layout. Settings evaluation also publishes request-scope engine facts so a
focused task graph includes only the build-harness, quality-rules,
quality-rules-errorprone included builds, plus jQAssistant task registration,
that the selected surface can actually consume. This graph pruning does not
change the public proof route or the checks behind a requested surface.

`./gradlew` now uses Gradle's normal daemon behavior unless the caller
explicitly passes `--daemon` or `--no-daemon`.
`tools/gradle/run-observable-gradle.sh` and
`tools/gradle/run-staged-verification.sh` remain the preferred runtime wrappers
for observability and staged surface routing, but they no longer provide
parallel safety by rewriting Gradle cache or build directories.

Callers may still pass investigation-oriented extra args such as
`--rerun-tasks`, `--stacktrace`, `--info`, or `--scan`, while runtime wrappers
continue to own their invocation defaults and global wrapper-based
`--continue` default. `--fail-fast` remains a wrapper option, not a Gradle
extra argument.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, and the technical layer surfaces still require current compiled
classes; if `compileJava` fails, those entrypoints may be skipped because
their prerequisite failed.

Local blocking Gradle gates may finish `UP-TO-DATE` or `FROM-CACHE` when their
declared inputs and outputs are unchanged. That reuse comes from normal Gradle
behavior inside the active worktree.
Focused and documentation dry-run investigation may also use Gradle's
configuration cache when the selected graph is compatible. Broad
`production-handoff` remains uncached while OpenRewrite's `rewriteDryRun`
prevents configuration-cache storage; callers must report that as a
third-party task compatibility limit rather than as a weakened handoff route.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
