Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: Verification greenfield design decisions D1-D6, full gap
evidence, and the deletion list for the verification harness rebuild.

# Verification Greenfield Target Design

Design companion to the
[Verification Greenfield Roadmap](verification-greenfield-roadmap.md). The
roadmap owns criteria, milestones, and targets; this document owns the design
decisions, the evidence, and the deletion list. Implementation deviates from
a decision only through an amendment commit to this document first.

## Full Gap Evidence

State of `main` at `61d9698cb` (2026-07-13). Re-locate by symbol name when
consuming this table; line numbers drift.

| Criterion | Violation | Evidence |
| --- | --- | --- |
| V3 | Two architecture engines | ArchUnit suites under `test/architecture/system/`; JavaExec mains `ArchitectureCheckMain`, `DocumentationCheckMain` registered in `tools/gradle/build-harness/build.gradle.kts` (`registerRepoVerificationTask`). |
| V3 | Tag emulation via task topology | ~34 `Test` tasks with per-class `include` filters registered through `BehaviorHarnessRegistry.junitTest` (`BehaviorHarnessRegistration.kt`); classification enum instead of JUnit `@Tag` (zero `@Tag` in `test/`). |
| V3 | Second compile pass | `checkRewriteNearMisses` depends on a focused Error Prone recompile of all production sources (`SaltmarcherVerificationCorePlugin.kt`). |
| V4 | Parallel safety unproven | No verification task has ever run concurrently; isolation relies on per-task `XDG_DATA_HOME` dirs (`build.gradle.kts`, harness `doFirst` blocks). |
| V6 | Wiring cost per new harness | New behavior surface requires a `build.gradle.kts` task registration plus registry participation; `BehaviorHarnessRegistration.kt` is a frozen surface. |
| V7 | No parallelism configured | `gradle.properties` contains only `org.gradle.caching=true`; no `org.gradle.parallel`, `workers.max`, `jvmargs`; no `maxParallelForks`/`forkEvery` anywhere in `build.gradle.kts` or `tools/gradle/**`. |
| V7 | Cold JavaFX boot per harness | Each UI harness calls `Platform.startup` itself in `@BeforeAll` (e.g. `HexMapEditorBehaviorHarness`, `EncounterStateTabHarness`); one JVM fork per Test task, serial. |
| V7 | Serial hygiene phase | Phase barriers serialize compile -> structure -> hygiene via marker files (`SaltmarcherVerificationCorePlugin.kt`, `VerificationLifecycleCatalog.kt`). |
| V8 | Unjustified analyzer breadth | SpotBugs `Effort.MAX` (`build.gradle.kts`), ProGuard `checkNoDeadCode`, `pmdMain` plus `pmdStrictMain`, `cpdMain`, `lizardMain` with Python venv (`SetupLizardTask`), `ckjmMain`, near-miss recompile (`QualityConventionLifecycle.kt`). |
| V8 | Overlapping source sets | `dungeonEditorBehaviorHarness`, `hexMapEditorBehaviorHarness`, `worldPlannerBackendHarness`, `worldPlannerUiHarness` beside `test` (`build.gradle.kts` source-set block). |
| V9 | Windowed local runs | Harnesses boot real JavaFX via `Platform.startup`; locally each opens a focus-stealing window. CI only survives this via `xvfb-run` in `.github/workflows/quality-platforms.yml`; local dev has no shield. |

## Design Decisions

### D1 - One Test Source Set, Tag-Based Topology

Merge the four harness source sets into the one `test` source set (packages
keep their paths; only source-set membership changes). Replace the ~34
per-harness `Test` tasks and the `FOCUSED`/`AGGREGATE`/`UTILITY`
classification with JUnit `@Tag`s (`behavior`, `architecture`, plus the
existing plain unit surface) and at most four `Test` tasks: `test`,
`behaviorTest`, `architectureTest`, and the residual smoke surface if the
pilot shows it needs its own fork profile. `check` depends on all of them.

Rejected: per-area `Test` tasks with narrowed declared classpaths - with one
monolithic production classpath that is unhonest selectivity, exactly the
undeclared-input failure V2 forbids. Rejected: keeping the registry with a
`junitTest` template per harness - it preserves the per-harness wiring cost
(V6) and the 34-fork topology (V7).

### D2 - Shared Headless JavaFX Bootstrap (Monocle)

One JUnit 5 extension owns the toolkit and runs it headless via Monocle
(`-Dglass.platform=Monocle -Dmonocle.platform=Headless -Dprism.order=sw`):
`Platform.startup` once per worker JVM, `Platform.exit` on JVM shutdown,
scenario helpers for `runLater`-and-await. Test classes drop their hand-rolled
`@BeforeAll` bootstraps. Headless is the default for local and CI runs alike,
which satisfies V9 (no focus-stealing windows) and removes the need for
`xvfb` on CI. Fork reuse stays on; `forkEvery` is a per-class fallback only
for classes the M2 pilot proves stateful.

Rationale: V9 makes non-disruptive local execution a hard requirement, so a
headless glass is mandatory, not optional. The rendering-path change
(software pipeline) is safe here because the assertions walk the scene graph
(`Labeled.getText`, canvas paint state), not real screen pixels; the M2 pilot
proves 1:1 scenario parity before the windowed boot path is deleted.

Rejected: keeping real-display `Platform.startup` and shielding only CI with
`xvfb` - it leaves the local machine unusable during runs (V9 fail) and keeps
two divergent boot paths (V3).

### D3 - Parallelism

`gradle.properties` (not frozen): `org.gradle.parallel=true`,
`org.gradle.configuration-cache=true`, `org.gradle.workers.max` sized to the
owner machine, `org.gradle.jvmargs` heap for the daemon. `maxParallelForks`
on behavior `Test` tasks, sized `min(4, cores/2)` initially and recalibrated
against the M0 baseline. Parallel-safety rehearsal: provoke two behavior
tasks to run concurrently and prove isolation (distinct `XDG_DATA_HOME`, no
shared write paths outside Gradle-managed dirs). Delivered together with D2 in
M1 so the first relief PR both silences the windows and uses the cores.

### D4 - One Architecture Engine

ArchUnit becomes the only code-structure engine: port `SourceLayoutRules` and
`BuildHarnessPolicyRules` into the existing `test/architecture` suites.
Documentation rules (`DocumentationHygieneRules`, `DomainDocumentationRules`)
become one cacheable `docsCheck` task with declared inputs (`docs/**`,
`AGENTS.md`, `src/**/DOMAIN.md`, markdown under `tools/quality/**`) so a
docs-only edit re-runs only docs checks (V1). The JavaExec mains and their
registrations are deleted. Acceptance is the rule-parity list below.

Rule-parity list (every current rule ID -> new home; each fires on a
rehearsed synthetic violation before the old engine is deleted):

| Current rule | New home |
| --- | --- |
| `SourceLayoutRules` (package = path, root layout) | ArchUnit test in `test/architecture/system/` |
| `BuildHarnessPolicyRules` (workflow guard, forbidden files) | ArchUnit or plain JUnit test in `test/architecture/system/` |
| `DocumentationHygieneRules` (metadata, index, size, unique source of truth, legacy roots, source markdown) | `docsCheck` cacheable task |
| `DomainDocumentationRules` (DOMAIN.md consistency) | `docsCheck` cacheable task |

Rejected: porting the ArchUnit suites into the bespoke engine - it keeps the
reflective rule loader and JavaExec forks alive and inverts the direction of
consolidation.

### D5 - Analyzer Diet

Audit-then-decide, mechanical via finding diffs; every keep/drop lands in the
analyzer justification table in the ledger. Rules of the audit: run both
tools on the same tree, diff the finding sets, keep a tool only for a defect
class no kept tool also covers, and record the diff as proof either way.

| Analyzer | Audit question |
| --- | --- |
| Lizard (Python venv) | Does it find complexity defects PMD's complexity rules cannot express? Drop candidate; also removes the venv/pip bootstrap. |
| CPD | Keep duplication checking, but as the Gradle-native cacheable task instead of a forked PMD-CLI JVM. |
| `checkRewriteNearMisses` | Fold the near-miss checks into the single Error Prone production compile; the second recompile disappears. |
| `checkNoDeadCode` (ProGuard) | Keep the capability; measure warm cost; demote to the nightly tier if it stays a top-3 cost. |
| ckjm | CI-only advisory today; keep, drop, or fold into the metrics the kept tools already report. |
| SpotBugs `Effort.MAX` | Measure MAX vs DEFAULT on wall time and finding diff; keep the cheapest level that loses no accepted finding class. |
| findsecbugs | Surface to the owner: it is a security-analysis pass; keep or drop is an owner decision, not an audit outcome. |

### D6 - Phase Barriers to Task Dependencies

Replace the marker-file barriers (`ResetProductionHandoffMarkersTask`,
`WriteProductionHandoffMarkerTask`, the hygiene `onlyIf` barrier) with plain
task dependencies: hygiene tasks `dependsOn` compile integrity, structure
tasks likewise; inside a phase everything may run in parallel. The
fail-ordering guarantee (hygiene never starts before structure is green) is
preserved by the dependency edges. Lands in the M5 R3c batch because the
plugin is frozen.

## Deletion List

At M5 close-out these greps over the repository return empty (deletion is
part of done):

- `ArchitectureCheckMain`, `DocumentationCheckMain`,
  `ArchitectureRuleLoader` (build-harness engine)
- `BehaviorHarnessRegistration`, `BehaviorHarnessClassification`,
  `CheckBehaviorHarnessTopologyTask`
- `dungeonEditorBehaviorHarness`, `hexMapEditorBehaviorHarness`,
  `worldPlannerBackendHarness`, `worldPlannerUiHarness` as source-set names
- `upToDateWhen { false }`, `cacheIf { false }` on verification tasks
- `Platform.startup` in `test/**` outside the shared extension
- `ProductionHandoffHygienePhaseBarrier`, `verification-markers`
- `SetupLizardTask`, `LizardCheckTask` (if the D5 audit drops Lizard)
- `checkRewriteNearMisses` as a separate compile pass
- `xvfb-run` in `.github/workflows/quality-platforms.yml` (once Monocle is the
  CI default)

## Execution Constraints for Cheap Executors

- Work only in `projects/SaltMarcher`; keep it on `origin/main` (see the
  roadmap's Local-First Mandate). Run every test headless (Monocle), never on
  the real display, and minimize full runs.
- One milestone in flight; inside M2, one area conversion batch in flight.
- Every conversion is schematic: copy the frozen pilot pattern, run the
  parity script, record the literal proof in the ledger.
- Frozen surfaces (`tools/quality/config/frozen-surfaces.txt`) are touched
  only in the two designated R3c batches (M2, M5).
- Any deviation from D1-D6 requires an amendment commit to this document
  before the implementing commit.
