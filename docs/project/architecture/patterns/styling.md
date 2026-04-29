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

The matching mechanical owner document is
[Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-enforcement.md:1).

It defines the current blocking owners for:

- `styling-inline-setstyle-ban`
- `styling-centralized-stylesheet-placement`
- `styling-central-selector-definition`
- `styling-no-programmatic-visual-styling`

Review-only selector-vocabulary and direct-rendering semantic judgment stay in
that enforcement document as review-owned rules.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-enforcement.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
