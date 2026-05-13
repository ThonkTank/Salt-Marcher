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

`check` includes:

- Java compilation through `compileJava`
- the public architecture aggregate `checkArchitecture`
- repository and resource policy checks
- PMD source-smell detection through `pmdMain`
- OpenRewrite dry-run near-miss checks through `checkRewriteNearMisses`
- SpotBugs plus FindSecBugs through `spotbugsMain`
- duplicate-code detection through `cpdMain`
- cyclomatic-complexity detection through `lizardMain`
- OO-metric regression reporting through `ckjmMain`

The shared owner list behind `check` is the same typed verification lifecycle
catalog used by `production-handoff`; root build scripts must not add those
owners separately.

`pmdMain` and `spotbugsMain` are central blocking gates and may also be run as
focused direct entrypoints. `pmdStrictMain` remains the focused text-first PMD
entrypoint for the same blocking ruleset.

## Public Handoff Routes

`tools/gradle/run-staged-verification.sh production-handoff` is the default
implementation-handoff route required by `AGENTS.md` for production-code
changes. The wrapper is runtime-only: it forwards the canonical surface name to
one same-named Gradle lifecycle task, and the verification core expands
`production-handoff` directly through the same typed lifecycle catalog used by
`check`: assemble, `test`, `checkArchitecture`, the quality-hygiene tool
owners, and CKJM reporting inside Gradle.

For check-only implementation work limited to concrete enforcement packages or
verification-only wiring under `tools/**`, `build.gradle.kts`, or
`settings.gradle.kts`, the required handoff proof is the corresponding focused
package task or canonical layer surface instead of the full build. When shared
verification wiring changes but the pass stays check-only, rerun the focused
entrypoints for the affected packages.

`./gradlew checkDocumentationEnforcement --console=plain` is the focused
`Blocking Local Gate` for Markdown-backed architecture and enforcement
documentation checks. It is intentionally outside `check` and `build` so
documentation-only changes use a narrower proof route.

A completed implementation pass is incomplete until the required
production-code handoff, check-only package/layer rerun, or
documentation-enforcement rerun has completed, or a concrete blocker has been
reported.

Architecture-focused and handoff public entrypoints are:

- `./gradlew checkArchitecture --console=plain`
  Aggregates the public architecture surface through the canonical layer
  surfaces, `architectureTest`, and `:build-harness:architectureCheck`.
- `tools/gradle/run-staged-verification.sh production-handoff`
  Aggregates the public production-code handoff route through assemble,
  `test`, `checkArchitecture`, the quality-hygiene tool owners, and CKJM
  reporting.
- `./gradlew checkDocumentationEnforcement --console=plain`
  Aggregates focused Markdown-backed architecture and enforcement-document
  coverage through `:build-harness:documentationEnforcementCheck`.
- `./gradlew checkViewEnforcement --console=plain`
  Aggregates the canonical View enforcement surface through the closed-world
  View topology owner plus the shared Error Prone View core.
- `./gradlew checkDomainEnforcement --console=plain`
  Aggregates the canonical Domain enforcement surface through the Domain
  Context, Layer, UseCase, ApplicationService, Published, Port, Model, Helper,
  Constants, and Repository bundles.
- `./gradlew checkDataEnforcement --console=plain`
  Aggregates the canonical Data enforcement surface through the Data Layer,
  Model, Gateway, Mapper, Persistencecore, Query, Repository, and
  ServiceContribution bundles.
- `./gradlew checkShellEnforcement --console=plain`
  Aggregates the canonical Shell enforcement surface through the
  `ShellRuntimeContext`, `AppShell`, and Shell Layer bundles.
- `./gradlew checkBootstrapEnforcement --console=plain`
  Aggregates the canonical Bootstrap enforcement surface through the
  `AppBootstrap` and Bootstrap Layer bundles.
- `./gradlew checkStylingEnforcement --console=plain`
  Aggregates the canonical Styling enforcement surface through the
  styling-layer and passive-`View` direct-render styling bundles.
- `./gradlew checkLayeringEnforcement --console=plain`
  Aggregates the canonical Layering enforcement surface through the blocker
  Layering Architecture bundle.

Internal `verify*Bundle` selector tasks may still exist for typed harness
selection and internal ownership routing, but they are not public proof
entrypoints and must not replace the canonical layer-surface commands above.
The same rule applies to internal build-harness topology tasks whose technical
names still begin with `check*`.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`pmdStrictMain`, `checkRewriteNearMisses`, `rewriteDryRun`, `spotbugsMain`,
`cpdMain`, `lizardMain`, `ckjmMain`,
repository/resource policy checks, `checkArchitecture`, the canonical
`check*Enforcement` layer surfaces, and `checkDocumentationEnforcement`, each
run through `./gradlew <task> --console=plain`.

## Runtime Wrapper Policy

For wrapper-based local runs, failure aggregation across independent gates is a
runtime-wrapper concern. `tools/gradle/run-observable-gradle.sh` adds Gradle
`--continue` to wrapper-based runs so long handoff and investigation runs
report the full current failure set without moving that policy into the
convention-plugin layer or reconstructing private task families in shell.

By default, `production-handoff` inherits that wrapper-level `--continue`
behavior through the staged handoff route, so the canonical
implementation-handoff route reports the broader current failure set in one
run. The staged handoff still fails overall when any blocking dependency fails.
Direct raw `./gradlew` invocations remain explicit and only aggregate failures
when the caller passes `--continue`.

Additional Gradle investigation flags may be passed after `--`, but runtime
wrappers own invocation defaults such as `--console=plain`. If callers pass
wrapper-owned runtime flags again through the extra-args channel, the runtime
wrapper ignores them and logs the filtered arguments instead of forwarding
duplicate built-in Gradle options.

Before Gradle starts, the staged wrapper performs a local-socket runtime
preflight so environments without required IPv4 bind support fail early with
an explicit runtime diagnostic instead of surfacing a late internal Gradle
startup error.

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
evaluation and still registers the same public layer surfaces,
`checkDocumentationEnforcement`, and staged lifecycle tasks. The included
builds and bundle descriptors are resolved directly from the active worktree
layout.

`./gradlew` now uses Gradle's normal daemon behavior unless the caller
explicitly passes `--daemon` or `--no-daemon`.
`tools/gradle/run-observable-gradle.sh` and
`tools/gradle/run-staged-verification.sh` remain the preferred runtime wrappers
for observability and staged surface routing, but they no longer provide
parallel safety by rewriting Gradle cache or build directories.

Callers may still pass investigation-oriented extra args such as
`--rerun-tasks`, `--stacktrace`, `--info`, or `--scan`, while runtime wrappers
continue to own their invocation defaults and global wrapper-based
`--continue` policy.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, and the public layer surfaces still require current compiled
classes; if `compileJava` fails, those entrypoints may be skipped because
their prerequisite failed.

Local blocking Gradle gates may finish `UP-TO-DATE` or `FROM-CACHE` when their
declared inputs and outputs are unchanged. That reuse comes from normal Gradle
behavior inside the active worktree.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Verification Core Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/verification-core.md:1)
