# ADR 003: Architecture Rule Ownership By Enforcement Layer

Superseded in part by [ADR 006: jQAssistant Owns MVCI Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/006-jqassistant-owns-mvci-enforcement.md:1)
for MVCI-specific ownership. This ADR still describes the non-MVCI split
between `ArchUnit`, `PMD`, and `build-harness`.

- Status: Accepted
- Date: 2026-04-17

## Context

SaltMarcher had a growing mix of architecture rules, but the enforcement
ownership was blurred. The custom `build-harness` checker carried repository
layout checks, source-text bans, entrypoint contracts, slot rules, and even
cross-feature boundary rules. That made the harness harder to maintain and
duplicated responsibilities that fit better into established Java tooling.

At the same time, the standards documentation described rules without always
making it clear which rules were compile-enforced and which still depended on
review.

## Decision

SaltMarcher assigns each architecture rule to one primary enforcement layer:

- `ArchUnit` owns bytecode-visible dependency and API-boundary rules.
- `PMD architecture` owns Java source-level conventions and forbidden usage
  patterns.
- `build-harness` owns repository topology, package-path alignment, and
  documentation-correlated root-entrypoint presence checks.
- Review remains the owner for rules that are not yet expressible cleanly in
  those layers.

The blocking aggregate task is `checkArchitecture`, which runs:

- `architectureTest`
- `pmdArchitectureMain`
- `:build-harness:check`

## Consequences

- Architecture checks are easier to locate and maintain because each rule type
  has one technical owner.
- `build-harness` becomes smaller and more stable because it no longer models
  dependency direction or source-policy bans.
- Standards documents must name the owning gate explicitly when they claim a
  rule is enforced.
- Some rules, such as positive `ShellRuntimeContext.persistence()` and
  `ShellRuntimeContext.inspector()` usage preferences, remain review-only until
  a dedicated check is worth the cost.

## Alternatives Considered

### Keep all architecture rules inside `build-harness`

Rejected because source-text and dependency logic become harder to maintain
than the equivalent `ArchUnit` and `PMD` rules.

### Introduce Semgrep or Error Prone plugins for all architecture rules

Rejected for v1 because SaltMarcher already uses `ArchUnit`, `PMD`, and Gradle,
and the incremental value of another rule platform did not justify the extra
tooling surface.

### Move to JPMS-based enforcement

Rejected because it would require a larger packaging and module-graph redesign
than the current project needs.

## Related Documents

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
