Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
Source of Truth: Detailed local gate inventory for SaltMarcher quality
platforms.

# Quality Platforms Local Gates

## Purpose

This subordinate standard defines the detailed local gate inventory beneath
the umbrella
[Quality Platforms Standard](docs/project/verification/quality-platforms.md:1).
Aggregate entrypoints and local invocation plus concurrent-work policy live in
[Quality Platforms Local Entrypoints](docs/project/verification/quality-platforms-local-entrypoints.md:1).

## Local Gate Inventory

### Compiler Hygiene

`./gradlew compileJava` is a `Blocking Local Gate`.

It owns Java compilation on production source roots `bootstrap/`, `shell/`,
and `src/`. Root `compileJava` does not enable Error Prone, NullAway,
project-local Error Prone checkers, architecture checkers, tests, or quality
gates.
Main production sources are modeled through Gradle's `main` source set, so
`compileJava` owns the main Java class output directory and relies on Gradle's
normal incremental compilation and stale-output cleanup for that source set.
SaltMarcher must not add a separate pre-compile cleanup task that mutates the
`compileJava` classes directory outside Gradle's source-set output model.

Compiler-backed verification that needs Error Prone runs through focused
verification compiles behind technical `check*Enforcement` layer diagnostic
surfaces and the public `production-handoff` route. Passive `View` graph and
FXML analysis enter local quality through `checkViewEnforcement`, while the
technical Domain, Data, Shell, Bootstrap, Styling, and Layering diagnostics are
`checkDomainEnforcement`, `checkDataEnforcement`, `checkShellEnforcement`,
`checkBootstrapEnforcement`, `checkStylingEnforcement`, and
`checkLayeringEnforcement`. Whole-program compiled dead-code analysis enters
through `checkNoDeadCode`. Internal bundle selector tasks may still exist as
technical implementation surfaces beneath those layer diagnostics, but they are
not part of the public verification API. Build-harness owner metadata is
coalesced into one internal task per layer surface and rule kind before
execution; role-local owner splits do not create public proof routes by
themselves. The technical owner split behind the View diagnostic route is
now only the build-harness View topology core plus the shared Error Prone View
core under `tools/quality/incubator/quality-rules-errorprone/**`.
Focused compile, FXML, and topology paths are wired into the central `check`
aggregate through the named architecture aggregates so `build` still runs the
full architecture harness through `check`.

### Complexity, Duplication, And Metrics

| Platform | Status | Entrypoint | Current policy |
| --- | --- | --- | --- |
| PMD XML/HTML report production | `Informational Report` | `./gradlew pmdMain` | `pmdMain` runs `tools/quality/config/pmd/complexity-ruleset.xml` and `tools/quality/config/pmd/law-of-demeter-ruleset.xml` once on production Java sources and writes the XML/HTML PMD reports. It is the report producer and diagnostic PMD entrypoint, not the blocking owner for direct or aggregate proof claims. |
| PMD non-architecture smells | `Blocking Local Gate` | `./gradlew pmdStrictMain` | `pmdStrictMain` depends on `pmdMain` and derives the text-first `build/reports/pmd/main-strict.txt` report from `pmdMain`'s XML result instead of running PMD again. It fails the direct or aggregate invocation when the XML report contains PMD violations or analysis diagnostics. PMD owns non-architecture smell policy plus `UnusedAssignment`, including generic source-smell families such as `LawOfDemeter`, `GodClass`, `CouplingBetweenObjects`, `TooManyMethods`, `TooManyFields`, `UselessOverridingMethod`, `UnnecessaryConstructor`, and unnecessary casts; focused Error Prone verification compiles own `UnusedLabel`, `UnusedMethod`, `UnusedNestedClass`, and `UnusedVariable` where those checkers are part of the selected enforcement surface. |
| Near-miss hygiene checks | `Blocking Local Gate` | `./gradlew checkRewriteNearMisses` | Runs first-party Error Prone checks for Map key-presence checks that compare `Map.get(...)` with `null` and JavaBean-style DTO-overfetching candidates for configured carrier packages. It does not mutate tracked sources. It is a near-miss quality gate, not a proof of redundant `A -> B -> D` carrier-converter chains. Redundant casts are owned by the separate PMD source-smell gate. |
| Dead code reachability | `Blocking Local Gate` | `./gradlew checkNoDeadCode` | Runs the verification-core whole-program reachability analysis for compiled production declarations: files, top-level types, secondary top-level types, nested and named local types, constructors, methods, and fields. JVM `ConstantValue` fields are not reported because Java inlines compile-time constants and the compiled graph cannot prove source-level reads from bytecode field access. Structural roots currently include the configured JavaFX launcher and preloader classes, exact concrete shell contribution roots matching `ShellViewDiscovery`, exact concrete data service contribution roots matching `ServiceContributionDiscovery`, merged FXML controller resources, `META-INF/services` providers, and the explicit fallback rules in `tools/quality/config/deadcode/keep-rules.pro`. Non-constant runtime reflection is only supported through explicit keep rules. |
| SpotBugs plus FindSecBugs | `Blocking Local Gate` | `./gradlew spotbugsMain` | Runs bytecode bug and security-smell analysis with SpotBugs effort `MAX` and confidence `MEDIUM`. Generic bytecode-level useless-indirection findings belong to this standard SpotBugs surface when the active SpotBugs detector reports them; SaltMarcher does not add a separate first-party indirection checker or suppress those standard detectors through the local exclude filter. |
| CPD | `Blocking Local Gate` | `./gradlew cpdMain` | Runs PMD CPD for Java with `minimumTokens = 100`, matching PMD's documented Java example value, and writes its report under the active worktree's normal `build/reports/cpd/` surface. |
| Lizard | `Blocking Local Gate` | `./gradlew lizardMain` | Runs pinned `lizard==1.21.3` for Java with max cyclomatic complexity `15`, matching Lizard's default warning threshold, and writes its report under the active worktree's normal `build/reports/lizard/` surface. |
| CKJM ext | `Informational Report` | `./gradlew ckjmMain` | Runs on freshly compiled production classes and writes `main.txt` plus `summary.md` under the active worktree's normal `build/reports/ckjm/` surface. CKJM is a direct report entrypoint and CI artifact source, not a dependency of the blocking `check` / `production-handoff` lifecycle catalog. CKJM hotspot findings remain warnings rather than blocker failures. |

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
`CouplingBetweenObjects`, `ExcessiveImports`, `GodClass`, class-level
`CyclomaticComplexity`, and `TooManyMethods` run through SaltMarcher
role-aware PMD classes where stock class/file metrics conflict with
mechanically enforced canonical role shape. Those classes keep concrete PMD
findings blocking and do not create a package-wide `src/view/**` exemption:
they skip only recognized canonical view role files for role-shape metrics,
and `TooManyMethods` also skips top-level domain `published/**` boundary
sources whose many passive accessors are published-language shape rather than
implementation sprawl. Feature-runtime operations boundary sources under
`src/features/**/runtime/*Operations.java`, feature-runtime roots under
`src/features/**/runtime/*RuntimeRoot.java`, feature-runtime composition helpers
under `src/features/**/runtime/*RuntimeAssembly.java`, and narrow legacy shell
operations adapters under `src/features/**/shell/*Operations.java` are also
role-aware metric sources: the feature-runtime owner makes typed runtime
operation boundaries and runtime composition review-owned architecture, and PMD
must not force them into wrapper-command, data-holder, split-root, or artificial
micro-wiring shapes solely to satisfy generic class metrics.
`DataClass` remains blocking for ordinary classes but ignores Java records and
expected passive carriers for `src/data/**/model/*PersistenceSchema.java`,
`src/data/**/model/*Record.java`, and `src/domain/**/published/**` source
files. Records are already an explicit immutable carrier shape in the domain,
data, and view-layer standards.
`LawOfDemeter` remains blocking for production source, but its ruleset ignores
JavaFX control-composition accessors such as `getChildren`, `getStyleClass`,
`getItems`, `getSelectionModel`, `getStylesheets`, and `getIcons`; those calls
are normal JavaFX composition, resource, and startup responsibilities governed
by the view, shell, and bootstrap gates. The same false-positive boundary allows
only the JavaFX preloader `javaFxPreloaderStateChangeNotification.getType()`
read used to distinguish startup phases. This is a framework-accessor allowance
only; it must not become a package-family or feature-family exemption.
Role-specific source-pattern PMD rules are not part of the active local gate
inventory. If a role owner still needs a source-pattern rule, the rule must be
wired through an explicit active owner and documented with the real blocking
route before an enforcement row may claim mechanical ownership.
Generic indirection coverage stays standard-tool-first: PMD owns source-level
useless override and unnecessary constructor rules, SpotBugs owns active
bytecode-level useless-indirection findings, and jQAssistant owns only the
role-aware relay-stack blocker that requires graph traversal. The local handoff
harness therefore must not add Sonar, Semgrep, CodeQL, Designite, JDeodorant,
or a new first-party indirection rule unless an owner records the exact gap that
the current blocking gates cannot express.

`checkRewriteNearMisses` is wired into the shared `check` /
`production-handoff` lifecycle catalog through focused first-party Error Prone
checks. The gate remains non-mutating and configuration-cache compatible
because it no longer invokes third-party source rewrite tasks.

`pmdStrictMain` is wired into the shared `check` / `production-handoff`
lifecycle catalog as the blocking PMD owner for this surface. It depends on
`pmdMain`, the single PMD scanner and XML/HTML report producer, then derives
the strict text report and fails the direct or aggregate invocation when the XML
report contains PMD violations or analysis diagnostics. Role-aware metric
classification happens inside the PMD ruleset itself, not inside the strict
text-report derivation.
`pmdTest` is disabled; PMD
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
`spotbugsTest` is disabled because generic test-source analysis is not the
project strategy for behavior proof. Behavior regression coverage belongs in
focused production-path behavior harnesses and their documented proof routes.

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
source smells stay with PMD, objective cycle blockers stay with the generic and
focused ArchUnit suites, whole-program dead-code reachability stays with
`checkNoDeadCode`, and jQAssistant owns direct and focused graph analysis where
role-aware traversal matters. A jQAssistant rule is blocking only when a direct
or focused jQAssistant request selects a `BLOCKER` group; the View-layer
`view-layer-cycle-diagnostics` group runs at minor severity and remains a graph
diagnostic until the View owner defines a precise forbidden cycle level.
jQAssistant scan tasks own the classpath and source-root inputs that build the
local graph store. Analyze tasks own rule directories, analyze groups, and
reports, so rule-only changes rerun analysis against the existing local store
instead of forcing a new scan.

Focused PMD, SpotBugs, CPD, Lizard, and CKJM entrypoints must stay independent
of the closed-world View topology owner behind `checkViewEnforcement`; they may
be run together for quality investigation without pulling in the separate
view-layer enforcement surface. The dedicated `checkNoDeadCode` blocker is the
only whole-program dead-code hygiene gate in the central quality path.

Checkstyle metrics and Semgrep are deferred unless current tooling cannot
express a concrete rule.

Architecture blockers now run only through focused Error Prone verification
compiles, ArchUnit, jQAssistant, and the external build harness behind the public
architecture and enforcement surfaces.
Custom architecture blockers must stay engine-specific: PMD and SpotBugs remain
standard-tool-first for generic hygiene, ArchUnit for simple dependency and cycle
boundaries, jQAssistant for graph traversal diagnostics, Error Prone for
compiler-local symbol and AST constraints, and build-harness for repository
topology, documentation coverage, and source inventory checks. A first-party
checker that duplicates a standard-tool rule is a retirement candidate unless
its owner document records the rule gap and public proof route.

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
| `./gradlew checkViewFxmlResources` | `Blocking Local Gate` | View FXML files must live under the MVVM view-resource tree, avoid inline scripts, and use passive View controllers matching the owning view area. For the complete passive-`View` mechanical diagnostic route, use `./gradlew checkViewEnforcement`. |

The styling rules behind the stylesheet and selector gates, plus the remaining
direct-render styling invariants for passive `View` surfaces, are defined in
the
[Styling Standard](docs/project/architecture/patterns/styling.md:1),
[Styling Layer Enforcement](docs/project/architecture/enforcement/styling-layer-enforcement.md:1),
and
[View Styling Enforcement](docs/project/architecture/enforcement/styling-view-enforcement.md:1).
The styling-layer mechanical diagnostic route is `./gradlew
checkStylingEnforcement`; it aggregates the stylesheet, selector,
bundle-local stylesheet-owner, compile-side inline-style, manual-node-layout
styling, and programmatic-styling checks for the layer itself.
The passive-`View` direct-render placement diagnostic route also runs through
`./gradlew checkStylingEnforcement`; centralized stylesheet ownership and
selector vocabulary remain available through the separate layer-wide direct
tasks listed above.

## References

- [Quality Platforms Standard](docs/project/verification/quality-platforms.md:1)
- [Quality Platforms Local Entrypoints](docs/project/verification/quality-platforms-local-entrypoints.md:1)
- [Layering Architecture Enforcement](docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Styling Standard](docs/project/architecture/patterns/styling.md:1)
