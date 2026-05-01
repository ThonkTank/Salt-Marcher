# Styling View Enforcement Bundle

This bundle co-locates the passive-`View`-specific styling checks that back
`docs/project/architecture/enforcement/styling-view-enforcement.md`.

It keeps the current proof surface intentionally narrow and honest:

- `errorprone/`
  `ViewDirectRenderStylingPlacement`
- `bundle.properties`
  canonical registration source for this bundle's public task name and host
  script/source-set wiring
- `root-host.gradle.kts`
  root-project compiler and aggregate-task wiring
- `errorprone-host.gradle.kts`
  included-build wiring for the `quality-rules-errorprone` host

This bundle currently proves only the placement rule for the documented
direct-render exception. The remaining "no local visual system" and
"central-value consumption" semantics stay review-owned until SaltMarcher has a
mechanical central-token or equivalent proof surface for direct-render styling.

Unified root entrypoint:

- `./gradlew checkStylingViewEnforcement --rerun-tasks --console=plain`
