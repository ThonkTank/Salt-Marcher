# Styling Layer Enforcement Bundle

This bundle co-locates the styling-layer checks that back
`docs/project/architecture/enforcement/styling-layer-enforcement.md`.

It keeps the full styling-layer proof route in one package:

- `errorprone/`
  `ViewProgrammaticStyling`
- `pmd/`
  `StylingInlineSetStyleBackchannelRule` and the bundle-local ruleset
- `bundle.properties`
  canonical registration source for the bundle's public task name and host
  script/source-set wiring
  PMD, and
  aggregate-task wiring

The bundle keeps the canonical stylesheet owner proof local through
`checkStylingCentralStylesheetOwner`. Desktop packaging remains the owner of
the broader launcher/icon metadata policy outside styling.

Unified root entrypoint:

- `./gradlew checkStylingLayerEnforcement --rerun-tasks --console=plain`
