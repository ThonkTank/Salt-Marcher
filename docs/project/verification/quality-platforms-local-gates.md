Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Detailed local gate inventory, aggregate entrypoints, and
concurrent local invocation policy for SaltMarcher quality platforms.

# Quality Platforms Local Gates

## Purpose

This subordinate standard defines the detailed local gate inventory and local
operating entrypoints beneath the umbrella
[Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1).

## Local Gate Inventory

### Compiler Hygiene

`./gradlew compileJava` is a `Blocking Local Gate`.

It owns Java compilation and compiler-integrated hygiene checks on production
source roots `bootstrap/`, `shell/`, and `src/`.

The build enables `Error Prone`, `NullAway`, and project-local Error Prone
checks during `compileJava`. Architecture-specific Error Prone checks are
classified by the architecture harness. Non-architecture compiler hygiene
checks currently promoted to errors are:

- `EqualsNull`
- `NullAway`
- `ReferenceEquality`
- `StringCaseLocaleUsage`
- `StringSplitter`

`compileJava` does not run the dedicated jQAssistant bundles. Passive `View`
graph and FXML analysis enter local quality through `checkViewEnforcement`,
focused `Contribution` entrypoint-shape and ArchUnit analysis enters through
`checkViewContributionEnforcement`,
focused Binder graph analysis enters through
`checkViewBinderEnforcement`,
focused `ContributionModel` graph analysis enters through
`checkViewContributionModelEnforcement`, focused `ContentModel` graph and
topology analysis enters through `checkViewContentModelEnforcement`, focused
`InspectorEntry` graph and topology analysis enters through
`checkViewInspectorEntryEnforcement`, and broader remaining view-topology
analysis enters through `checkViewArchitecture`.
These paths are wired into the central `check` aggregate through the named
architecture aggregates. This keeps focused compilation verification
independent from graph analysis while ensuring `build` still runs the full
architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdMain`, `./gradlew pmdStrictMain` | Runs `tools/quality/config/pmd/complexity-ruleset.xml` on production Java sources. `pmdMain` is the central blocking gate; `pmdStrictMain` is the text-first direct entrypoint for the same ruleset. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 100`, matching PMD's documented Java example value; writes `build/reports/cpd/main.txt`. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`, matching Lizard's default warning threshold; writes `build/reports/lizard/main.txt`. |
| CKJM ext | `Informational Report` | `./gradlew ckjmMain` | Runs on freshly compiled production classes, writes `build/reports/ckjm/main.txt` and `build/reports/ckjm/summary.md`, and warns on baseline hotspot regressions without blocking local build or install handoff. |

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

The same PMD ruleset enables PMD's default thresholds and rule defaults for the
explicitly listed Java quickstart rules plus stricter source-smell rules for
exception handling, resource handling, unnecessary suppressions, magic
literals, low-branch switches, mutable static state, public members on
non-public types, null sentinels, and local naming/style hygiene. The rule file
must list individual rules explicitly rather than importing whole PMD
categories. PMD default thresholds also remain active for explicitly enabled
rules such as `TooManyFields` (`15`) and `TooManyMethods` (`10`).

`pmdMain` is wired into the central `check` aggregate and fails the local
handoff build on violations. `pmdStrictMain` uses the same ruleset and also
fails when run directly, but it remains a focused direct entrypoint instead of
an additional aggregate dependency. `pmdTest` is disabled; PMD
non-architecture smell policy applies to production source roots, not
architecture test sources.

SpotBugs uses the official Gradle plugin with `findsecbugs-plugin` enabled,
effort `MAX`, and confidence `MEDIUM`. `MAX` is the strongest analysis effort;
`MEDIUM` keeps the normal medium-confidence report level instead of weakening
the report to high-confidence-only findings. `spotbugsMain` is active in the
central `check` aggregate and blocks the local build on reported findings.
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

Focused PMD, SpotBugs, CPD, Lizard, and CKJM entrypoints must stay independent
of the jQAssistant view-topology blocker; they may be run together for quality
investigation without pulling in the view-architecture graph analysis.

Checkstyle metrics and Semgrep are deferred unless current tooling cannot
express a concrete rule.

`./gradlew pmdArchitectureMain` is intentionally separate. It belongs to the
architecture harness and runs source-level architecture policy rules.

### Repository And Resource Policy

Typed Gradle verification tasks in `tools/gradle/build-logic/` own
repository-wide resource, artifact, and packaging policies that are not
language-level architecture rules.

| Entrypoint | Status | Current policy |
| --- | --- | --- |
| `./gradlew checkCentralizedStylesheets` | `Blocking Local Gate` | Stylesheet files with supported stylesheet extensions must be centralized in `resources/salt-marcher.css`. |
| `./gradlew checkDefinedStyleClassSelectors` | `Blocking Local Gate` | Style classes authored from Java through `getStyleClass()` calls must resolve to selectors in `resources/salt-marcher.css`. |
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

## Aggregates And Entry Points

`./gradlew check --console=plain` is the local full build-health blocker and
the single central aggregate for repository-owned blocking Gradle checks.

It includes:

- Java compiler hygiene through `compileJava`
- architecture-harness checks through `architectureTest`,
  `checkViewContributionEnforcement`, `checkViewEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
  `pmdArchitectureMain`, `:build-harness:architectureCheck`, and
  `checkViewArchitecture`
- repository and resource policy checks
- PMD source-smell detection through `pmdMain`
- SpotBugs plus FindSecBugs through `spotbugsMain`
- duplicate-code detection through `cpdMain`
- cyclomatic-complexity detection through `lizardMain`
- OO-metric regression reporting through `ckjmMain`

`./gradlew build --console=plain` remains the default implementation-handoff
build required by `AGENTS.md` for production-code changes and shared
build-logic changes. It reaches the same full check set through Gradle's
standard `build -> check` lifecycle; SaltMarcher-specific checks must be wired
to `check`, not duplicated on `build`.

For implementation work limited to one or more concrete enforcement bundles
under `tools/quality/*-enforcement/**`, the required handoff proof is the
matching focused bundle task or tasks instead of the full build. When the pass
touches shared enforcement wiring such as `build.gradle.kts`,
`settings.gradle.kts`, `tools/gradle/build-harness/**`,
`tools/quality/incubator/quality-rules-errorprone/**`,
`tools/quality/rules/quality-rules/**`, or
`tools/quality/enforcement-bundles.gradle.kts` but still stays limited to
enforcement-only behavior, the required handoff proof is all focused
role/layer bundle entrypoints run serially instead of the full-build path.

`./gradlew checkDocumentationEnforcement --console=plain` is a focused
`Blocking Local Gate` for Markdown-backed architecture and enforcement
documentation checks. It is intentionally outside `check` and `build` so
documentation-only changes can use a narrower proof route without pulling the
full application build and install path.

A completed implementation pass is incomplete until the required full-build,
focused-enforcement, or documentation-enforcement rerun has completed, or a
concrete blocker has been reported.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`pmdStrictMain`, `spotbugsMain`, `pmdArchitectureMain`, `cpdMain`,
`lizardMain`, `ckjmMain`, `checkCentralizedStylesheets`,
`checkDefinedStyleClassSelectors`, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, `checkDesktopAppImageLayout`,
`checkViewFxmlResources`, `checkViewEnforcement`,
`checkViewContributionEnforcement`, `pmdViewContributionEnforcement`,
`checkViewBinderEnforcement`,
`checkViewContributionModelEnforcement`,
`checkViewContentModelEnforcement`,
`checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
`checkViewInputEventEnforcement`, `checkViewPublishedEventEnforcement`,
`checkViewIntentHandlerEnforcement`, `checkDocumentationEnforcement`, and
`jqassistantEffectiveRules`, each run through `./gradlew <task> --console=plain`.

`pmdMain` and `spotbugsMain` are central blocking gates and may also be run as
focused direct entrypoints. `pmdStrictMain` remains the focused text-first PMD
entrypoint for the same blocking ruleset.

Architecture-focused entrypoints:

- `./gradlew checkArchitecture --console=plain`
  Aggregates `architectureTest`, `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
  `pmdArchitectureMain`, and `:build-harness:architectureCheck`.
- `./gradlew checkDocumentationEnforcement --console=plain`
  Aggregates the focused Markdown-backed architecture and enforcement-document
  bundle through `:build-harness:documentationEnforcementCheck`.
- `./gradlew checkViewBinderEnforcement --console=plain`
  Aggregates the current `Binder` bundle through `compileJava`,
  `viewBinderArchitectureTest`, and the dedicated Binder jQAssistant analysis.
- `./gradlew checkViewEnforcement --console=plain`
  Aggregates the current passive `View` bundle through `compileJava`, the
  bundle-owned `viewSurfaceArchitectureTest`, `checkViewFxmlResources`, and
  the dedicated passive-`View` jQAssistant analysis. This is the canonical
  public entrypoint for passive-`View` enforcement.
- `./gradlew checkViewContributionEnforcement --console=plain`
  Aggregates the current `Contribution` bundle through `compileJava`,
  `viewContributionArchitectureTest`, and
  `pmdViewContributionEnforcement`.
- `./gradlew checkViewContributionModelEnforcement --console=plain`
  Aggregates the current `ContributionModel` bundle through `compileJava`,
  `viewContributionModelArchitectureTest`, the dedicated
  `ContributionModel` jQAssistant analysis, and
  `:build-harness:viewContributionModelTopologyCheck`.
- `./gradlew checkViewContentModelEnforcement --console=plain`
  Aggregates the current `ContentModel` bundle through `compileJava`,
  `viewContentModelArchitectureTest`, the dedicated `ContentModel`
  jQAssistant analysis, and `:build-harness:viewContentModelTopologyCheck`.
- `./gradlew checkViewInspectorEntryEnforcement --console=plain`
  Aggregates the current `InspectorEntry` bundle through `compileJava`,
  the dedicated InspectorEntry jQAssistant analysis, and
  `:build-harness:viewInspectorEntryTopologyCheck`.
- `./gradlew checkViewArchitecture --console=plain`
  Runs the explicit jQAssistant view-topology analysis for the remaining
  non-passive `View`, non-Binder, and non-InspectorEntry cockpit structure
  and also executes the focused `ContributionModel` and `ContentModel`
  jQAssistant bundles.
- `./gradlew checkViewLayerEnforcement --console=plain`
  Aggregates the current `View Layer` bundle through
  `viewLayerArchitectureTest` and `:build-harness:viewLayerTopologyCheck`.
- `./gradlew checkViewInputEventEnforcement --console=plain`
  Aggregates the current `ViewInputEvent` bundle through `compileJava`,
  `viewInputEventArchitectureTest`, and `:build-harness:viewInputEventTopologyCheck`.
- `./gradlew checkViewPublishedEventEnforcement --console=plain`
  Aggregates the current `PublishedEvent` bundle through `compileJava` and
  `viewPublishedEventArchitectureTest`.
- `./gradlew checkViewIntentHandlerEnforcement --console=plain`
  Aggregates the current `IntentHandler` bundle through `compileJava`,
  `viewIntentHandlerArchitectureTest`, and
  `:build-harness:viewIntentHandlerTopologyCheck`.

The Gradle convention implementation must keep these public entrypoints stable
while organizing internal wiring by policy area: invocation behavior, compiler
gates, graph analysis, quality reports, repository/resource policy, and the
central aggregate. This keeps local command usage stable while making the build
logic easier to extend.

### Parallel Local Invocation Isolation

Local Gradle gates support concurrent agent runs by isolating mutable
project-local Gradle output when an isolation id is available.

`CODEX_THREAD_ID` is the default isolation id for Codex-managed invocations.
Other local agents that run Gradle gates concurrently must set a unique
`SALTMARCHER_GRADLE_ISOLATION_ID`.

Isolated invocations keep the normal entrypoints, including
`./gradlew build --console=plain`, but write build outputs under
`build/isolated-gradle/<isolation-id>/` and project-cache state under
`.gradle/isolated-gradle/<isolation-id>/`. The shared Gradle user home remains
unchanged so dependency caches stay reusable.

CI is not isolated by default because CI jobs do not provide these local agent
isolation environment variables. Required GitHub Actions report paths therefore
remain the conventional `build/` paths.

For invocations that request any local quality or architecture gate named in
this section, the convention plugin enables Gradle continue-on-failure behavior
automatically. A run still fails when any blocking check fails, but independent
checks that are not blocked by failed dependencies must continue and report
their failures together.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, `checkViewEnforcement`, and `checkViewArchitecture` still require current compiled classes;
if `compileJava` fails, those entrypoints may be skipped because their
prerequisite failed rather than because another independent check failed.

Local blocking Gradle gates must produce diagnostics from the current
invocation. `compileJava`, PMD architecture, ArchUnit-backed test entrypoints,
jQAssistant, PMD non-architecture, SpotBugs, CPD, Lizard, CKJM,
build-harness architecture checks, documentation-enforcement checks, and
Gradle-owned resource policy checks must not report success by being skipped as
`UP-TO-DATE` or restored from the build cache. Tool installation, dependency
resolution, packaging, and generated-resource preparation tasks may remain
incremental because they are not the gate result itself.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
