Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Complete architecture-enforcement catalog for centralized
JavaFX styling ownership, selector vocabulary, and styling-layer communication
across active SaltMarcher code.

# Styling Layer Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
styling layer itself rather than one specific consumer role.

It answers three questions for active styling ownership across `resources/`,
`bootstrap/`, `shell/`, and `src/`:

- what centralized styling ownership MUST exist
- what the styling layer itself MUST NOT contain
- how active code MAY and MUST NOT communicate with centralized styling truth

Passive `View`-specific direct-render semantics live in the dedicated
[View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
document. Desktop packaging policy, bootstrap feature-independence, and
passive-`View` legality remain owned by their neighboring enforcement bundles
except where those surfaces also prove a styling invariant documented here.

Unified focused bundle entrypoint:

- `./gradlew checkStylingLayerEnforcement --rerun-tasks --console=plain`
  runs the currently active styling-layer checks through one root task.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  aggregate blocking behavior enters `./gradlew checkArchitecture` and
  `./gradlew check` through this bundle. The canonical stylesheet-owner proof
  now stays local to this bundle through typed Gradle tasks plus compile-side
  Error Prone rules.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-central-stylesheet-owner-required` | Enforced | active SaltMarcher styling is configured or verified | typed Gradle verification task `checkStylingCentralStylesheetOwner` | `./gradlew checkStylingCentralStylesheetOwner`, `./gradlew checkStylingLayerEnforcement`, and `./gradlew check` | The active application keeps the canonical stylesheet owner at `resources/salt-marcher.css`, and the configured styling path remains bound to that canonical owner. |
| `styling-central-visual-truth-owner-required` | Review-Owned | active application surfaces need shared semantic colors, fonts, text sizes, borders, strokes, spacing, radii, or semantic variants | none | none | Shared visual truth for ordinary active application styling remains centralized in the styling layer instead of being split across Java packages, ad-hoc constants, or parallel style owners. |
| `styling-central-selector-definition-required` | Enforced | every Java-authored style-class selector added from `bootstrap/`, `shell/`, or `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors`, `./gradlew checkStylingLayerEnforcement`, and `./gradlew check` | Every explicit style-class selector authored from Java resolves to a selector defined in centralized stylesheet files under `resources/`, currently the canonical `resources/salt-marcher.css`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-no-extra-stylesheet-files` | Enforced | every stylesheet file with supported extensions in the repository worktree | typed Gradle verification task `checkCentralizedStylesheets` | `./gradlew checkCentralizedStylesheets`, `./gradlew checkStylingLayerEnforcement`, and `./gradlew check` | Active application stylesheet files stay centralized in `resources/salt-marcher.css`; replacement `.css`, `.scss`, `.sass`, `.less`, or `.styl` files elsewhere are forbidden. |
| `styling-no-programmatic-style-factories-or-static-style-values` | Enforced | every active Java package under `bootstrap`, `shell`, and `src` outside the dedicated passive-`View` direct-render exception | Error Prone `ViewProgrammaticStyling` | `./gradlew compileJava`, `./gradlew checkStylingLayerEnforcement`, `./gradlew checkArchitecture`, and `./gradlew check` | Active application code outside the dedicated passive-`View` direct-render exception does not define visual style values through the currently blocked JavaFX style-value constructors, color/paint/font factory methods, or static style-value constants. |
| `styling-no-replacement-visual-truth-in-java` | Review-Owned | a mechanically legal active source file under `bootstrap/`, `shell/`, or `src/` still styles ordinary application nodes | none | none | No mechanically legal source file introduces replacement visual truth in Java for colors, fonts, text sizes, borders, strokes, spacing, radii, or semantic variants that belong in centralized styling ownership. |
| `styling-no-needless-one-off-selector-vocabulary` | Review-Owned | centralized selectors are added or retained in `resources/salt-marcher.css` for active application styling | none | none | Centrally defined selectors remain genuine shared presentation vocabulary rather than feature-local one-off names that only move duplication into `resources/salt-marcher.css`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-bootstrap-loads-central-stylesheet-resource-only` | Review-Owned | desktop launch framing exists and must attach shared application styling to scene or preloader surfaces | none | none | Bootstrap communicates with the styling layer only by loading the canonical stylesheet resource at `resources/salt-marcher.css`; it does not switch to feature-local stylesheet files or alternate stylesheet owners. |
| `styling-java-to-css-explicit-selector-channel-only` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors`, `./gradlew checkStylingLayerEnforcement`, and `./gradlew check` | Java communicates style selection to centralized CSS only through explicit selector names that the stylesheet owner defines. |
| `styling-no-dynamic-selector-construction` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors`, `./gradlew checkStylingLayerEnforcement`, and `./gradlew check` | Dynamic style-class selector construction is forbidden; Java-authored selectors stay explicit enough for centralized ownership and mechanical resolution checks. |
| `styling-no-inline-setstyle-backchannel` | Review-Owned | every active source file under `bootstrap/`, `shell/`, and `src/` | none | none | Active application code does not communicate styling through `setStyle(...)` as an inline backchannel around centralized stylesheet ownership. |
| `styling-no-java-owned-visual-value-backchannel` | Enforced | every active Java package under `bootstrap`, `shell`, and `src` outside the dedicated passive-`View` direct-render exception | Error Prone `ViewProgrammaticStyling` | `./gradlew compileJava`, `./gradlew checkStylingLayerEnforcement`, `./gradlew checkArchitecture`, and `./gradlew check` | Active application code outside the dedicated passive-`View` direct-render exception does not communicate styling through the currently blocked JavaFX style-value constructors, color/paint/font factory methods, or static style-value constants instead of through centralized styling truth. |

## Candidate

- proving the bootstrap stylesheet-loading seam directly, rather than inferring
  it from the documented bootstrap launch framing plus packaging-input
  verification
- proving the remaining review-owned central-visual-truth invariants directly
  if the repository adopts a stable styling-token or equivalent explicit
  central-value surface beyond CSS-selector ownership

## References

- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
