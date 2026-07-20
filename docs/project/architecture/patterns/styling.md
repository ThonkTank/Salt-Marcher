Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Centralized JavaFX styling rules.

# Styling Standard

## Goal

SaltMarcher styling is authored centrally so feature code does not carry its
own inline presentation system.

## Rules

- Approved application style rules and shared selector vocabulary live in
  `resources/salt-marcher.css`.
- `app` applies shared application styling from that stylesheet.
- Active application code under `app/`, `shell/`, `platform/`, and `features/`
  expresses ordinary node styling through explicit centralized style-class
  selectors.
- Active application code must not use `setStyle(...)`.
- Passive views must not author ordinary node layout styling through local
  padding, spacing, gap, or fixed visual-size setters.
- Direct rendering is allowed for surfaces such as canvas drawing where CSS
  selectors cannot express the rendered pixels directly.
- Direct-rendered values should still be derived from centralized styling truth
  rather than a local visual system.

## Verification

Architecture review rejects styling outside these target boundaries. Any
automated checker for them must inspect target capabilities directly and must
not infer architecture from legacy paths or class-name forms.

## References

- [Source Architecture](../source-architecture.md)
- [Quality Platforms Standard](../../verification/quality-platforms.md)
