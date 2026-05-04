Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-04
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

`compileJava` does not run the dedicated jQAssistant bundles. Passive `View`
graph and FXML analysis enter local quality through `checkViewEnforcement`,
focused Domain Layer topology, dependency, and documentation proof enters
through `checkDomainLayerEnforcement`,
focused Domain ApplicationService API-shape, topology, signature-purity,
source-pattern policy, and documentation proof enters through
`checkDomainApplicationServiceEnforcement`,
focused Data ServiceContribution construction-purity, shell-seam,
`register(...)` export-shape, source-pattern, and documentation proof enters
through `checkDataServiceContributionEnforcement`,
focused Domain Published carrier-shape, signature-purity, topology, and
documentation proof enters through `checkDomainPublishedEnforcement`,
focused Domain Port role-shape, boundary, and documentation proof enters
through `checkDomainPortEnforcement`,
focused Domain Factory role and documentation proof enters through
`checkDomainFactoryEnforcement`,
focused Domain Value role and documentation proof enters through
`checkDomainValueEnforcement`,
focused Domain Service role and documentation proof enters through
`checkDomainServiceEnforcement`,
focused Domain Policy role and documentation proof enters through
`checkDomainPolicyEnforcement`,
focused Domain Event role-shape and documentation proof enters through
`checkDomainEventEnforcement`,
focused Domain Specification role-shape proof enters through
`checkDomainSpecificationEnforcement`,
focused styling-layer proof enters through `checkStylingLayerEnforcement`,
focused passive-`View` direct-render styling placement enters through
`checkStylingViewEnforcement`,
focused `AppShell` lifecycle-hook ownership enters through
`checkShellAppShellEnforcement`,
focused `AppBootstrap` host-composition boundary proof enters through
`checkBootstrapAppBootstrapEnforcement`,
focused shell-layer topology and boundary analysis enters through
`checkShellLayerEnforcement`,
focused Domain UseCase topology, same-context `published/**` dependency,
source-pattern policy, and bundle-local enforcement-documentation coverage
enters through `checkDomainUseCaseEnforcement`,
focused Data Model source-shape, schema-DDL-placement, model-domain
independence, topology, and documentation proof enters through
`checkDataModelEnforcement`,
focused Data Gateway public-signature-boundary, domain-independence, and
documentation proof enters through `checkDataGatewayEnforcement`,
focused Data Repository write-port contract, public-signature-boundary,
gateway-collaborator, source-mechanics, and documentation proof enters
through `checkDataRepositoryEnforcement`,
focused Data Query read-port contract, public-signature-boundary,
gateway-collaborator, mutation-boundary, source-mechanics, read-only-source
shape, and documentation proof enters through
`checkDataQueryEnforcement`,
focused Data Mapper source-pattern and documentation proof enters through
`checkDataMapperEnforcement`,
focused Data Persistencecore dependency and documentation proof enters through
`checkDataPersistencecoreEnforcement`,
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
The graph/FXML/topology paths are wired into the central `check` aggregate
through the named architecture aggregates. Passive-`View` direct-render
styling placement stays compiler-backed through `compileJava` and also enters
the central `check` aggregate explicitly through
`checkStylingViewEnforcement`. This keeps focused compilation verification
independent from graph analysis while ensuring `build` still runs the full
architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdMain`, `./gradlew pmdStrictMain` | Runs `tools/quality/config/pmd/complexity-ruleset.xml` on production Java sources. `pmdMain` is the central blocking gate; `pmdStrictMain` is the text-first direct entrypoint for the same ruleset. PMD owns non-architecture smell policy plus `UnusedAssignment`; `compileJava` owns `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and `UnusedVariable`. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 100`, matching PMD's documented Java example value; wrapper-based invocations write `main.txt` under `.gradle/isolated-runs/<run-id>/build/.../reports/cpd/`. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`, matching Lizard's default warning threshold; wrapper-based invocations write `main.txt` under `.gradle/isolated-runs/<run-id>/build/.../reports/lizard/`. |
| CKJM ext | `Informational Report` | `./gradlew ckjmMain` | Runs on freshly compiled production classes, writes `main.txt` and `summary.md` under `.gradle/isolated-runs/<run-id>/build/.../reports/ckjm/` for wrapper-based invocations, and exports the newest maintained report to `build/latest-reports/ckjm/` without blocking local build or install handoff. |

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

Whole-program dead-code discovery for top-level types or non-private APIs
remains `Review-Owned`; the active mechanical gates intentionally stop at the
local declaration and local-smell boundary described above.

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
  `checkDomainFactoryEnforcement`,
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
  `checkViewContributionEnforcement`, `checkViewEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
  `checkViewInputEventEnforcement`,
  `checkShellRuntimeContextEnforcement`, `pmdArchitectureMain`,
  `:build-harness:architectureCheck`, and `checkViewArchitecture`
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
By default, `production-handoff` stays fail-fast at the staged-handoff level so
gross blockers such as compile or root-topology failures stop the handoff
before the broader hygiene wave adds avoidable noise. When a broader diagnostic
failure inventory is explicitly needed, callers may request it with
`tools/gradle/run-staged-verification.sh production-handoff -- --continue`.
Additional Gradle investigation flags may be passed after `--`, but the
runtime wrapper keeps ownership of its own invocation defaults such as
`--console=plain`, `--no-daemon`, isolated `GRADLE_USER_HOME`, and injected
`--project-cache-dir`. If callers pass those wrapper-owned runtime flags again
through the extra-args channel, the runtime wrapper ignores them and logs the
filtered arguments instead of forwarding duplicate built-in Gradle options.
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
`pmdStrictMain`, `spotbugsMain`, `pmdArchitectureMain`, `cpdMain`,
`lizardMain`, `ckjmMain`, `checkCentralizedStylesheets`,
`checkDefinedStyleClassSelectors`, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, `checkDesktopAppImageLayout`,
`checkDomainLayerEnforcement`,
`checkDomainApplicationServiceEnforcement`,
`checkDataServiceContributionEnforcement`,
`pmdDataServiceContributionEnforcement`,
`checkDomainContextEnforcement`,
`checkDomainPublishedEnforcement`,
`checkDomainPortEnforcement`,
`checkDomainFactoryEnforcement`,
`checkDomainValueEnforcement`, `checkStylingLayerEnforcement`,
`checkDomainServiceEnforcement`,
`checkDomainPolicyEnforcement`,
  `checkDomainEventEnforcement`,
  `checkDomainSpecificationEnforcement`,
  `checkStylingViewEnforcement`,
  `checkShellAppShellEnforcement`,
  `checkBootstrapAppBootstrapEnforcement`,
  `checkShellLayerEnforcement`,
  `checkShellRuntimeContextEnforcement`,
  `checkViewFxmlResources`, `checkViewEnforcement`,
  `checkViewContributionEnforcement`, `pmdViewContributionEnforcement`,
  `checkDomainUseCaseEnforcement`,
  `checkDataModelEnforcement`,
  `checkDataGatewayEnforcement`,
  `checkDataRepositoryEnforcement`,
  `checkDataQueryEnforcement`,
  `checkDataMapperEnforcement`,
  `checkDataPersistencecoreEnforcement`,
  `checkViewBinderEnforcement`,
`checkViewContributionModelEnforcement`,
`checkViewContentModelEnforcement`,
`checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
`checkViewInputEventEnforcement`, `checkViewPublishedEventEnforcement`,
`checkViewIntentHandlerEnforcement`, `checkLayeringArchitectureEnforcement`,
`checkDocumentationEnforcement`, and `jqassistantEffectiveRules`, each run
through `./gradlew <task> --console=plain`.

`pmdMain` and `spotbugsMain` are central blocking gates and may also be run as
focused direct entrypoints. `pmdStrictMain` remains the focused text-first PMD
entrypoint for the same blocking ruleset.

Architecture-focused entrypoints:

- `./gradlew checkArchitecture --console=plain`
  Aggregates `architectureTest`, `checkDomainLayerEnforcement`,
  `checkDomainApplicationServiceEnforcement`,
  `checkDataServiceContributionEnforcement`,
  `checkDomainPortEnforcement`,
  `checkDomainFactoryEnforcement`,
  `checkDomainServiceEnforcement`,
  `checkDomainEventEnforcement`,
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
  `checkViewContributionEnforcement`,
  `checkViewBinderEnforcement`,
  `checkViewContributionModelEnforcement`,
  `checkViewContentModelEnforcement`,
  `checkViewInspectorEntryEnforcement`, `checkViewLayerEnforcement`,
  `checkViewInputEventEnforcement`, `checkViewPublishedEventEnforcement`,
  `checkViewIntentHandlerEnforcement`,
  `checkShellRuntimeContextEnforcement`, `pmdArchitectureMain`, and
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
  `compileJava`, `pmdDomainApplicationServiceEnforcement`,
  `:build-harness:domainApplicationServiceTopologyCheck`, and
  `:build-harness:domainApplicationServiceDocumentationEnforcementCheck`.
- `./gradlew checkDataServiceContributionEnforcement --console=plain`
  Aggregates the focused Data ServiceContribution bundle through
  `compileJava`, `pmdDataServiceContributionEnforcement`, and
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
  Aggregates the focused Domain Port bundle through `compileJava` and
  `:build-harness:domainPortEnforcementDocumentationCheck`.
- `./gradlew checkDomainValueEnforcement --console=plain`
  Aggregates the focused `Domain Value` bundle through `compileJava` and
  `:build-harness:domainValueEnforcementDocumentationCheck`.
- `./gradlew checkDomainFactoryEnforcement --console=plain`
  Aggregates the focused `Domain Factory` bundle through `compileJava` and
  `:build-harness:domainFactoryEnforcementDocumentationCheck`.
- `./gradlew checkDomainServiceEnforcement --console=plain`
  Aggregates the focused `Domain Service` bundle through `compileJava` and
  `:build-harness:domainServiceEnforcementDocumentationCheck`.
- `./gradlew checkDomainPolicyEnforcement --console=plain`
  Aggregates the focused `Domain Policy` bundle through `compileJava` and
  `:build-harness:domainPolicyEnforcementDocumentationCheck`.
- `./gradlew checkDomainEventEnforcement --console=plain`
  Aggregates the focused Domain Event bundle through `compileJava` and
  `:build-harness:domainEventEnforcementDocumentationCheck`.
- `./gradlew checkDomainSpecificationEnforcement --console=plain`
  Aggregates the focused Domain Specification bundle through `compileJava`
  with the dedicated `DomainSpecificationRoleShape` compiler check.
- `./gradlew checkDomainUseCaseEnforcement --console=plain`
  Aggregates the focused Domain UseCase bundle through `compileJava`,
  `pmdDomainUseCaseEnforcement`,
  `:build-harness:domainUseCaseTopologyCheck`, and
  `:build-harness:domainUseCaseDocumentationEnforcementCheck`.
- `./gradlew checkDataModelEnforcement --console=plain`
  Aggregates the focused Data Model bundle through `compileJava`,
  `pmdDataModelEnforcement`,
  `dataModelArchitectureTest`,
  `:build-harness:dataModelTopologyCheck`, and
  `:build-harness:dataModelDocumentationEnforcementCheck`.
- `./gradlew checkDataGatewayEnforcement --console=plain`
  Aggregates the focused Data Gateway bundle through `compileJava`,
  `dataGatewayArchitectureTest`, and
  `:build-harness:dataGatewayEnforcementDocumentationCheck`.
- `./gradlew checkDataRepositoryEnforcement --console=plain`
  Aggregates the focused Data Repository bundle through `compileJava`,
  `pmdDataRepositoryEnforcement`, and
  `:build-harness:dataRepositoryEnforcementDocumentationCheck`.
- `./gradlew checkDataQueryEnforcement --console=plain`
  Aggregates the focused Data Query bundle through `compileJava`,
  `pmdDataQueryEnforcement`, and
  `:build-harness:dataQueryEnforcementDocumentationCheck`.
- `./gradlew checkDataPersistencecoreEnforcement --console=plain`
  Aggregates the focused Data Persistencecore bundle through
  `dataPersistencecoreArchitectureTest` and
  `:build-harness:dataPersistencecoreDocumentationEnforcementCheck`.
- `./gradlew checkLayeringArchitectureEnforcement --console=plain`
  Aggregates the dedicated `Layering Architecture` bundle through
  `:build-harness:layeringArchitectureTopologyCheck`.
- `./gradlew checkStylingLayerEnforcement --console=plain`
  Aggregates the styling-layer bundle through `compileJava`,
  `checkCentralizedStylesheets`, `checkDefinedStyleClassSelectors`,
  `checkDesktopPackagingInputs`, and the dedicated
  `pmdStylingLayerEnforcement` rule path.
- `./gradlew checkBootstrapAppBootstrapEnforcement --console=plain`
  Aggregates the focused `AppBootstrap` bundle through the dedicated
  `bootstrapAppBootstrapArchitectureTest` ArchUnit suite.
- `./gradlew checkShellRuntimeContextEnforcement --console=plain`
  Aggregates the dedicated `ShellRuntimeContext` PMD gateway-shape rule
  through one focused root entrypoint.
- `./gradlew checkShellLayerEnforcement --console=plain`
  Aggregates the dedicated `Shell Layer` bundle through
  `shellLayerArchitectureTest` and `:build-harness:shellLayerTopologyCheck`.
- `./gradlew checkStylingViewEnforcement --console=plain`
  Aggregates the passive-`View` direct-render styling bundle through
  `compileJava` with the dedicated `ViewDirectRenderStylingPlacement`
  compiler check and is also wired explicitly into the root `check`
  aggregate.
- `./gradlew checkShellAppShellEnforcement --console=plain`
  Aggregates the focused `AppShell` bundle through `compileJava` with the
  dedicated `ShellLifecycleHookOwnership` compiler check.
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

Local Gradle gates support concurrent runs by isolating mutable project-local
Gradle state for every wrapper-based invocation.

`CODEX_THREAD_ID` and `SALTMARCHER_GRADLE_ISOLATION_ID` remain trace labels for
local runs, but wrapper isolation no longer depends on either value being set.

Isolated invocations keep the normal entrypoints, but the public staged local
handoff now runs through `tools/gradle/run-staged-verification.sh`. Mutable
Gradle runtime state moves into one repo-local per-invocation run root under
`.gradle/isolated-runs/<run-id>/`, with build outputs under `build/`,
project-cache state under `project-cache/`, and wrapper plus writable
dependency-cache state under `gradle-user-home/`.

The wrapper boot path seeds the isolated user home from the shared Gradle home
only for matching wrapper content, then exports the isolated
`GRADLE_USER_HOME` before Gradle starts and injects the root build's
`--project-cache-dir` from that same per-run root before `settings.gradle.kts`
evaluates. Dependency reuse comes from a separate repo-local read-only
snapshot exposed through `GRADLE_RO_DEP_CACHE`, so
parallel invocations share immutable dependency content without sharing
writable Gradle user-home state.

The wrapper now publishes the internal plugins from
`tools/gradle/build-logic-settings` and `tools/gradle/build-logic` into one
immutable local Maven repository under
`.gradle/tooling-plugin-repos/<tooling-key>/maven`. Normal wrapper-based
Gradle runs resolve `saltmarcher.settings` plus the project plugins from that
binary repo instead of rebuilding those source builds on every invocation.
The shared immutable composite snapshot under
`.gradle/composite-snapshots/<tooling-key>/` is therefore limited to the real
runtime included builds `tools/gradle/build-harness`,
`tools/quality/rules/quality-rules`, and
`tools/quality/incubator/quality-rules-errorprone`, so concurrent invocations
do not contend on the same included-build source root while mutable per-run
state stays inside one run root.
Bundle-owned enforcement source trees under `tools/quality/*-enforcement` and
`tools/quality/documentation-enforcement` are not copied into that snapshot.
Runtime isolation links those bundle trees back to the repo-root source of
truth and relies on `saltmarcher.repoRootDir` for path resolution where bundle
build-harness wiring needs the owning source tree.
The included builds now register their bundle-local support sources and
build-harness task entrypoints directly from descriptor metadata in
`bundle.properties` plus the generated bundle catalog. That catalog now lives
as its own immutable snapshot under
`.gradle/enforcement-bundle-catalog-snapshots/<descriptor-key>/` and carries
already normalized repo-owned input paths, so wrapper-based runs do not
re-resolve the same descriptor paths inside Gradle. The root build now
registers standard `check*Enforcement` tasks from that same descriptor model,
while the early cache/build-dir isolation and generated-catalog propagation
come from the repo-local wrapper init script
`tools/gradle/saltmarcher-isolation.init.gradle.kts`. Root focused-bundle
selection still comes from the dedicated `saltmarcher.settings` plugin whose
binary artifact is published from `tools/gradle/build-logic-settings`.
`SALTMARCHER_ENFORCEMENT_BUNDLE_CATALOG` now points at that descriptor snapshot
instead of a file inside the composite mirror. Direct non-wrapper fallback
runs may still use source `includeBuild(...)` resolution, but that is the
slower compatibility path rather than the normal wrapper path.
That descriptor model now also owns the root build-harness optional-rule
registry: active bundles publish explicit
`buildHarnessArchitectureRuleClasses` and
`buildHarnessDocumentationRuleClasses`, and the root
`architectureCheck` / `documentationEnforcementCheck` pass those class names as
declared task inputs into the shared build-harness runner. The harness no
longer keeps a `META-INF/services` resource bridge for root optional rules, so
`:build-harness:processResources` should stay `NO-SOURCE` unless new real
resources are introduced deliberately.
Focused PMD, jQAssistant, build-harness, FXML, and styling checks now use
normal Gradle work avoidance with declared inputs plus reports or success
markers instead of blanket fresh-run forcing. That optimization does not
weaken blocking semantics: a successful unchanged run may be reused, while a
failing run still executes and fails fresh.
The same rule now applies to the remaining root-owned verification gates:
`spotbugsMain`, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, and `:build-harness:architectureCheck` may
finish `UP-TO-DATE` or `FROM-CACHE` after a successful unchanged run because
their current invocation semantics are expressed through reports or explicit
success markers rather than forced reruns.
The harness no longer depends on parallel families of
`build-harness-host.gradle.kts`, `errorprone-host.gradle.kts`,
`pmd-host.gradle.kts`, standard `root-host.gradle.kts`, or shared
`apply(from = ...)` descriptor scripts to restate the same paths, main classes,
and task shapes. Exception bundles now use dedicated verification-core plugins
referenced through `rootPluginId` metadata instead of local `root-host.gradle.kts`
scripts.

Wrapper-based `./gradlew` invocations now default to `--no-daemon` unless the
caller explicitly passes `--daemon` or `--no-daemon`, so the isolated
`GRADLE_USER_HOME` does not keep a detached daemon registry alive after the
client exits.
The wrapper no longer appends `--no-configuration-cache` by default. Cache
compatibility is now the responsibility of the underlying build logic and
individual tasks instead of a blanket runtime opt-out.
Wrapper-based runs now auto-append `--configuration-cache` only for a proven
safe subset:

- `help --task <anything>`
- `checkDocumentationEnforcement`
- focused public `check*Enforcement` bundle tasks whose owning descriptor has
  no `rootPluginId` and no `jqassistant.*` metadata

Broad staged surfaces such as `production-handoff`, direct low-level
investigation tasks, jQAssistant-backed focused bundles, and the exception
bundles `checkViewEnforcement` and `checkStylingLayerEnforcement` remain
explicit opt-in surfaces for configuration-cache use. Explicit user flags still
win: `--configuration-cache` forces it on and `--no-configuration-cache`
forces it off.
When configuration-cache reuse is active, the wrapper keys the shared state
roots by staged surface plus requested work signature, so two different
focused bundle invocations do not reuse the same writable
configuration/build state just because they both ran under `stage=default`.
The wrapper also owns a repo-local first-writer warmup lock per shared
configuration-state root. Only the uncached first writer is serialized; once
the wrapper-owned ready marker exists, later identical runs reuse the warmed
state without the extra lock wait.

After a local wrapper-based run finishes, the wrapper removes the
per-invocation root under `.gradle/isolated-runs/<run-id>/`. Successful runs
that produced public build artifacts overwrite `build/latest-output/`, while
maintained reports such as CKJM overwrite `build/latest-reports/ckjm/`. Failed
or interrupted runs retain only selected reports and test results under
`build/retained-gradle-failures/<run-id>/`, and the wrapper prints that stable
retained path after a failure. Report paths that Gradle emitted under
`.gradle/isolated-runs/<run-id>/...` were runtime locations and may already be
gone after cleanup. The wrapper prunes retained failure bundles plus
observable-run logs after seven days. Immutable tooling-plugin repos,
composite snapshots, and descriptor-catalog snapshots are bounded cache roots
rather than permanent
archives; maintenance cleanup keeps only the newest snapshot set for each root
and clears abandoned configuration-cache warmup locks when no active
Gradle/jQAssistant process remains.

Direct `gradle` invocations that bypass the wrapper do not receive the wrapper
managed `GRADLE_USER_HOME`, read-only dependency cache, or included-build
mirror path. The parallel-safe local contract therefore applies to
wrapper-based entrypoints.

The runtime wrappers also own the corresponding Gradle built-in CLI flags for
that invocation model. Callers may still pass investigation-oriented extra args
such as `--rerun-tasks`, `--stacktrace`, `--info`, or `--scan`, but
wrapper-owned flags such as `--console`, `--daemon`, `--no-daemon`,
`--project-cache-dir`, `--gradle-user-home`, and `--project-dir` are ignored
when repeated through `tools/gradle/run-observable-gradle.sh` or
`tools/gradle/run-staged-verification.sh`.

When a wrapper-based invocation requests a diagnostic surface such as
`quality-hygiene`, `architecture`, `view-topology`, `docs`, `metrics-report`,
or the focused `check*Enforcement` family, the runtime wrapper may append
Gradle `--continue` so independent failing diagnostics report together. Broad
handoff and build-health surfaces such as `production-handoff`, `build`, and
`check` keep their default fail-fast semantics unless the caller explicitly
passes `--continue`.

This does not make bytecode-dependent entrypoints source-only. `spotbugsMain`,
`ckjmMain`, `checkViewEnforcement`, and `checkViewArchitecture` still require current compiled classes;
if `compileJava` fails, those entrypoints may be skipped because their
prerequisite failed rather than because another independent check failed.

Local blocking Gradle gates must still fail on current violations, but a
successful unchanged verification result may now be reused when its task has
complete declared inputs plus report or marker outputs. This includes
SpotBugs, CPD, Lizard, CKJM, focused build-harness checks, documentation
enforcement, `checkNoCompiledArtifactsInSource`,
`checkDesktopPackagingInputs`, and the remaining incremental resource-policy
checks. Tool installation, dependency resolution, packaging, and generated
resource preparation remain separately incremental because they are not the
gate result itself. `compileJava`, PMD architecture, and ArchUnit-backed test
entrypoints still execute according to their own task semantics rather than a
blanket forced-rerun policy.
The same reuse contract now applies to the hot-path `quality-rules:jar`
artifact; successful unchanged packaging runs may stay `UP-TO-DATE` or come
`FROM-CACHE` without weakening the blocking semantics of the verification
surfaces that depend on it.

## References

- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Styling Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/styling.md:1)
