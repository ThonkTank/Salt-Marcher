Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Centralized JavaFX styling rules and blocking checks for active
application code.

# Styling Standard

## Goal

SaltMarcher styling must be authored centrally so feature code does not carry
its own inline presentation rules.

## Rules

- Approved application style rules must live in `resources/salt-marcher.css`.
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

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for styling checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).

- `Enforced`
  - `styling-inline-setstyle-ban`: active application code under `bootstrap/`,
    `shell/`, and `src/` must not use `setStyle(...)` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`).
  - `styling-centralized-stylesheet-placement`: stylesheet files for active
    code must be centralized in `resources/salt-marcher.css` via Gradle-owned
    verification tasks (`./gradlew checkCentralizedStylesheets`).
  - `styling-central-selector-definition`: style classes used from active Java
    code must resolve to selectors defined in `resources/salt-marcher.css` via
    Gradle-owned verification tasks
    (`./gradlew checkDefinedStyleClassSelectors`). The mechanical scope is
    direct `getStyleClass()` string literals plus string-literal selector
    arguments passed through recognized helper methods that forward parameters
    into `getStyleClass()`. Dynamically concatenated selector names are
    rejected because the checker cannot prove that they come from centralized
    selector vocabulary.
  - `styling-no-programmatic-visual-styling`: active application code must not
    define visual style values through JavaFX color, paint, font, border, or
    background factories or static style-value constants via `Error Prone`
    (`./gradlew compileJava`). Direct rendering APIs are allowed when their
    visual values come from `resources/salt-marcher.css`.
- `Review-Only`
  - `styling-shared-selector-vocabulary`: whether a newly introduced selector
    is genuinely shared presentation vocabulary rather than a needless
    one-off name remains review-owned even when the selector is centrally
    defined and mechanically resolvable.
  - Whether a direct-rendered View maps central stylesheet values to the right
    visual semantics remains review-owned after the checker proves that the
    values are not authored locally.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
