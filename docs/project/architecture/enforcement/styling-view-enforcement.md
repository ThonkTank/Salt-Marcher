Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete styling-invariant catalog for passive `*View`
surfaces that must style direct-rendered JavaFX surfaces without inventing a
local visual system.

# View Styling Enforcement

## Goal

This document owns the complete styling enforcement catalog for passive
`*View` surfaces themselves.

It answers three questions for passive `*View.java` files that style
direct-rendered JavaFX surfaces:

- which direct-render styling shortcuts the role MUST NOT take
- which remaining centralized-styling expectations are mechanically proven
- which direct-render styling semantics are still review-owned

This document does not own stylesheet-file placement, selector vocabulary,
generic Java-to-CSS communication rules, or non-view active-code styling bans.
Those stay in the dedicated
[Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
document.

## Invariant Catalog

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-view-direct-render-no-blocked-local-style-values` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` that authors direct-rendered JavaFX surfaces | Error Prone `ViewProgrammaticStyling` | `./gradlew compileJava` | Passive `View` direct-render code does not construct the currently blocked local style values such as background, border, gradient, color, paint, or font definitions, and does not keep blocked static style-value constants. This is a broader active-code proof rather than a dedicated view-only styling bundle. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-view-direct-render-central-visual-truth-required` | Review-Owned | a direct-rendered passive `View` uses JavaFX paint, font, or stroke APIs because no stylesheet selector can express the rendering surface | none | none | Even in direct-rendered surfaces, the semantic color, typography, stroke, and related visual truth still comes from centralized styling ownership rather than from a locally invented palette or typography system. |
| `styling-view-direct-render-central-value-consumption-only` | Review-Owned | a direct-rendered passive `View` must style a rendering surface through JavaFX graphics APIs | none | none | A direct-rendered surface communicates with centralized styling only by consuming centrally owned visual values; it does not create an alternate local styling system through ad-hoc colors, gradients, fonts, or stroke conventions. |

## Candidate

- proving direct-rendered value derivation mechanically if the repository
  adopts a stable central token API or other explicit non-CSS bridge for
  canvas-only styling surfaces

## References

- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
