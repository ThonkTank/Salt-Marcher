Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Centralized JavaFX styling rules and their matching layer-wide
and passive-`View`-specific ownership.

# Styling Standard

## Goal

SaltMarcher styling must be authored centrally so feature code does not carry
its own inline presentation rules.

## Rules

- Approved application style rules and shared selector vocabulary must live in
  `resources/salt-marcher.css`.
- When desktop launch framing applies shared application styling, bootstrap
  must load that styling from `resources/salt-marcher.css`.
- Active application code under `bootstrap/`, `shell/`, and `src/` must
  express ordinary node styling through explicit centrally owned style-class
  selectors. Dynamic selector construction is forbidden.
- Active application code under `bootstrap/`, `shell/`, and `src/` must not use
  `setStyle(...)`.
- View code should express presentation through style classes and shared
  selectors in the central stylesheet set.
- Direct rendering in passive Views is allowed, including `Canvas`,
  `GraphicsContext`, and shape drawing.
- Active application code must not author replacement visual values in Java.
  Colors, fonts, text sizes, borders, strokes, spacing, radii, and semantic
  variants remain centralized in `resources/salt-marcher.css`.
- Direct-rendered Views may apply JavaFX paint, font, and stroke APIs only with
  values derived from centralized stylesheet rules, not with locally constructed
  palettes or typography constants.

## Verification Notes

The matching owner documents are
[Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
and
[View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1).

The layer document owns the centralized stylesheet owner, selector vocabulary,
bootstrap stylesheet-loading seam, and generic active-code communication rules
for ordinary node styling. The view-specific document owns the passive-`View`
direct-render exception and its remaining non-CSS semantics.

The current blocking proof surfaces are `checkCentralizedStylesheets`,
`checkDefinedStyleClassSelectors`, `checkDesktopPackagingInputs`,
`pmdArchitectureMain`, and `compileJava`. These are layer-wide proof surfaces.
The passive-`View` direct-render semantics remain review-owned until the
repository adopts a dedicated role-specific proof surface. `ViewProgrammaticStyling`
remains a broader active-code proof surface rather than a dedicated passive-`View`
styling bundle.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
- [View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
