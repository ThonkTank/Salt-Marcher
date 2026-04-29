Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
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
- what active code MUST NOT do instead of using that centralized ownership
- how active code MAY and MUST NOT communicate with centralized styling truth

Passive `View`-specific direct-render semantics live in the dedicated
[View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
document. Desktop packaging policy, bootstrap feature-independence, and
passive-`View` legality remain owned by their neighboring enforcement bundles
except where those surfaces also prove a styling invariant documented here.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-central-stylesheet-owner-required` | Enforced Elsewhere | the packaged active application loads shared stylesheet truth | typed Gradle verification task `checkDesktopPackagingInputs` | `./gradlew checkDesktopPackagingInputs` and `./gradlew check` | The active application keeps the canonical stylesheet owner at `resources/salt-marcher.css`, and the packaged desktop input set references that file as the shared stylesheet path. |
| `styling-central-selector-definition-required` | Enforced | every Java-authored style-class selector added from `bootstrap/`, `shell/`, or `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Every explicit style-class selector authored from Java resolves to a selector defined in centralized stylesheet files under `resources/`, currently the canonical `resources/salt-marcher.css`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-no-extra-stylesheet-files` | Enforced | every stylesheet file with supported extensions in the repository worktree | typed Gradle verification task `checkCentralizedStylesheets` | `./gradlew checkCentralizedStylesheets` and `./gradlew check` | Active application stylesheet files stay centralized in `resources/salt-marcher.css`; replacement `.css`, `.scss`, `.sass`, `.less`, or `.styl` files elsewhere are forbidden. |
| `styling-no-inline-setstyle` | Enforced | every active source file under `bootstrap/`, `shell/`, and `src/` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Active application code does not use `setStyle(...)` as an inline styling backchannel. |
| `styling-no-programmatic-style-factories-or-static-style-values` | Enforced | every active Java package under `bootstrap`, `shell`, and `src` | Error Prone `ViewProgrammaticStyling` | `./gradlew compileJava` | Active application code does not define visual style values through the currently blocked JavaFX style-value constructors, color/paint/font factory methods, or static style-value constants. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `styling-java-to-css-explicit-selector-channel-only` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Java communicates style selection to centralized CSS only through explicit selector names that the stylesheet owner defines. |
| `styling-no-dynamic-selector-construction` | Enforced | every Java-authored style-class communication seam in `bootstrap/`, `shell/`, and `src/` | typed Gradle verification task `checkDefinedStyleClassSelectors` | `./gradlew checkDefinedStyleClassSelectors` and `./gradlew check` | Dynamic style-class selector construction is forbidden; Java-authored selectors stay explicit enough for centralized ownership and mechanical resolution checks. |

## Review-Owned

- `styling-no-replacement-visual-truth-in-java`
  a mechanically legal source file still does not introduce replacement visual
  truth in Java for colors, fonts, text sizes, borders, strokes, spacing,
  radii, or semantic variants that belong in centralized styling ownership.
- `styling-no-needless-one-off-selector-vocabulary`
  centrally defined selectors remain genuine shared presentation vocabulary
  rather than feature-local one-off names that only move duplication into
  `resources/salt-marcher.css`.

## References

- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
- [Quality Platforms Local Gates](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-gates.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1)
