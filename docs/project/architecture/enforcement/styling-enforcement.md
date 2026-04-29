Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for centralized
JavaFX styling ownership, selector vocabulary, and styling-specific
communication seams in active SaltMarcher code.

# Styling Enforcement

## Goal

This document owns the complete styling-layer invariant catalog for active
SaltMarcher code under `bootstrap/`, `shell/`, `src/`, and `resources/`.

It answers three styling-layer questions:

- what the styling layer MUST contain, and when
- what the styling layer MUST NOT contain, and when
- how active code MAY and MUST NOT communicate with centralized styling truth

This document owns only styling-layer invariants. It does not own passive
`View` legality, Binder/input-event protocols, bootstrap feature-independence,
or desktop packaging policy except where those neighboring surfaces also prove a
styling invariant documented here.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-central-stylesheet-owner-required` | Enforced Elsewhere | the packaged active application loads shared stylesheet truth | typed Gradle verification task `checkDesktopPackagingInputs` | `./gradlew checkDesktopPackagingInputs` and `./gradlew check` | The active application keeps the canonical stylesheet owner at `resources/salt-marcher.css`, and the packaged desktop input set references that file as the shared stylesheet path. |
| `styling-central-selector-definition-owned-here` | Enforced | every Java-authored style-class selector added from `bootstrap/`, `shell/`, or `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Every explicit style-class selector authored from Java resolves to a selector defined in centralized stylesheet files under `resources/`, currently the canonical `resources/salt-marcher.css`. |
| `styling-direct-render-central-visual-truth-required` | Review-Owned | a direct-rendered passive `View` uses JavaFX paint, font, or stroke APIs because no stylesheet selector can express the rendering surface | none | none | Even in direct-rendered surfaces, the semantic color, typography, stroke, and related visual truth still comes from centralized styling ownership rather than from a locally invented palette or typography system. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-no-extra-stylesheet-files` | Enforced | every stylesheet file with supported extensions in the repository worktree | typed Gradle verification task `checkCentralizedStylesheets` | `./gradlew checkCentralizedStylesheets` and `./gradlew check` | Active application stylesheet files stay centralized in `resources/salt-marcher.css`; replacement `.css`, `.scss`, `.sass`, `.less`, or `.styl` files elsewhere are forbidden. |
| `styling-no-inline-setstyle` | Enforced | every active source file under `bootstrap/`, `shell/`, and `src/` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Active application code does not use `setStyle(...)` as an inline styling backchannel. |
| `styling-no-programmatic-style-factories-or-static-style-values` | Enforced | every active Java package under `bootstrap`, `shell`, and `src` | Error Prone `ViewProgrammaticStyling` | `./gradlew compileJava` | Active application code does not define visual style values through the currently blocked JavaFX style-value constructors, color/paint/font factory methods, or static style-value constants. |
| `styling-no-replacement-visual-truth-in-java` | Review-Owned | every active Java type that affects presentation | none | none | A mechanically legal source file still does not introduce replacement visual truth in Java for colors, fonts, text sizes, borders, strokes, spacing, radii, or semantic variants that belong in centralized styling ownership. |
| `styling-no-needless-one-off-selector-vocabulary` | Review-Owned | every selector defined in the centralized stylesheet owner | none | none | Centrally defined selectors remain genuine shared presentation vocabulary rather than feature-local one-off names that only move duplication into `resources/salt-marcher.css`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-java-to-css-explicit-selector-channel-only` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Java communicates style selection to centralized CSS only through explicit selector names that the stylesheet owner defines. |
| `styling-no-dynamic-selector-construction` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Dynamic style-class selector construction is forbidden; Java-authored selectors stay explicit enough for centralized ownership and mechanical resolution checks. |
| `styling-direct-render-central-value-consumption-only` | Review-Owned | a direct-rendered passive `View` must style a rendering surface through JavaFX graphics APIs | none | none | A direct-rendered surface communicates with centralized styling only by consuming centrally owned visual values; it does not create an alternate local styling system through ad-hoc colors, gradients, fonts, or stroke conventions. |

## Candidate

- proving direct-rendered value derivation mechanically if the repository
  adopts a stable central token API or other explicit non-CSS bridge for
  canvas-only styling surfaces

## References

- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
