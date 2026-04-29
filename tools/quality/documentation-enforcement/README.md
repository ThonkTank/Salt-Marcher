# Documentation Enforcement Bundle

This bundle co-locates the SaltMarcher checks that read canonical Markdown
architecture and enforcement documents.

It separates documentation-owned enforcement from the normal build path while
keeping the rest of the architecture harness unchanged.

Current scope:

- `build-harness/`
  domain context documentation checks, domain-layer standard context-map
  coverage checks, and enforcement-coverage matrix checks for domain and data
- `root-host.gradle.kts`
  root-project entrypoint wiring for the focused documentation gate
- `build-harness-host.gradle.kts`
  included-build wiring for the `build-harness` host

Unified root entrypoint:

- `./gradlew checkDocumentationEnforcement --rerun-tasks --console=plain`
