# Documentation Enforcement Bundle

This bundle co-locates the SaltMarcher checks that read canonical Markdown
architecture and enforcement documents.

It separates documentation-owned enforcement from the normal build path while
keeping the rest of the architecture harness unchanged.

Current scope:

- `build-harness/`
  broad domain/data enforcement-coverage checks plus the umbrella loader for
  bundle-local Markdown enforcement rules when those focused bundles are active
- `root-host.gradle.kts`
  root-project entrypoint wiring for the focused documentation gate
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkDocumentationEnforcement --rerun-tasks --console=plain`
