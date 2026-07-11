Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Public aggregate entrypoints, staged handoff routing, and
local invocation policy for SaltMarcher quality platforms.

# Quality Platforms Local Entrypoints

## Public Handoff Routes

`tools/gradle/run-staged-verification.sh production-handoff` is the default
implementation-handoff route for production-code and shared verification
wiring changes. The wrapper routes to Gradle's `production-handoff` lifecycle
task after project-health debt intake.

`tools/gradle/run-staged-verification.sh focused-handoff --path
<repo-package-or-resource-dir> [--area <area>] [--with compile-integrity]` is
the scoped local route for narrow package/resource work. It is valid only when
the selected focused scope is non-empty and the selected engines actually
consume that scope.

Documentation-only and instruction-surface changes use `git diff --check` plus
any owner-named proof from `AGENTS.md`; removed documentation gates are not
public local entrypoints.

Public handoff claims must cite the literal command result and selected scope.
Private diagnostics and raw Gradle task runs do not replace the public route
required by `AGENTS.md`.

## Central Aggregate

`./gradlew check --console=plain` remains the conventional local build-health
aggregate. It routes through the production handoff graph instead of owning a
second production-check graph.

## Focused Investigation

Direct Gradle tasks such as `compileJava`, `pmdStrictMain`, `spotbugsMain`,
`cpdMain`, `lizardMain`, `ckjmMain`, `checkRewriteNearMisses`,
`checkNoDeadCode`, `architectureTest`, repository/resource policy tasks, and
behavior harnesses are investigation or focused proof tools. They may support a
repair but are not alternate production-handoff entries.

## Runtime Wrapper Policy

`tools/gradle/run-observable-gradle.sh` wraps one Gradle invocation with
observable logging, elapsed-time readback, task-count readback, and
configuration-cache readback when Gradle prints it. Wrapper-based runs default
to Gradle `--continue`; callers may pass wrapper option `--fail-fast` for
first-failure diagnosis.

The wrappers must not map areas or paths to private diagnostic task names.
Gradle-owned verification-core wiring selects the actual internal dependencies.

## Local Concurrent Work

Local Gradle gates do not provide same-checkout isolation. When multiple agents
share one checkout, the caller owns disjoint write sets, serialized edits to
shared files, and literal verification reporting for the changed surface.

## References

- [Quality Platforms Standard](quality-platforms.md)
- [Quality Platforms Local Gates](quality-platforms-local-gates.md)
- [Verification Core Architecture](../architecture/verification-core.md)
