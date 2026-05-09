# Styling View Enforcement Bundle

This bundle co-locates the passive-`View`-specific styling checks that back
`docs/project/architecture/enforcement/styling-view-enforcement.md`.

It keeps the current proof surface intentionally narrow and honest:

- `errorprone/`
  `ViewDirectRenderStylingPlacement` plus the bundle-local
  `ViewDirectRenderStylingSupport`
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

This bundle currently proves only the placement rule for the documented
direct-render exception. The remaining "no local visual system" and
"central-value consumption" semantics stay review-owned until SaltMarcher has a
mechanical central-token or equivalent proof surface for direct-render styling.

Unified root entrypoint:

- `./gradlew checkStylingViewEnforcement --rerun-tasks --console=plain`
