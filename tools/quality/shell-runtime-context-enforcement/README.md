# Shell RuntimeContext Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/shell-runtime-context-enforcement.md`.

It keeps the proof surface strict and owner-local:

- `pmd/`
  `ShellRuntimeContextGatewayShapeRule` and the dedicated single-rule PMD
  ruleset
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path
- `root-host.gradle.kts`
  root-project PMD task wiring and aggregate-task integration
- `pmd-host.gradle.kts`
  included-build wiring for the `quality-rules` host

This bundle proves only the fixed `ShellRuntimeContext` public gateway shape.
The remaining direct communication semantics for `inspector()`, `services()`,
and `session(...)` stay review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkShellRuntimeContextEnforcement --rerun-tasks --console=plain`
