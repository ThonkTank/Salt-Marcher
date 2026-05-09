# Shell RuntimeContext Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/shell-runtime-context-enforcement.md`.

It keeps the proof surface strict and owner-local:

- `pmd/`
  `ShellRuntimeContextGatewayShapeRule` and the dedicated single-rule PMD
  ruleset
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle proves only the fixed `ShellRuntimeContext` public gateway shape.
The remaining direct communication semantics for `inspector()`, `services()`,
and `session(...)` stay review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkShellRuntimeContextEnforcement --rerun-tasks --console=plain`
