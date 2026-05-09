Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-09
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
- `UnusedLabel`
- `UnusedMethod`
- `UnusedNestedClass`
- `UnusedVariable`

`compileJava` is the mechanical owner for local unused declaration hygiene:
unused private methods, unused nested classes, unused private or
effectively-private fields, unused parameters on private or effectively-private
methods, unused labels, and unused local variables block compilation. This is
intentionally local-only coverage. It does not claim whole-repository
reachability for top-level types or public APIs.

The compile-wide Error Prone baseline already excludes warnings in generated
code. Outside that narrow generated-code carveout, unused false positives must
be handled with explicit local intent such as deletion, a narrowly justified
suppression, or an equally narrow keep marker when reflection or framework
wiring makes the declaration mechanically unused but semantically live. The
project does not treat blanket unused-check disablement as an acceptable
steady-state policy.

`compileJava` does not run the dedicated topology or whole-program dead-code
bundles. Passive `View` graph and FXML analysis enter local quality through
`checkViewEnforcement`, while the canonical Domain, Data, Shell, Bootstrap,
Styling, and Layering entrypoints are `checkDomainEnforcement`,
`checkDataEnforcement`, `checkShellEnforcement`,
`checkBootstrapEnforcement`, `checkStylingEnforcement`, and
`checkLayeringEnforcement`. Whole-program compiled dead-code analysis enters
through `checkNoDeadCode`. The detailed role-local bundle tasks still exist as
technical implementation surfaces beneath those layer entrypoints, and the
technical owner split behind the public View route is now only the
build-harness View topology core plus the shared Error Prone View core under
`tools/quality/incubator/quality-rules-errorprone/**`.
The compile/FXML/topology paths are wired into the central `check` aggregate
through the named architecture aggregates. Passive-`View` direct-render
styling placement stays compiler-backed through `compileJava` and also enters
the central `check` aggregate explicitly through
`checkStylingViewEnforcement`. This keeps focused compilation verification
independent from the separate closed-world topology owner while ensuring
`build` still runs the full architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdMain`, `./gradlew pmdStrictMain` | Runs `tools/quality/config/pmd/complexity-ruleset.xml` on production Java sources. `pmdMain` is the central blocking gate; `pmdStrictMain` is the text-first direct entrypoint for the same ruleset. PMD owns non-architecture smell policy plus `UnusedAssignment`, including generic source-smell families such as `LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`, `TooManyFields`, and `UselessOverridingMethod`; `compileJava` owns `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and `UnusedVariable`. |
| Dead code reachability | `Blocking Local Gate` | `./gradlew checkNoDeadCode` | Runs the verification-core whole-program reachability analysis for compiled production declarations: files, top-level types, secondary top-level types, nested and named local types, constructors, methods, and fields. Structural roots currently include the configured JavaFX launcher and preloader classes, exact concrete shell contribution roots matching `ShellViewDiscovery`, exact concrete data service contribution roots matching `ServiceContributionDiscovery`, merged FXML controller resources, `META-INF/services` providers, and the explicit fallback rules in `tools/quality/config/deadcode/keep-rules.pro`. Non-constant runtime reflection is only supported through explicit keep rules. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 100`, matching PMD's documented Java example value, and writes its report under the active worktree's normal `build/reports/cpd/` surface. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`, matching Lizard's default warning threshold, and writes its report under the active worktree's normal `build/reports/lizard/` surface. |
| CKJM ext | `Informational Report` | `./gradlew ckjmMain` | Runs on freshly compiled production classes and writes `main.txt` plus `summary.md` under the active worktree's normal `build/reports/ckjm/` surface without blocking local build or install handoff. |

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

Broader architecture-sprawl signals are therefore intentionally split. Generic
source smells stay with PMD, cycle blockers stay with the generic and focused
ArchUnit suites, and whole-program dead-code reachability stays with
`checkNoDeadCode`. The former jQAssistant relay-only and sprawl surfaces are
retired from the public blocker path.

Focused PMD, SpotBugs, CPD, Lizard, and CKJM entrypoints must stay independent
of the closed-world view-topology blocker; they may be run together for quality
investigation without pulling in the separate view-layer topology aggregate. The
dedicated `checkNoDeadCode` blocker is the only whole-program dead-code
hygiene gate in the central quality path.

Checkstyle metrics and Semgrep are deferred unless current tooling cannot
express a concrete rule.

Architecture blockers now run only through compile-blocking Error Prone,
ArchUnit, and the external build harness.

### Repository And Resource Policy

Typed Gradle verification tasks in `tools/gradle/build-logic/` and in the
owning enforcement bundles own repository-wide resource, artifact, and
packaging policies that are not language-level architecture rules.

| Entrypoint | Status | Current policy |
| --- | --- | --- |
| `./gradlew checkStylingCentralStylesheetOwner` | `Blocking Local Gate` | SaltMarcher styling must stay owned by `resources/salt-marcher.css`, and the active `saltMarcherStylesheet` path must still point at that canonical owner. |
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
The canonical styling-layer bundle proof route is
`./gradlew checkStylingLayerEnforcement`; it aggregates the stylesheet,
selector, bundle-local stylesheet-owner, PMD inline-style, and compile-side
programmatic-styling checks for the layer itself.
The dedicated passive-`View` direct-render placement proof route is
`./gradlew checkStylingViewEnforcement`; centralized stylesheet ownership and
selector vocabulary remain available through the separate layer-wide direct
tasks listed above.

## Aggregates And Entry Points

`./gradlew check --console=plain` is the local full build-health blocker and
the single central aggregate for repository-owned blocking Gradle checks.

For wrapper-based local runs, failure aggregation across independent gates is a
runtime-wrapper concern. `tools/gradle/run-observable-gradle.sh` may add
Gradle `--continue` for diagnostic entrypoints so the build reports the full
current failure set without moving that policy into the convention-plugin
layer.

It includes:

- Java compiler hygiene through `compileJava`
- architecture-harness checks through `architectureTest`,
  `checkDomainApplicationServiceEnforcement`,
  `checkDataServiceContributionEnforcement`,
  `checkDomainPortEnforcement`,
  `checkDomainRepositoryEnforcement`,
  `checkDomainModelEnforcement`,
  `checkDomainHelperEnforcement`,
  `checkDomainConstantsEnforcement`,
  `checkStylingLayerEnforcement`,
  `checkBootstrapAppBootstrapEnforcement`,
  `checkShellLayerEnforcement`,
  `checkDomainUseCaseEnforcement`,
  `checkDataModelEnforcement`,
  `checkDataGatewayEnforcement`,
  `checkDataRepositoryEnforcement`,
  `checkDataQueryEnforcement`,
  `checkDataMapperEnforcement`,
  `checkDataPersistencecoreEnforcement`,
  `checkViewEnforcement`,
  `checkViewInputEventEnforcement`,
  `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewIntentHandlerEnforcement`,
  `checkViewLayerEnforcement`,
  and `:build-harness:architectureCheck`
- repository and resource policy checks
- PMD source-smell detection through `pmdMain`
- SpotBugs plus FindSecBugs through `spotbugsMain`
- duplicate-code detection through `cpdMain`
- cyclomatic-complexity detection through `lizardMain`
- OO-metric regression reporting through `ckjmMain`

`tools/gradle/run-staged-verification.sh production-handoff` is the default
implementation-handoff route required by `AGENTS.md` for production-code
changes. The wrapper is runtime-only: it forwards the canonical surface name to
one same-named Gradle lifecycle task, and the verification core expands
`production-handoff` to the production-build, quality-hygiene, architecture,
and view-topology dependencies inside Gradle.
By default, `production-handoff` now runs with Gradle `--continue` at the
staged-handoff level so the canonical implementation-handoff route reports the
broader current failure set in one run. The staged handoff still fails overall
when any blocking dependency fails, but compile, topology, hygiene, and later
focused view-role blockers no longer hide independent sibling failures behind
the first failing stage. Callers may still pass `--continue` explicitly for
clarity, but the canonical wrapper now adds that default itself.
Additional Gradle investigation flags may be passed after `--`, but the
runtime wrapper keeps ownership of its own invocation defaults such as
`--console=plain`. If callers pass wrapper-owned runtime flags again through
the extra-args channel, the runtime wrapper ignores them and logs the filtered
arguments instead of forwarding duplicate built-in Gradle options.
Before Gradle starts, the wrapper also performs a local-socket runtime
preflight so environments without the required IPv4 bind support fail early
with an explicit runtime diagnostic instead of surfacing a late internal
Gradle startup error.

For check-only implementation work limited to one or more concrete enforcement
bundles or shared verification packages under `tools/quality/**`,
`tools/gradle/build-harness/**`,
`tools/quality/rules/quality-rules/**`,
`tools/quality/incubator/quality-rules-errorprone/**`, or verification-only
wiring such as `build.gradle.kts`,
`settings.gradle.kts`, `tools/gradle/build-harness/**`,
`tools/quality/incubator/quality-rules-errorprone/**`,
`tools/quality/rules/quality-rules/**`, or
`tools/gradle/build-logic/**`, or
`tools/gradle/build-logic-settings/**`, the required handoff proof is
the corresponding focused package or bundle task or tasks instead of the full
build. When the pass touches shared verification wiring but still stays
check-only, rerun the focused entrypoints for the actually affected packages;
broader package waves are explicit and do not automatically become the
full-build path.

`./gradlew checkDocumentationEnforcement --console=plain` is a focused
`Blocking Local Gate` for Markdown-backed architecture and enforcement
documentation checks. It is intentionally outside `check` and `build` so
documentation-only changes use a narrower proof route by default without
pulling the full application build and install path. The matching staged
surface is `docs`, and the runtime wrapper forwards that surface name without
owning the documentation task mapping itself.

A completed implementation pass is incomplete until the required
production-code full build, check-only package/bundle rerun, or
documentation-enforcement rerun has completed, or a concrete blocker has been
reported.

Focused investigation entrypoints are `compileJava`, `pmdMain`,
`pmdStrictMain`, `spotbugsMain`, `cpdMain`,
`lizardMain`, `ckjmMain`, `checkCentralizedStylesheets`,
`checkDefinedStyleClassSelectors`, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, `checkDesktopAppImageLayout`,
`checkDomainLayerEnforcement`,
`checkDomainApplicationServiceEnforcement`,
`checkDataServiceContributionEnforcement`,
`checkDomainContextEnforcement`,
`checkDomainPublishedEnforcement`,
`checkDomainPortEnforcement`,
`checkDomainRepositoryEnforcement`,
`checkDomainModelEnforcement`,
`checkDomainHelperEnforcement`,
`checkDomainConstantsEnforcement`, `checkStylingLayerEnforcement`,
  `checkStylingViewEnforcement`,
  `checkShellAppShellEnforcement`,
  `checkBootstrapAppBootstrapEnforcement`,
  `checkShellLayerEnforcement`,
`checkViewFxmlResources`, `checkViewEnforcement`,
`checkViewInputEventEnforcement`,
`checkViewContributionEnforcement`,
`checkViewBinderEnforcement`,
`checkViewContributionModelEnforcement`,
`checkViewContentModelEnforcement`,
`checkViewIntentHandlerEnforcement`,
`checkDomainUseCaseEnforcement`,
  `checkDataModelEnforcement`,
  `checkDataGatewayEnforcement`,
  `checkDataRepositoryEnforcement`,
  `checkDataQueryEnforcement`,
`checkDataMapperEnforcement`,
`checkDataPersistencecoreEnforcement`,
`checkViewLayerEnforcement`,
`checkLayeringArchitectureEnforcement`,
and `checkDocumentationEnforcement`, each run
through
`./gradlew <task> --console=plain`.

`pmdMain` and `spotbugsMain` are central blocking gates and may also be run as
focused direct entrypoints. `pmdStrictMain` remains the focused text-first PMD
entrypoint for the same blocking ruleset.

Architecture-focused entrypoints:

- `./gradlew checkArchitecture --console=plain`
  Aggregates `architectureTest`, `checkDomainLayerEnforcement`,
  `checkDomainApplicationServiceEnforcement`,
  `checkDataServiceContributionEnforcement`,
  `checkDomainPortEnforcement`,
  `checkDomainRepositoryEnforcement`,
  `checkDomainModelEnforcement`,
  `checkDomainHelperEnforcement`,
  `checkDomainConstantsEnforcement`,
  `checkDataModelEnforcement`,
  `checkDataGatewayEnforcement`,
  `checkDataRepositoryEnforcement`,
  `checkDataQueryEnforcement`,
  `checkDataMapperEnforcement`,
  `checkDataPersistencecoreEnforcement`,
  `checkStylingLayerEnforcement`,
  `checkShellLayerEnforcement`,
  `checkDomainUseCaseEnforcement`,
  `checkLayeringArchitectureEnforcement`,
  `checkViewEnforcement`,
  `checkViewInputEventEnforcement`,
  `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewIntentHandlerEnforcement`,
  `checkViewLayerEnforcement`, and
  `:build-harness:architectureCheck`.
- `./gradlew checkDocumentationEnforcement --console=plain`
  Aggregates the focused Markdown-backed architecture and enforcement-document
  bundle through `:build-harness:documentationEnforcementCheck`, including
  active bundle-local Markdown rules such as `Domain Context`.
- `./gradlew checkDomainContextEnforcement --console=plain`
  Aggregates the focused Domain Context bundle through
  `:build-harness:domainContextEnforcementDocumentationCheck`.
- `./gradlew checkDomainApplicationServiceEnforcement --console=plain`
  Aggregates the focused Domain ApplicationService bundle through
  `compileJava`,
  `:build-harness:domainApplicationServiceTopologyCheck`, and
  `:build-harness:domainApplicationServiceDocumentationEnforcementCheck`.
- `./gradlew checkDataServiceContributionEnforcement --console=plain`
  Aggregates the focused Data ServiceContribution bundle through
  `compileJava` and
  `:build-harness:dataServiceContributionDocumentationEnforcementCheck`.
- `./gradlew checkDomainLayerEnforcement --console=plain`
  Aggregates the focused Domain Layer bundle through `compileJava`,
  `domainLayerArchitectureTest`,
  `:build-harness:domainLayerTopologyCheck`, and
  `:build-harness:domainLayerDocumentationEnforcementCheck`.
- `./gradlew checkDomainPublishedEnforcement --console=plain`
  Aggregates the focused Domain Published bundle through `compileJava`,
  `:build-harness:domainPublishedTopologyCheck`, and
  `:build-harness:domainPublishedDocumentationEnforcementCheck`.
- `./gradlew checkDomainPortEnforcement --console=plain`
  Aggregates the focused Domain Port bundle through
  `:build-harness:domainPortTopologyCheck` and
  `:build-harness:domainPortEnforcementDocumentationCheck`.
- `./gradlew checkDomainRepositoryEnforcement --console=plain`
  Aggregates the focused Domain Repository bundle through
  `:build-harness:domainRepositoryTopologyCheck` and
  `:build-harness:domainRepositoryDocumentationEnforcementCheck`.
- `./gradlew checkDomainModelEnforcement --console=plain`
  Aggregates the focused Domain Model bundle through
  `:build-harness:domainModelTopologyCheck` and
  `:build-harness:domainModelDocumentationEnforcementCheck`.
- `./gradlew checkDomainHelperEnforcement --console=plain`
  Aggregates the focused Domain Helper bundle through
  `:build-harness:domainHelperTopologyCheck` and
  `:build-harness:domainHelperDocumentationEnforcementCheck`.
- `./gradlew checkDomainConstantsEnforcement --console=plain`
  Aggregates the focused Domain Constants bundle through
  `:build-harness:domainConstantsTopologyCheck` and
  `:build-harness:domainConstantsDocumentationEnforcementCheck`.
- `./gradlew checkDomainUseCaseEnforcement --console=plain`
  Aggregates the focused Domain UseCase bundle through `compileJava`,
  `:build-harness:domainUseCaseTopologyCheck`, and
  `:build-harness:domainUseCaseDocumentationEnforcementCheck`.
- `./gradlew checkDataModelEnforcement --console=plain`
  Aggregates the focused Data Model bundle through `compileJava`,
  `dataModelArchitectureTest`,
  `:build-harness:dataModelTopologyCheck`, and
  `:build-harness:dataModelDocumentationEnforcementCheck`.
- `./gradlew checkDataGatewayEnforcement --console=plain`
  Aggregates the focused Data Gateway bundle through `compileJava`,
  `dataGatewayArchitectureTest`, and
  `:build-harness:dataGatewayEnforcementDocumentationCheck`.
- `./gradlew checkDataRepositoryEnforcement --console=plain`
  Aggregates the focused Data Repository bundle through `compileJava`,
  and
  `:build-harness:dataRepositoryEnforcementDocumentationCheck`.
- `./gradlew checkDataQueryEnforcement --console=plain`
  Aggregates the focused Data Query bundle through `compileJava`,
  `:build-harness:dataQueryTopologyCheck`, and
  `:build-harness:dataQueryEnforcementDocumentationCheck`. The compile-side
  blocker now includes `DataQueryForeignPublishedReplyChannelRoundTrip`, which
  reports the foreign published reply-channel roundtrip anti-pattern together
  with the correct one-way published-state target pattern. The same focused
  bundle now also includes the build-harness blocker
  `DataQueryForeignPublishedPayloadSurfaceRules`, which fails when foreign
  published passive payload carriers consumed by query adapters export unused
  accessor surface.
- `./gradlew checkDataPersistencecoreEnforcement --console=plain`
  Aggregates the focused Data Persistencecore bundle through
  `dataPersistencecoreArchitectureTest` and
  `:build-harness:dataPersistencecoreDocumentationEnforcementCheck`.
- `./gradlew checkLayeringArchitectureEnforcement --console=plain`
  Aggregates the dedicated `Layering Architecture` bundle through
  `:build-harness:layeringArchitectureTopologyCheck` and
  `:build-harness:layeringArchitectureDocumentationEnforcementCheck`.
- `./gradlew checkStylingLayerEnforcement --console=plain`
  Aggregates the styling-layer bundle through `compileJava`,
  `checkCentralizedStylesheets`, `checkDefinedStyleClassSelectors`, and
  `checkDesktopPackagingInputs`.
- `./gradlew checkBootstrapAppBootstrapEnforcement --console=plain`
  Aggregates the focused `AppBootstrap` bundle through the dedicated
  `bootstrapAppBootstrapArchitectureTest` ArchUnit suite.
- `./gradlew checkShellLayerEnforcement --console=plain`
  Aggregates the dedicated `Shell Layer` bundle through
  `shellLayerArchitectureTest` and `:build-harness:shellLayerTopologyCheck`.
- `./gradlew checkStylingViewEnforcement --console=plain`
  Aggregates the passive-`View` direct-render styling bundle through
  `compileJava` with the dedicated `ViewDirectRenderStylingPlacement`
  compiler check and is also wired explicitly into the root `check`
  aggregate.
- `./gradlew checkDomainEnforcement --console=plain`
  Aggregates the canonical Domain enforcement surface through the Domain
  Context, Layer, UseCase, ApplicationService, Published, Port, Model,
  Helper, Constants, and Repository bundles.
- `./gradlew checkDataEnforcement --console=plain`
  Aggregates the canonical Data enforcement surface through the Data Layer,
  Model, Gateway, Mapper, Persistencecore, Query, Repository, and
  ServiceContribution bundles.
- `./gradlew checkShellEnforcement --console=plain`
  Aggregates the canonical Shell enforcement surface through the
  `ShellRuntimeContext`, `AppShell`, and Shell Layer bundles.
- `./gradlew checkBootstrapEnforcement --console=plain`
  Aggregates the canonical Bootstrap enforcement surface through the
  `AppBootstrap` and Bootstrap Layer bundles.
- `./gradlew checkStylingEnforcement --console=plain`
  Aggregates the canonical Styling enforcement surface through the
  styling-layer and passive-`View` direct-render styling bundles.
- `./gradlew checkLayeringEnforcement --console=plain`
  Aggregates the canonical Layering enforcement surface through the blocker
  Layering Architecture and Layering Indirection bundles.
- `./gradlew checkShellAppShellEnforcement --console=plain`
  Aggregates the focused `AppShell` bundle through `compileJava` with the
  dedicated `ShellLifecycleHookOwnership` compiler check.
- `./gradlew checkViewEnforcement --console=plain`
  Aggregates the canonical View enforcement surface through the closed-world
  View Layer topology proof plus the passive `View`, `ViewInputEvent`,
  `Contribution`, `Binder`, `ContributionModel`, `ContentModel`, and
  `IntentHandler` bundles.
- `./gradlew checkViewInputEventEnforcement --console=plain`
  Aggregates the focused `ViewInputEvent` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewContributionEnforcement --console=plain`
  Aggregates the focused `Contribution` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewBinderEnforcement --console=plain`
  Aggregates the focused `Binder` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewContributionModelEnforcement --console=plain`
  Aggregates the focused `ContributionModel` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewContentModelEnforcement --console=plain`
  Aggregates the focused `ContentModel` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewIntentHandlerEnforcement --console=plain`
  Aggregates the focused `IntentHandler` bundle through `compileJava` and
  `checkViewLayerEnforcement`.
- `./gradlew checkViewLayerEnforcement --console=plain`
  Aggregates the closed-world View Layer bundle through the generic
  build-harness topology proof for allowed view directories, role forms, and
  same-unit cardinality. This is the canonical public entrypoint for view
  topology blocking.

The Gradle convention implementation must keep these public entrypoints stable
while organizing internal wiring by policy area: invocation behavior, compiler
gates, graph analysis, quality reports, repository/resource policy, and the
central aggregate. This keeps local command usage stable while making the build
logic easier to extend.

### Parallel Local Worktrees

Local Gradle gates support concurrent agent work through checkout separation,
not through wrapper-managed same-worktree isolation.

Parallel implementation work MUST use one linked git worktree plus one branch
per agent. The preferred local shape is:

1. create a linked worktree under `build/codex-worktrees/<topic>/`
2. create or switch to an agent-owned branch inside that worktree
3. implement and verify there with the normal public Gradle entrypoints
4. merge back into the repo-root `SaltMarcher/` checkout only after the
   required local verification surface is green
5. remove the temporary linked worktree and delete the temporary local branch
   once the verified result lives in the real local working tree

This keeps each agent's mutable `build/` and `.gradle/` state naturally scoped
to its own filesystem tree. The harness therefore no longer creates
per-invocation `.gradle/isolated-runs/**` roots, synthetic included-build
mirrors, wrapper-published plugin repositories, generated descriptor snapshots,
or wrapper-owned retained-failure export surfaces.

The verification core still computes focused bundle selection during settings
evaluation and still registers the same public `check*Enforcement`,
`checkDocumentationEnforcement`, and staged lifecycle tasks. The difference is
that the included builds and bundle descriptors are resolved directly from the
active worktree layout.

`./gradlew` now uses Gradle's normal daemon behavior unless the caller
explicitly passes `--daemon` or `--no-daemon`. `tools/gradle/run-observable-gradle.sh` and
`tools/gradle/run-staged-verification.sh` remain the preferred runtime wrappers
for observability and staged surface routing, but they no longer provide
parallel safety by rewriting Gradle cache or build directories.

Callers may still pass investigation-oriented extra args such as
`--rerun-tasks`, `--stacktrace`, `--info`, or `--scan`, while the runtime
wrappers continue to own their own invocation defaults such as
`--console=plain` and the default `--continue` policy for diagnostic surfaces.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, `checkViewEnforcement`, and the other focused `checkView*Enforcement`
tasks still require
current compiled classes; if `compileJava` fails, those entrypoints may be
skipped because their prerequisite failed rather than because another
independent check failed.

Local blocking Gradle gates may still finish `UP-TO-DATE` or `FROM-CACHE` when
their declared inputs and outputs are unchanged. That reuse now comes from
normal Gradle behavior inside the active worktree rather than from wrapper
managed same-worktree snapshot infrastructure.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
