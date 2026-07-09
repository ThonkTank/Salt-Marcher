Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Centralized JavaFX styling rules.

# Styling Standard

## Goal

SaltMarcher styling is authored centrally so feature code does not carry its
own inline presentation system.

## Rules

- Approved application style rules and shared selector vocabulary live in
  `resources/salt-marcher.css`.
- Bootstrap applies shared application styling from that stylesheet.
- Active application code under `bootstrap/`, `shell/`, and `src/` expresses
  ordinary node styling through explicit centralized style-class selectors.
- Active application code must not use `setStyle(...)`.
- Passive views must not author ordinary node layout styling through local
  padding, spacing, gap, or fixed visual-size setters.
- Direct rendering is allowed for surfaces such as canvas drawing where CSS
  selectors cannot express the rendered pixels directly.
- Direct-rendered values should still be derived from centralized styling truth
  rather than a local visual system.

## Verification

The retained public proof route is `production-handoff`; individual styling
tasks remain implementation diagnostics when present in the Gradle graph.

## References

- [Architecture Overview](../overview.md)
- [Quality Platforms Standard](../../verification/quality-platforms.md)
