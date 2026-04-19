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

- Stylesheet files must live directly under `resources/`.
- Active application code under `bootstrap/`, `shell/`, and `src/` must not use
  `setStyle(...)`.
- View code should express presentation through style classes and shared
  selectors in the central stylesheet set.
- Active application code outside the documented canvas-rendering exception
  must not author visual styling through JavaFX paint, font, border, or
  background APIs.

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for styling checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1).

- `Enforced`
  - `styling-inline-setstyle-ban`: active application code under `bootstrap/`,
    `shell/`, and `src/` must not use `setStyle(...)` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`).
  - `styling-centralized-stylesheet-placement`: stylesheet files for active
    code must live directly under `resources/` via Gradle-owned verification
    tasks (`./gradlew checkCentralizedStylesheets`).
  - `styling-central-selector-definition`: style classes used from active Java
    code must resolve to selectors defined in centralized `resources/*.css`
    files via Gradle-owned verification tasks
    (`./gradlew checkDefinedStyleClassSelectors`). The mechanical scope is
    direct `getStyleClass()` string literals plus string-literal selector
    arguments passed through recognized helper methods that forward parameters
    into `getStyleClass()`.
  - `styling-no-programmatic-visual-styling`: active application code outside
    `src/view/mapshared/View/**` must not author visual styling through
    JavaFX paint, font, border, background, or direct canvas styling APIs via
    `Error Prone` (`./gradlew compileJava`).
- `Review-Only`
  - `styling-shared-selector-vocabulary`: whether a newly introduced selector
    is genuinely shared presentation vocabulary rather than a needless
    one-off name remains review-owned even when the selector is centrally
    defined and mechanically resolvable.
  - Runtime-computed selector names that are not visible as Java string
    literals remain review-owned.

The documented direct-rendering exception is limited to
`src/view/mapshared/View/**`, where the shared canvas renderer currently owns
the original Salt Marcher map palette directly instead of routing those values
through stylesheet selectors.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
