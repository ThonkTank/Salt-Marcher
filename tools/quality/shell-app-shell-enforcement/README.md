# Shell AppShell Enforcement Bundle

This bundle co-locates the currently active SaltMarcher checks that back
`docs/project/architecture/enforcement/shell-app-shell-enforcement.md`.

It keeps the proof surface strict and owner-local:

- `errorprone/`
  `ShellLifecycleHookOwnership`
- `bundle.properties`
  descriptor-based registration into the focused-enforcement Gradle path

This bundle currently proves only shell-owned lifecycle-hook invocation.
The remaining `AppShell` hosting, registration, and layout semantics stay
review-owned in the owning enforcement document.

Unified root entrypoint:

- `./gradlew checkShellAppShellEnforcement --rerun-tasks --console=plain`
