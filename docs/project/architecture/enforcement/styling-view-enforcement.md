Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-02
Source of Truth: Passive-`View`-specific direct-render styling invariants for
surfaces that must style JavaFX rendering primitives without inventing a local
visual system.

# View Styling Enforcement

## Goal

This document owns the passive-`View`-specific direct-render styling
invariants only.

It answers three questions for passive `*View.java` files that style
direct-rendered JavaFX surfaces:

- when the role MAY contain direct-render styling code at all
- which direct-render styling content the role MUST NOT contain
- how the role MAY communicate with centralized styling truth

This document does not own stylesheet-file placement, selector vocabulary,
generic Java-to-CSS communication rules, or the broader active-code ban on
programmatic style-value construction. Those stay in the dedicated
[Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
document.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-view-direct-render-javafx-rendering-apis-only-for-non-css-surfaces` | Enforced | a passive `*View` must style a direct-rendered JavaFX surface such as `Canvas`, `GraphicsContext`, or shape drawing that a stylesheet selector cannot express directly | Error Prone `ViewDirectRenderStylingPlacement` | `./gradlew checkStylingEnforcement` and `./gradlew check` | A passive `View` may contain JavaFX paint, font, or stroke styling code only for the documented direct-render exception. Ordinary node styling still belongs to centralized stylesheet selectors. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-view-direct-render-no-local-visual-system` | Review-Owned | a direct-rendered passive `View` uses JavaFX paint, font, or stroke APIs because no stylesheet selector can express the rendering surface | none | none | Even inside the direct-render exception, the passive `View` does not contain a locally invented palette, typography system, stroke vocabulary, or other replacement visual truth. Semantic colors, typography, and related visual meaning stay centralized. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-view-direct-render-central-value-consumption-only` | Review-Owned | a direct-rendered passive `View` must style a rendering surface through JavaFX graphics APIs | none | none | A direct-rendered surface communicates with centralized styling only by consuming centrally owned visual values; it does not create an alternate local styling system through ad-hoc colors, gradients, fonts, or stroke conventions. |

## Candidate

- proving direct-rendered value derivation mechanically if the repository
  adopts a stable central token API or other explicit non-CSS bridge for
  canvas-only styling surfaces
- widening the direct-render allowlist beyond the currently documented
  `DungeonMapView` and `HexMapMainView` exceptions without falling back to a
  broad package-level carve-out

## References

- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1)
