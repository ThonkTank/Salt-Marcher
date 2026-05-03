# Documentation Enforcement Bundle

This bundle co-locates the SaltMarcher checks that read canonical Markdown
architecture and enforcement documents.

It separates documentation-owned enforcement from the normal build path while
keeping the rest of the architecture harness unchanged.

Current scope:

- `build-harness/`
  broad domain/data enforcement-coverage checks plus the umbrella loader for
  bundle-local Markdown enforcement rules when those focused bundles are active

Unified root entrypoint:

- `./gradlew checkDocumentationEnforcement --rerun-tasks --console=plain`
