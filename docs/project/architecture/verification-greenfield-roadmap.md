Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: Verification greenfield ideal criteria, milestone order
M0-M5, and binding numeric targets for the verification harness.

# Verification Greenfield Roadmap

Predecessor: the
[Harness Modernization Roadmap](harness-modernization-roadmap.md) delivered
content-addressed verification (T0-T4 merged to `main`). This roadmap starts
from that state, absorbs the pending T5/T6 (see Predecessor Mapping), and
answers the owner question: "If the verification harness were rebuilt
greenfield today, what would be different?" Design decisions and evidence
live in the
[Verification Greenfield Target Design](verification-greenfield-target-design.md);
live progress lives only in the
[Verification Greenfield Ledger](verification-greenfield-ledger.md).

## Local-First Mandate

The primary consumer of this harness is the developer working in the local
`projects/SaltMarcher` checkout, not CI. Therefore:

- The fix must be felt locally: every criterion below is judged on the local
  machine, not only in CI. A harness that is fast and non-disruptive only in
  CI has not been fixed.
- `projects/SaltMarcher` must never lag `origin/main`. It is the newest
  working state from which the owner plans and starts work.
- Before any roadmap step, sync local to `origin/main`. If that collides with
  in-flight architecture work, commit and push that work first (so it resumes
  after the harness migration), then sync.

## Scope and Non-Goals

Scope: `test/**`, verification wiring in `build.gradle.kts`,
`tools/gradle/build-logic/**`, `tools/gradle/build-harness/**`, analyzer
configuration, `gradle.properties`, and the verification pages under
`docs/project/verification/`.

Non-goals, frozen by owner decision:

- The governance model stays unchanged: entrypoint contracts
  (`tools/gradle/run-staged-verification.sh production-handoff` /
  `focused-handoff`, `./gradlew check`, the versioned pre-commit gate),
  R-risk classes, judge workflow, and proof conventions. Milestones may
  simplify what the entrypoints run internally, never what they promise.
- Scenario semantics are frozen: every assertion, input, and proven behavior
  claim survives every conversion unchanged. Semantic drift found during work
  is preserved as-is and filed as an issue.

## The Ideal: Quality Criteria

A verification structure is "good" exactly to the degree it delivers these
criteria. They are the spine of this roadmap: the gap analysis keys off them,
every milestone names which criteria it advances, and the final measurement
adjudicates all of them.

- **V1 Proportional latency.** Verification cost scales with the change, not
  with the repository. Measurable: a warm no-change `check` stays within the
  no-change target; a docs-only change re-runs only documentation checks; a
  build-wiring change honestly re-runs everything.
- **V2 Trustworthy skips.** A task skipped as `UP-TO-DATE` or `FROM-CACHE` is
  proof, which requires fully declared inputs. Measurable: the scheduled
  nightly `--rerun-tasks` run reproduces all cached verdicts; any divergence
  is an R2 issue, never silently re-cached.
- **V3 One mechanism per concern.** One test framework, one architecture rule
  engine, one selection mechanism (Gradle input tracking), one compile of
  production sources per verdict. Measurable: mechanism count per concern is
  one; the duplicate is deleted, not deprecated.
- **V4 Hermetic, reproducible verdicts.** Same tree, same verdict: no writes
  outside Gradle-managed directories, no network during verification, no
  wall-clock or PID in results, parallel-safe. Measurable: two consecutive
  parallel full runs agree; rehearsals stay green with parallelism on.
- **V5 Scenario-granular, machine-readable results.** Every proven claim is a
  named JUnit test with XML output; one scenario failure never hides later
  scenarios. Delivered by T1; must survive every later conversion.
- **V6 Low marginal cost per new behavior.** Adding a behavior test is one
  test class or method: no build wiring, no registry entry, no frozen-surface
  edit. Measurable: the diff of adding a test touches only `test/**`.
- **V7 Hardware utilization.** Parallel task execution and parallel test
  workers with JVM reuse; the JavaFX toolkit boots once per worker JVM, not
  once per harness. Measurable: full-run wall time meets the binding targets
  on the owner machine.
- **V8 Minimal, justified infrastructure.** Every analyzer earns its place
  with a defect class no kept tool also covers; test infrastructure is small
  and deletable. Measurable: the analyzer justification table is complete,
  extra harness source sets are gone, and the deletion-list greps are empty.
- **V9 Non-disruptive local execution.** Verification runs headless in the
  background: no test window may seize desktop focus, and the developer can
  keep typing and working while a run proceeds. Measurable: a local `check`
  run opens zero visible windows and never steals focus.

## Gap Analysis

Summary of criteria violated on `main` as of 2026-07-13; the full table with
file-and-symbol evidence is in the
[Target Design](verification-greenfield-target-design.md).

| Criterion | Gap on `main` |
| --- | --- |
| V1 | Met for docs/no-change paths; full runs carry V7's serial cost. |
| V2 | Met in design; first green scheduled nightly run still unrecorded. |
| V3 | Two architecture engines (ArchUnit and build-harness JavaExec); ~34 `Test` tasks plus 5 source sets emulate tags; `checkRewriteNearMisses` is a second compile pass. |
| V4 | Parallel safety unproven because nothing has ever run in parallel. |
| V5 | Met since T1. |
| V6 | New harness still needs `build.gradle.kts` wiring plus a registry entry via frozen `BehaviorHarnessRegistration.kt`. |
| V7 | No `org.gradle.parallel`, no `maxParallelForks`, no worker/heap tuning; ~34 serial single-fork Test tasks, each with a cold JavaFX boot; hygiene analyzers serial. |
| V8 | SpotBugs `Effort.MAX`, ProGuard dead-code, two PMD passes, CPD, Lizard (Python venv), ckjm, and a near-miss recompile without an exclusivity justification; 5 harness source sets compile overlapping trees. |
| V9 | Tests call `Platform.startup` against the real display; locally each JavaFX harness opens a window that steals focus, so the machine is unusable during a run. CI hides this behind `xvfb`; local dev has no such shield. |

## Predecessor Mapping

| Predecessor item | Disposition here |
| --- | --- |
| T0-T3 | Done and merged; baseline of this roadmap. |
| T4 | In flight; its close-out (one green scheduled nightly run) is an M0 step. |
| T5 resolution report and honesty reviewer | Absorbed unscheduled into the Deferred Annex; requires a resource-policy amendment and an explicit owner decision. |
| T6 governance consolidation | Absorbed into M5. |

Once M0 closes T4, the predecessor roadmap is set to `Status: Deprecated`
with a successor pointer to this document; no work starts from it afterwards.

## Milestones

Ordered by damage stopped per effort; M1 is placed first among the code
milestones because it ends the daily pain (focus theft, serial slowness). A
later milestone must not start before the earlier one is green in the ledger.
At most one milestone is in flight.

### M0 - Charter, Local Sync, Baseline, Predecessor Close-Out

Commit this charter (roadmap, target design, ledger, owner notes, index
links). Bring `projects/SaltMarcher` to `origin/main`, preserving in-flight
work per the Local-First Mandate. Record the first green scheduled
`nightly-rerun-tasks` run, close T4 in the predecessor ledger, and deprecate
the predecessor roadmap with a successor pointer. Measure the baseline on the
owner machine, headless: full cold `check --rerun-tasks`, warm
`check --rerun-tasks`, warm no-change `check`, and one pre-commit gate run on
an untouched-area commit. Calibrate the binding numeric targets.

Done when:

- all four charter documents are merged and indexed, green under
  `./gradlew checkDocumentationEnforcement --console=plain` and
  `git diff --check`;
- `projects/SaltMarcher` is on `origin/main` (plus this roadmap) with in-flight
  work preserved on pushed branches;
- the predecessor ledger shows T4 Done with the nightly proof recorded, and
  the predecessor roadmap is `Status: Deprecated` with a successor pointer;
- the ledger baseline table carries all four measurements with literal
  `BUILD SUCCESSFUL in ...` evidence;
- the binding targets table is calibrated and marked binding;
- a German owner status note covers the M0 close-out.

### M1 - Headless and Parallel Local Execution (Non-Frozen Surfaces Only)

The first relief milestone. In `gradle.properties` and the behavior `Test`
task configuration in `build.gradle.kts` (neither is a frozen surface): make
Monocle headless the default so no test window ever appears
(`-Dglass.platform=Monocle -Dmonocle.platform=Headless -Dprism.order=sw`),
and enable `org.gradle.parallel`, `maxParallelForks`, the configuration
cache, and daemon heap. Rehearse parallel safety (isolated `XDG_DATA_HOME`
per task, no shared temp paths) and verdict parity: the executed task set and
every verdict match the serial baseline.

Done when:

- a local full `check` opens zero visible windows and never steals focus
  (V9), verified by running it while typing in another application;
- two consecutive parallel full `check --rerun-tasks` runs are green and
  agree with the serial baseline verdicts;
- full warm `check --rerun-tasks` wall time is at least 40% below the M0
  baseline with an identical executed-task set.

### M2 - Test Topology Consolidation

Execute D1 and D2 of the target design: merge the harness source sets into
the one `test` source set, replace the ~34 per-harness `Test` tasks and the
registry classification with JUnit `@Tag`s and at most four `Test` tasks, and
introduce the shared headless JavaFX bootstrap extension (Monocle boots once
per worker JVM). Pilot one harness area first and freeze the pattern in an
ADR; then convert the fleet area by area (agent-parallelizable, one batch in
flight). All `BehaviorHarnessRegistration.kt` changes and its deletion land
in one designated R3c batch.

Done when:

- zero harness source sets remain; the verification `Test` task count is at
  most four;
- a scripted 1:1 comparison shows every former test name survives per area;
- the V6 rehearsal passes: adding a new behavior test touches only `test/**`;
- the R3c batch PR is merged with the full gate set;
- full `check` is green via the unchanged entrypoints.

### M3 - Analyzer Diet

Execute D5: for each analyzer, run the audit, record the finding diff, and
keep or drop by exclusivity. Merge the near-miss checks into the single
Error Prone compile so the second full recompile disappears. Present the
findsecbugs question and every drop decision to the owner via the judge
workflow.

Done when:

- the analyzer justification table names, for every kept tool, the defect
  class only it covers, and for every dropped tool the recorded finding diff
  that justified the drop;
- the near-miss second compile pass is gone;
- full `check` verdict parity holds for all kept analyzers.

### M4 - One Architecture Engine

Execute D4: ArchUnit becomes the only code-structure engine; documentation
rules move into one cacheable `docsCheck` task; the build-harness JavaExec
mains are deleted. Acceptance is the mechanical rule-parity list: every
current rule ID has a named new home and fires on a rehearsed synthetic
violation.

Done when:

- `ArchitectureCheckMain` and `DocumentationCheckMain` are deleted;
- every rule in the parity list fires on its rehearsed violation;
- a docs-only change re-runs only `docsCheck` (rehearsed);
- the build-harness included build is shrunk to what the ported rules need,
  or deleted.

### M5 - Frozen Teardown and Governance Doc Consolidation

One designated R3c batch: replace the marker-file phase barriers in
`SaltmarcherVerificationCorePlugin.kt` with plain task dependencies (D6),
simplify `run-staged-verification.sh` internals (contract unchanged), refresh
`tools/quality/config/frozen-surfaces.txt`, and update required checks if
task names changed. Then the absorbed T6: update the AGENTS.md verify
wording, add one task-model page under `docs/project/verification/`, prune
superseded verification docs. Close with the final measurement against every
binding target and the deletion-list grep audit.

Done when:

- the R3c batch is merged with the full gate set;
- no document references deleted machinery;
- the deletion-list greps from the target design return empty;
- the final measurement adjudicates every binding target, each miss with an
  individually justified, judge-accepted exception;
- a German owner closing note is delivered and the ledger is closed.

## Binding Numeric Targets

Provisional until the M0 calibration; from then on binding. Each miss needs
an individually justified, judge-accepted exception recorded in the ledger;
blanket waivers do not exist. Gamed hits are Rework.

1. Full warm `check --rerun-tasks` on the owner machine: <= 20 minutes.
2. Warm no-change `check`: <= 2 minutes.
3. Pre-commit gate on an untouched-area commit: <= 5 minutes.
4. Verification `Test` task count: <= 4; harness source sets: 0.
5. Architecture rule engines: exactly 1.
6. Adding a behavior test: diff confined to `test/**`.
7. A local `check` opens zero visible windows and never steals focus.
8. Zero `upToDateWhen { false }` and zero `cacheIf { false }` on verification
   tasks (guarded regression tripwire; already true on `main`).

## Hard Rules

1. Scenario semantics are frozen (see Non-Goals).
2. Anything not provably input-tracked invalidates everything; never
   special-case it.
3. Cache trust is one-directional: CI writes, everyone else reads.
4. The nightly `--rerun-tasks` run is the permanent safety net; it may be
   made cheaper, never removed.
5. Deletion is part of done: a milestone that adds without removing its
   superseded counterpart is not complete.
6. Frozen-surface edits happen only inside the two designated R3c batches
   (M2, M5); there are no drive-by frozen edits.
7. Local runs are headless from M1 onward; a change that reintroduces a
   focus-stealing window is a regression, not a preference.

## Deferred Annex

T5 of the predecessor (per-commit resolution dossier plus cross-model
honesty reviewer) is absorbed here but deliberately unscheduled: it extends
the governance model, needs a resource-policy amendment for local Anthropic
API calls, and therefore an explicit owner decision before activation. Its
full specification remains readable in the predecessor roadmap.

## Risks

- Monocle headless uses the software pipeline; countermeasure: assertions
  walk the scene graph, not real pixels, and the M2 pilot proves 1:1 parity
  before the old boot path is deleted.
- Parallel execution surfaces hidden shared state; countermeasure: M1
  rehearsals, `forkEvery` fallback per class only for proven-stateful tests,
  and the permanent nightly rerun.
- Tag conversion drifts semantics; countermeasure: scripted 1:1 test-name
  parity per area and one conversion batch in flight at a time.
- Analyzer drops lose real coverage; countermeasure: keep/drop only by
  recorded finding diffs, judge-reviewed, reversible by revert.
- R3c batches stall on gates; countermeasure: exactly two batches, scoped in
  advance, everything else avoids frozen surfaces.

## References

- [Verification Greenfield Target Design](verification-greenfield-target-design.md)
- [Verification Greenfield Ledger](verification-greenfield-ledger.md)
- [Verification Greenfield Owner Status Notes](verification-greenfield-owner-status-notes.md)
- [Harness Modernization Roadmap](harness-modernization-roadmap.md) (predecessor)
- [Verification Core Architecture](verification-core.md)
- [Agent Instruction Standard](agent-instructions.md)
