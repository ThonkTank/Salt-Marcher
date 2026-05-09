# Shell AppShell Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/shell-app-shell-enforcement.md`.

It keeps the proof surface strict and owner-local:

- `errorprone/`
  `ShellLifecycleHookOwnership`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle currently proves only shell-owned lifecycle-hook invocation.
The remaining `AppShell` hosting, registration, and layout semantics stay
review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkShellAppShellEnforcement --rerun-tasks --console=plain`
