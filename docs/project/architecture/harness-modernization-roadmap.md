Status: Active
Source of Truth: Harness modernization target state, milestone order, cache
trust rules, and deletion requirements for content-addressed verification.

# Harness Modernization Roadmap - Content-Addressed Verification

Precondition: The architecture migration roadmap (M0-M6) is complete and
merged. This roadmap assumes the post-migration area structure and MUST NOT
start while any migration area is in flight.

Scope: `test/**` harness frames, `build.gradle.kts` harness registrations,
`tools/gradle/build-logic/**` (`BehaviorHarnessRegistration` and friends),
`tools/hooks/**` (new), `.github/workflows/**`, governance docs, and the
deletion of the bespoke selection machinery. Scenario SEMANTICS are frozen:
every assertion, input, and proven behavior claim survives conversion
unchanged.

## Target State

Gradle already implements content-addressed verification: a task with fully
declared inputs re-runs iff its input hash changed. Today every behavior
harness disables this (`outputs.upToDateWhen { false }`) and is a fail-fast
JavaExec monolith, which forced a parallel bespoke selection system
(`harness-map.json`, `select_harnesses.py`, the `behavior-gate` CI job).
Target: harnesses become ordinary JUnit test tasks with honest inputs and
caching enabled. Then `./gradlew check` IS the selective run: logically full,
physically incremental, and the entire bespoke selection layer is deleted.
CI's own execution is the authoritative record; local runs are fast feedback
via cache hits.

Net effect: exact selection without a maintained mapping, per-scenario
results through real JUnit XML, a trivially statable commit gate, and a
smaller system where mechanical enforcement replaces maintained claims.

## Milestones

### T0 - Pilot Conversion And Pattern

Write the decision record under `docs/project/decisions/`, superseding the
harness-traceability plan's H1-H3/H7 selection design; H4/H6 concepts survive
in T4/T5. Convert one representative JavaFX harness
(`hexMapEditorBehaviorHarness`) to a JUnit class: one `@Test` per scenario,
shared JavaFX bootstrap in `@BeforeAll`/`@AfterAll`, one Gradle `Test` task,
registered under `check`, `upToDateWhen { false }` removed, all
non-classpath inputs declared. Build logic gains the reusable registration
template.

Done when:

- pilot runs green as a `Test` task;
- JUnit XML lists every former proof item as a named test;
- a scenario-level failure does not hide later scenarios;
- an unrelated-file change leaves the task `UP-TO-DATE`;
- a change inside its classpath re-runs it.

### T1 - Fleet Conversion

Convert all remaining harness registrations area by area using the T0 pattern;
delete each JavaExec registration in the same pass. Mechanical parity rule:
the set of proven scenario claims per harness is identical before and after
(old proof-item ID maps 1:1 to test method name).

Done when:

- zero JavaExec behavior harnesses remain;
- `./gradlew check` executes every scenario;
- a scripted comparison shows 1:1 scenario parity per harness;
- full `check` completes locally.

### T2 - Cache Correctness And Hermeticity

Enable the local build cache for harness tasks. Fix nondeterminism: per-run
temp dirs stay out of declared outputs, outputs are relocatable, and no
wall-clock or PID leaks into results. Add the honesty check: a scheduled
`--rerun-tasks` full run must reproduce all cached verdicts; any divergence
is filed as an R2 issue, never silently re-cached.

Done when:

- rehearsed unrelated change gives a cache hit;
- rehearsed in-classpath change re-runs;
- rehearsed resource change re-runs;
- two consecutive `--rerun-tasks` full runs agree with the cache.

### T3 - Commit Gate Via Versioned Hooks

`tools/hooks/pre-commit` runs `./gradlew check` on the exact commit tree in a
clean `git worktree`; red or non-executed means the commit is rejected with
the failing tasks named. `core.hooksPath` is wired through repo bootstrap so a
fresh clone has the gate without manual setup. Cache hits make an
untouched-area commit near-instant.

Done when:

- a deliberately untested change is rejected naming the stale tasks;
- a tested one passes;
- the gate works on a fresh clone;
- a dirty worktree cannot leak untested edits into the gate.

### T4 - CI As Authority And Bespoke-Layer Deletion

CI runs `check` with a CI-owned Gradle cache. Local machines never write to
that cache; CI trusts only its own executions. Nightly `--rerun-tasks`
implements the T2 honesty check. Then delete `harness-map.json`,
`select_harnesses.py`, the `behavior-gate` job; update required checks
(ADR 0002), frozen-surfaces list, and `BehaviorHarnessRegistration` map
validation. Branch protection reflects the new required contexts.

Done when:

- a PR touching one area re-runs only that area's tasks in CI and the rest are
  cache hits;
- a PR touching build wiring re-runs everything;
- deleted files are gone from `main`;
- required checks are green and enforced;
- nightly job exists and has one green run.

### T5 - Resolution Report And Honesty Reviewer

Per-commit dossier derived from JUnit XML history in gate worktree runs:
which scenarios went red, and the tree-to-tree diff that turned each green.
Flaky results are flagged, filed as R2, and never counted as fixed. At each
commit with resolution cycles, the gate invokes a cross-model reviewer: repo
content is strictly untrusted data, verdicts cite diff evidence, `ok` admits,
`gaming` rejects, and `unclear` escalates to the CI judge via PR, never to the
owner. CI re-runs the reviewer on push over the pushed dossier. Amend the
resource policy first, in its own R3c-style PR, to cover local Anthropic API
calls for this reviewer.

Done when:

- rehearsed honest fix gives `ok` with cited evidence;
- rehearsed special-cased fix gives `gaming` and blocks;
- commit without resolutions makes no call;
- injection via code comment is ignored and noted;
- CI reviewer verdict gates merge.

### T6 - Governance Consolidation

Update `AGENTS.md`: verify entrypoint becomes `check` plus the gate, and
selection instructions are removed. Add one page under
`docs/project/verification/` covering the task model, cache trust rules, gate,
dossier, and reviewer. Prune superseded verification docs, refresh frozen
surfaces to the new gate files, and write a German owner status note.

Done when:

- no doc references the deleted machinery;
- `AGENTS.md` verify section fits the new model;
- frozen list matches reality;
- status note is delivered.

## Hard Rules

1. Scenario semantics are frozen: conversion may change the frame from `main`
   to test methods, never an assertion, an input, or a proven claim. Any
   semantic drift found during conversion is preserved as-is and filed as an
   issue.
2. Conservative by construction: anything not provably input-tracked, such as
   build wiring, build logic, hook code, or keep rules, invalidates everything;
   never special-case it.
3. Cache trust is one-directional: CI writes, everyone else reads. A local
   cache entry is convenience, never proof.
4. The nightly `--rerun-tasks` run is the permanent safety net; it may be made
   cheaper, never removed.
5. Deletion is part of done: a milestone that adds without removing its
   superseded counterpart is not complete.

## Risks

- Undeclared inputs become the new mapping drift; T2 rehearsals and the
  permanent nightly rerun counter it, and divergences are R2 issues.
- JavaFX test hermeticity is handled first in T0; the fallback is one JVM fork
  per test class, accepted cost.
- Conversion volume is schematic and area-parallelizable, but only one T1
  area conversion batch may be in flight at a time.
- CI cache poisoning is limited by protected-ref cache scope and CI-only write
  credentials; worst case equals today's full re-run.
- Reviewer false positives use `unclear` escalation to the CI judge, never to
  the owner.
