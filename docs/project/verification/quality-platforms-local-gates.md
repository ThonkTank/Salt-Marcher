Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Detailed local gate inventory for retained SaltMarcher
quality-platform gates.

# Quality Platforms Local Gates

## Purpose

This subordinate standard lists retained local quality gates beneath the
[Quality Platforms Standard](quality-platforms.md). Public aggregate
entrypoints live in
[Quality Platforms Local Entrypoints](quality-platforms-local-entrypoints.md).

## Compiler And Structure

- `./gradlew compileJava` owns production Java compilation.
- `./gradlew compileTestJava` owns test and architecture-test compilation when
  selected by a public route.
- `./gradlew architectureTest` is a focused diagnostic for retained
  architecture tests such as package cycles and layer dependency direction.
- `./gradlew checkNoDeadCode` owns whole-program reachability for compiled
  production declarations.

These tasks are normally consumed through `production-handoff` for handoff
claims.

## Source Quality

- `./gradlew pmdMain` produces PMD XML/HTML reports.
- `./gradlew pmdStrictMain` is the blocking PMD text-first handoff gate.
- `./gradlew spotbugsMain` is the blocking bytecode bug and security-smell
  gate.
- `./gradlew cpdMain` is the blocking duplicate-code gate.
- `./gradlew lizardMain` is the blocking cyclomatic-complexity gate.
- `./gradlew ckjmMain` is an informational OO-metrics report.
- `./gradlew checkRewriteNearMisses` runs retained first-party near-miss
  checks.

PMD owns generic non-architecture source smells and metrics. It must not be
used to reintroduce role-family form enforcement.

## Repository And Resource Policy

Retained blocking gates include centralized stylesheet ownership, selector
resolution, manual node styling checks, compiled-artifact hygiene, desktop
packaging inputs, desktop app image layout, and FXML resource checks where
those tasks are part of the current Gradle graph.

The styling standard owns centralized CSS rules. The retired architecture
enforcement inventory no longer owns a separate documentation route for these
checks.

## References

- [Quality Platforms Standard](quality-platforms.md)
- [Quality Platforms Local Entrypoints](quality-platforms-local-entrypoints.md)
- [Styling Standard](../architecture/patterns/styling.md)
