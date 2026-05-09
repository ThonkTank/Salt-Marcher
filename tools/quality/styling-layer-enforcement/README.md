# Styling Layer Enforcement Bundle

This bundle co-locates the styling-layer checks that back
`docs/project/architecture/enforcement/styling-layer-enforcement.md`.

It keeps the full styling-layer proof route in one package:

- `errorprone/`
  `ViewProgrammaticStyling`
- `pmd/`
  `StylingInlineSetStyleBackchannelRule` and the bundle-local ruleset
- `tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/StandardEnforcementBundles.kt`
  typed bundle registry entry for the bundle's public task names and host wiring

The bundle keeps the canonical stylesheet owner proof local through
`checkStylingCentralStylesheetOwner`. Desktop packaging remains the owner of
the broader launcher/icon metadata policy outside styling.

Unified root entrypoint:

- `./gradlew checkStylingLayerEnforcement --rerun-tasks --console=plain`
