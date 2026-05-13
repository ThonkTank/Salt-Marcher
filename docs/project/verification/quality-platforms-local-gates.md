Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Detailed local gate inventory for SaltMarcher quality
platforms.

# Quality Platforms Local Gates

## Purpose

This subordinate standard defines the detailed local gate inventory beneath
the umbrella
[Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1).
Aggregate entrypoints and local worktree invocation policy live in
[Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1).

## Local Gate Inventory

### Compiler Hygiene

`./gradlew compileJava` is a `Blocking Local Gate`.

It owns Java compilation on production source roots `bootstrap/`, `shell/`,
and `src/`. Root `compileJava` does not enable Error Prone, NullAway,
project-local Error Prone checkers, architecture checkers, tests, or quality
gates.

Compiler-backed verification that needs Error Prone runs through focused
verification compiles behind the public `check*Enforcement` layer surfaces and
the `production-handoff` route. Passive `View` graph and FXML analysis enter
local quality through `checkViewEnforcement`, while the canonical Domain,
Data, Shell, Bootstrap, Styling, and Layering entrypoints are
`checkDomainEnforcement`, `checkDataEnforcement`, `checkShellEnforcement`,
`checkBootstrapEnforcement`, `checkStylingEnforcement`, and
`checkLayeringEnforcement`. Whole-program compiled dead-code analysis enters
through `checkNoDeadCode`. Internal bundle tasks may still exist as technical
implementation surfaces beneath those layer entrypoints, but they are not part
of the public verification API. That also applies when an internal
build-harness topology task still carries a technical `check*` name such as
`checkViewLayerEnforcement`; the public command remains
`checkViewEnforcement`. The technical owner split behind the public View route
is now only the build-harness View topology core plus the shared Error Prone
View core under `tools/quality/incubator/quality-rules-errorprone/**`.
Focused compile, FXML, and topology paths are wired into the central `check`
aggregate through the named architecture aggregates so `build` still runs the
full architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdMain`, `./gradlew pmdStrictMain` | Runs `tools/quality/config/pmd/complexity-ruleset.xml` on production Java sources. `pmdMain` is the central blocking gate; `pmdStrictMain` is the text-first direct entrypoint for the same ruleset. PMD owns non-architecture smell policy plus `UnusedAssignment`, including generic source-smell families such as `LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`, `TooManyFields`, and `UselessOverridingMethod`; focused Error Prone verification compiles own `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and `UnusedVariable` where those checkers are part of the selected enforcement surface. |
| OpenRewrite near-miss checks | `Blocking Local Gate` | `./gradlew checkRewriteNearMisses`, `./gradlew rewriteDryRun` | Runs the active `saltmarcher.rewrite.NearMissChecks` recipe set from `rewrite.yml` in dry-run mode. The gate blocks when OpenRewrite would change code or mark configured search results; it does not mutate tracked sources. The current scope covers redundant casts, known redundant Java call chains, and DTO-overfetching search recipes for configured carrier packages. It is a near-miss quality gate, not a proof of redundant `A -> B -> D` carrier-converter chains. |
| Dead code reachability | `Blocking Local Gate` | `./gradlew checkNoDeadCode` | Runs the verification-core whole-program reachability analysis for compiled production declarations: files, top-level types, secondary top-level types, nested and named local types, constructors, methods, and fields. Structural roots currently include the configured JavaFX launcher and preloader classes, exact concrete shell contribution roots matching `ShellViewDiscovery`, exact concrete data service contribution roots matching `ServiceContributionDiscovery`, merged FXML controller resources, `META-INF/services` providers, and the explicit fallback rules in `tools/quality/config/deadcode/keep-rules.pro`. Non-constant runtime reflection is only supported through explicit keep rules. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 100`, matching PMD's documented Java example value, and writes its report under the active worktree's normal `build/reports/cpd/` surface. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`, matching Lizard's default warning threshold, and writes its report under the active worktree's normal `build/reports/lizard/` surface. |
| CKJM ext | `Informational Report` | `./gradlew ckjmMain` | Runs on freshly compiled production classes and writes `main.txt` plus `summary.md` under the active worktree's normal `build/reports/ckjm/` surface. It is included in the shared `check` / `production-handoff` lifecycle catalog for report visibility, but CKJM hotspot findings remain warnings rather than blocker failures. |

PMD non-architecture reports use explicit metric thresholds. These thresholds
must stay at or below PMD's documented defaults unless the standard explicitly
records a stricter project value:

- Cognitive complexity: `15`
- Method cyclomatic complexity: `10`
- Class cyclomatic complexity: `80`
- NPath complexity: `200`
- Coupling between objects: `20`
- Deep nested `if` depth: `3`
- Method NCSS count: `60`
- Class NCSS count: `1500`
- Excessive parameter list minimum: `10`

The same PMD ruleset enables SaltMarcher's role-aware `DataClass` rule and
PMD's default thresholds and rule defaults for the
explicitly listed Java quickstart rules plus stricter source-smell rules for
exception handling, resource handling, unnecessary suppressions, magic
literals, low-branch switches, mutable static state, public members on
non-public types, null sentinels, and local naming/style hygiene. The rule file
must list individual rules explicitly rather than importing whole PMD
categories. PMD default thresholds also remain active for explicitly enabled
rules such as `DataClass`, `TooManyFields` (`15`), and `TooManyMethods` (`10`).
`DataClass` remains blocking but ignores expected passive carriers for
`src/data/**/model/*PersistenceSchema.java`, `src/data/**/model/*Record.java`,
and `src/domain/**/published/**` source files.

`checkRewriteNearMisses` is wired into the shared `check` /
`production-handoff` lifecycle catalog through OpenRewrite `rewriteDryRun` and
fails the local handoff build when the active near-miss recipe set produces
dry-run changes or search markers. `rewriteRun` is not part of the blocking
path because it mutates source files.

`pmdMain` is wired into the shared `check` / `production-handoff` lifecycle
catalog and fails the local handoff build on violations. `pmdStrictMain` uses
the same ruleset and also fails as part of that shared lifecycle or when run
directly. `pmdTest` is disabled; PMD
non-architecture smell policy applies to production source roots, not
architecture test sources.

Whole-program dead-code discovery for compiled production declarations is now
mechanically enforced by `checkNoDeadCode`. That blocker covers files,
top-level types, secondary top-level types, named nested and local types,
constructors, methods, and fields. Local declaration hygiene remains owned by
`compileJava`, while dynamic runtime entrypoints without a scanned structural
root remain out of scope until they are made explicit through
`tools/quality/config/deadcode/keep-rules.pro`.

SpotBugs uses the official Gradle plugin with `findsecbugs-plugin` enabled,
effort `MAX`, and confidence `MEDIUM`. `MAX` is the strongest analysis effort;
`MEDIUM` keeps the normal medium-confidence report level instead of weakening
the report to high-confidence-only findings. `spotbugsMain` is active in the
shared `check` / `production-handoff` lifecycle catalog and blocks the local
build on reported findings.
`spotbugsTest` is disabled because behavior-coupled automated tests are not
part of the project strategy.

CKJM measures object-oriented class metrics but does not publish official
blocking defaults. SaltMarcher therefore treats CKJM as a hotspot and
regression report, not as a universal low absolute threshold over every class.
`ckjmMain` scans only the current `compileJava` output and compares the current
hotspot candidates with `tools/quality/config/ckjm/baseline.tsv`.

The reported hotspot metrics are weighted methods per class (`WMC`), coupling
between objects (`CBO`), response for class (`RFC`), lack of cohesion in
methods (`LCOM`), and number of public methods (`NPM`). Depth of inheritance
tree (`DIT`), number of children (`NOC`), and afferent couplings (`Ca`) remain
report context and do not block by themselves.

A class is a hotspot candidate when at least two attention thresholds are met
or at least one extreme threshold is met:

- Attention thresholds: `WMC>=50`, `CBO>=40`, `RFC>=120`, `LCOM>=500`,
  `NPM>=40`.
- Extreme thresholds: `WMC>=100`, `CBO>=60`, `RFC>=200`, `LCOM>=1500`,
  `NPM>=60`.

Known hotspot candidates are accepted in the baseline. `ckjmMain` warns when a
new class becomes a hotspot candidate or when a baseline hotspot meaningfully
worsens beyond the allowed deltas:

- `WMC`: `+5`
- `CBO`: `+5`
- `RFC`: `+15`
- `LCOM`: `+150`
- `NPM`: `+5`

The CKJM summary must still list current hotspots and LCOM-only outliers so
wide data carriers and real multi-metric hotspots stay visible even when the
report does not block the build.

Broader architecture-sprawl signals are therefore intentionally split. Generic
source smells stay with PMD, cycle blockers stay with the generic and focused
ArchUnit suites, whole-program dead-code reachability stays with
`checkNoDeadCode`, and jQAssistant owns the graph diagnostics for relay stacks,
reuse direction, and role or feature sprawl behind the focused architecture
surfaces.

Focused PMD, SpotBugs, CPD, Lizard, and CKJM entrypoints must stay independent
of the closed-world View topology owner behind `checkViewEnforcement`; they may
be run together for quality investigation without pulling in the separate
view-layer enforcement surface. The dedicated `checkNoDeadCode` blocker is the
only whole-program dead-code hygiene gate in the central quality path.

Checkstyle metrics and Semgrep are deferred unless current tooling cannot
express a concrete rule.

Architecture blockers now run only through focused Error Prone verification
compiles, ArchUnit, and the external build harness behind the public
architecture and enforcement surfaces.

### Repository And Resource Policy

Typed Gradle verification tasks in `tools/gradle/build-logic/` and in the
owning enforcement bundles own repository-wide resource, artifact, and
packaging policies that are not language-level architecture rules.

| Entrypoint | Status | Current policy |
| --- | --- | --- |
| `./gradlew checkStylingCentralStylesheetOwner` | `Blocking Local Gate` | SaltMarcher styling must stay owned by `resources/salt-marcher.css`, and the active `saltMarcherStylesheet` path must still point at that canonical owner. |
| `./gradlew checkCentralizedStylesheets` | `Blocking Local Gate` | Stylesheet files with supported stylesheet extensions must be centralized in `resources/salt-marcher.css`. |
| `./gradlew checkDefinedStyleClassSelectors` | `Blocking Local Gate` | Style classes authored from Java through `getStyleClass()` calls must resolve to selectors in `resources/salt-marcher.css`. |
| `./gradlew checkManualNodeStyling` | `Blocking Local Gate` | Active code must not use `setStyle(...)`, and passive `View` code must not define ordinary node styling through local `Insets`, padding, spacing, gap, or fixed visual size setters. |
| `./gradlew checkNoCompiledArtifactsInSource` | `Blocking Local Gate` | `.class` files must not exist under active source roots. |
| `./gradlew checkDesktopPackagingInputs` | `Blocking Local Gate` | Desktop main/preloader class sources, icon paths, stylesheet path, launcher name, and `StartupWMClass` must be present and valid. |
| `./gradlew checkDesktopAppImageLayout` | `Blocking Distribution Gate` | Installed desktop app images must keep JavaFX jars on the dedicated JavaFX module path and keep launcher configuration aligned with the packaged layout. |
| `./gradlew checkViewFxmlResources` | `Blocking Local Gate` | View FXML files must live under the MVVM view-resource tree, avoid inline scripts, and use passive View controllers matching the owning view area. For the complete passive-`View` bundle proof route, use `./gradlew checkViewEnforcement`. |

The styling rules behind the stylesheet and selector gates, plus the remaining
direct-render styling invariants for passive `View` surfaces, are defined in
the
[Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1),
[Styling Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-layer-enforcement.md:1),
and
[View Styling Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/styling-view-enforcement.md:1).
The canonical styling-layer bundle proof route is
`./gradlew checkStylingEnforcement`; it aggregates the stylesheet,
selector, bundle-local stylesheet-owner, compile-side inline-style,
manual-node-layout styling, and programmatic-styling checks for the layer
itself.
The dedicated passive-`View` direct-render placement proof route is
`./gradlew checkStylingEnforcement`; centralized stylesheet ownership and
selector vocabulary remain available through the separate layer-wide direct
tasks listed above.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Entrypoints](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms-local-entrypoints.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
