Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Architecture of SaltMarcher's verification task graph.

# Verification Core Architecture

## Public Surface

`check` is the only required verification surface. `test`, `uiTest`, and
`architectureTest` are diagnostic views over the same test source set.
Shell wrappers and package-to-task routers are not part of the architecture.

## Ownership

- JUnit discovers scenarios and writes per-scenario XML results.
- JUnit package selection and tags distinguish architecture and UI diagnostics
  without extra source sets or registries.
- Monocle provides shared headless JavaFX execution.
- ArchUnit owns permanent dependency direction; root-level cycles; feature
  cycles; feature-role and adapter-role cycles; and first-level package cycles
  within ordinary and adapter roles across `app`, `shell`, `platform`, and
  `features`.
- Gradle owns task inputs, execution, and the `check` lifecycle.
- Retained analyzers must prove a distinct defect class.

Build logic may configure these mechanisms but must not maintain behavior-area
registries, aggregate task maps, handoff phases, verification markers, or a
second selection engine.

## References

- [Quality Platforms](../verification/quality-platforms.md)
