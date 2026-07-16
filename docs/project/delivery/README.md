Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Target: [Source Architecture](../architecture/source-architecture.md)

# Architecture Migration Delivery

Goal: Replace the horizontal source architecture with the explicit,
non-blocking vertical feature modular monolith defined by the target owner.

Finish: only `app`, `shell`, `platform`, and `features` remain as production
Java roots; feature collaboration uses provider APIs; explicit composition,
versioned SQLite recovery, local diagnostics, green CI, independent review, and
owner acceptance are complete; this file is deleted.

Current tree: `codex/greenfield-r1-explicit-composition` at R1 Explicit
Composition. R0 Rule Cutover is merged by PR #471 at `869e14566`.

R1 candidate: `AppBootstrap` owns one deterministic manifest and wires
feature-owned typed components into passive constructor-injected shell
contributions. The four classpath-discovery helpers, sixteen service
contributions, `ServiceRegistry`, and `ShellRuntimeContext` are deleted. Tests
exercise the same production assemblies and exact startup manifest. Horizontal
package moves remain owned by R4.

Current proof: `git diff --cached --check` passes with no output. The direct
panel's supported behavior, documentation, and cross-feature boundary findings
are repaired. Provider-owned typed read APIs preserve the failing-provider
no-write route; focused tests are `BUILD SUCCESSFUL in 12s`, and the exact full
`check` is `BUILD SUCCESSFUL in 3m 13s` with one task executed. The focused
architecture review of that exact boundary is clean; R1 is publication-ready.

Publication gate: `git diff --cached --check`, literal green full `./gradlew
check --console=plain`, and a clean independent review of that exact staged
state. Push and merge only after required PR CI is green.

Next action: publish R1, then start R2 from updated `main`.
