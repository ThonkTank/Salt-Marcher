# ADR 006: jQAssistant Owns MVCI Enforcement

- Status: Accepted
- Date: 2026-04-18

## Context

SaltMarcher's MVCI rules had been split across `ArchUnit`, Error Prone, and
`build-harness`. That fragmented ownership duplicated violations, forced the
team to maintain the same policy in multiple technical forms, and made view
topology rules harder to evolve together with dependency rules.

The view-layer standard now expects one rule owner for MVCI boundaries,
cross-component presentation reuse, and view topology contracts.

## Decision

SaltMarcher assigns mechanical MVCI enforcement exclusively to `jQAssistant`.

- `jQAssistant` runs as the blocking Gradle task `checkMvci`.
- `checkMvci` is part of the local `./gradlew check` aggregate.
- SaltMarcher-specific MVCI rules live in
  `tools/quality/jqassistant/rules/` and are configured by
  `tools/quality/jqassistant/config.yml`.
- The rule model is expressed through SaltMarcher concepts first, then
  constraints:
  - `SaltMarcher:ViewComponent`
  - `SaltMarcher:MvciBucket`
  - `SaltMarcher:SharedViewComponent`
  - `SaltMarcher:RootEntrypoint`
  - `SaltMarcher:AssemblyClass`
  - `SaltMarcher:SceneGraphTypeUsage`
  - `SaltMarcher:DomainApiDependency`
- New MVCI rules that are documented before they are mechanized remain
  review-owned until they are added to `checkMvci`. They do not get split back
  across `ArchUnit`, Error Prone, or `build-harness`.

`ArchUnit`, Error Prone, and `build-harness` no longer own MVCI checks. They
may continue to own non-MVCI rules.

## Consequences

- MVCI dependency direction, cross-component boundaries, and view topology are
  enforced or planned for enforcement in one rule engine and reported through
  one failure channel.
- Existing MVCI violations now fail through `checkMvci` only, instead of
  appearing multiple times through different tools.
- `build-harness` keeps repository and persistence topology checks, but no
  longer owns view-bucket placement, view root entrypoint count, or assembly
  placement rules.
- Error Prone remains for compiler-facing quality checks such as `NullAway`,
  but not for MVCI.
- The stronger passive-view rules in the view MVCI standard must be added to
  `checkMvci` over time instead of being reinterpreted by secondary tools.

## Alternatives Considered

### Keep the split MVCI ownership

Rejected because the same SaltMarcher MVCI policy would continue to be
implemented and debugged in three different rule systems.

### Move MVCI into only one existing rule owner like `ArchUnit` or `build-harness`

Rejected because SaltMarcher needs one engine that can express both Java
dependency rules and file/path/topology rules against one shared model.

## Related Documents

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [View MVCI Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/view-mvci.md:1)
