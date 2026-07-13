# Harness Modernization Roadmap — Content-Addressed Verification

Status: Binding once started
Precondition: The architecture migration roadmap (M0–M6) is complete and
merged. This roadmap assumes the post-migration area structure and MUST NOT
start while any migration area is in flight.
Scope: `test/**` harness frames, `build.gradle.kts` harness registrations,
`tools/gradle/build-logic/**` (BehaviorHarnessRegistration and friends),
`tools/hooks/**` (new), `.github/workflows/**`, governance docs, and the
deletion of the bespoke selection machinery. Scenario SEMANTICS are frozen:
every assertion, input, and proven behavior claim survives conversion
unchanged.

## Target State (why this roadmap exists)

Gradle already implements content-addressed verification: a task with fully
declared inputs re-runs iff its input hash changed. Today every behavior
harness disables this (`outputs.upToDateWhen { false }`) and is a fail-fast
JavaExec monolith, which forced a parallel bespoke selection system
(`harness-map.json`, `select_harnesses.py`, the `behavior-gate` CI job).
Target: harnesses become ordinary JUnit test tasks with honest inputs and
caching enabled. Then `./gradlew check` IS the selective run — logically
full, physically incremental — and the entire bespoke selection layer is
deleted. CI's own execution is the authoritative record; local runs are
fast feedback via cache hits.

Net effect: exact selection without a maintained mapping, per-scenario
results (real JUnit XML), a trivially statable commit gate, and a smaller
system — mechanical enforcement replaces maintained claims.

## Milestones

**T0 — Pilot conversion and pattern.**
Write the decision record (ADR under `docs/project/decisions/`, supersedes
the harness-traceability plan's H1–H3/H7 selection design; H4/H6 concepts
survive in T4/T5). Convert ONE representative JavaFX harness
(hexMapEditorBehaviorHarness) to a JUnit class: one `@Test` per scenario,
shared JavaFX bootstrap in `@BeforeAll`, one Gradle `Test` task, registered
under `check`, `upToDateWhen{false}` removed, all non-classpath inputs
(verification catalogs, resources, data-dir template) declared. Build-logic
gains the reusable registration template.
*Done when:* pilot runs green as a Test task; JUnit XML lists every former
proof item as a named test; a scenario-level failure does not hide later
scenarios; an unrelated-file change leaves the task UP-TO-DATE; a change
inside its classpath re-runs it.

**T1 — Fleet conversion.**
Convert all remaining harness registrations area by area using the T0
pattern; delete each JavaExec registration in the same pass. Mechanical
parity rule: the set of proven scenario claims per harness is identical
before and after (old proof-item IDs map 1:1 to test method names).
*Done when:* zero JavaExec behavior harnesses remain; `./gradlew check`
executes every scenario; a scripted comparison shows 1:1 scenario parity
per harness; full `check` completes locally.

**T2 — Cache correctness and hermeticity.**
Enable the local build cache for harness tasks. Fix nondeterminism: per-run
temp dirs stay out of declared outputs, outputs are relocatable, no
wall-clock or PID leaks into results. Add the honesty check: a scheduled
`--rerun-tasks` full run must reproduce all cached verdicts; any divergence
is filed as an R2 issue (undeclared input or flaky scenario), never
silently re-cached.
*Done when:* rehearsed unrelated change → cache hit; rehearsed in-classpath
change → re-run; rehearsed resource change → re-run; two consecutive
`--rerun-tasks` full runs agree with the cache.

**T3 — Commit gate via versioned hooks.**
`tools/hooks/pre-commit`: run `./gradlew check` on the exact commit tree in
a clean `git worktree`; red or non-executed ⇒ commit rejected with the
failing tasks named. `core.hooksPath` wired through the repo bootstrap so a
fresh clone has the gate without manual setup. Cheap by construction:
cache hits make an untouched-area commit near-instant.
*Done when:* a deliberately untested change is rejected naming the stale
tasks; a tested one passes; the gate works on a fresh clone; a dirty
worktree cannot leak untested edits into the gate.

**T4 — CI as authority; delete the bespoke layer.**
CI runs `check` with a CI-owned Gradle cache (GitHub-Actions-backed;
local machines never write to it — CI trusts only its own executions).
Nightly `--rerun-tasks` job implements the T2 honesty check. Then DELETE:
`harness-map.json`, `select_harnesses.py`, the `behavior-gate` job;
update required checks (ADR 0002), frozen-surfaces list, and
BehaviorHarnessRegistration's map validation. Branch protection reflects
the new required contexts.
*Done when:* a PR touching one area re-runs only that area's tasks in CI
(rest are cache hits); a PR touching build wiring re-runs everything; the
deleted files are gone from main; required checks are green and enforced;
nightly job exists and has one green run.

**T5 — Resolution report and honesty reviewer.**
Per-commit dossier derived from JUnit XML history in the gate worktree
runs: which scenarios went red, and the tree-to-tree diff that turned each
green; flaky results (same tree, differing verdicts) flagged, filed as R2,
never counted as fixed. At each commit with resolution cycles, the gate
invokes a cross-model reviewer (repo content strictly untrusted data;
verdicts must cite diff evidence): all "ok" ⇒ admit; any "gaming" ⇒ reject;
"unclear" ⇒ escalate to the CI judge via PR, never to the owner. CI re-runs
the reviewer on push over the pushed dossier (dossier travels in the PR
branch, e.g. under `docs/project/verification/dossiers/`). Amend the
resource policy FIRST (own R3c-style PR) to cover local Anthropic API calls
for this reviewer.
*Done when:* rehearsed honest fix ⇒ "ok" with cited evidence; rehearsed
special-cased fix ⇒ "gaming" blocks; commit without resolutions ⇒ no call;
injection via code comment ignored and noted; CI reviewer verdict is the
one that gates merge.

**T6 — Governance consolidation.**
Update AGENTS.md (verify entrypoint becomes `check` + gate; remove
selection instructions), one page of documentation under
`docs/project/verification/` (task model, cache trust rules, gate, dossier,
reviewer), prune superseded verification docs, refresh frozen-surfaces to
the new gate files, German status note to the owner.
*Done when:* no doc references the deleted machinery; AGENTS.md verify
section fits the new model; frozen list matches reality; status note
delivered.

## Hard Rules

1. Scenario semantics frozen: conversion may change the frame (main → test
   methods), never an assertion, an input, or a proven claim. Any semantic
   drift found during conversion is preserved as-is and filed as an issue.
2. Conservative by construction: anything not provably input-tracked
   (build wiring, build-logic, hook code, keep-rules) invalidates
   everything — never special-case it.
3. Cache trust is one-directional: CI writes, everyone else reads. A local
   cache entry is convenience, never proof.
4. The nightly `--rerun-tasks` run is the permanent safety net; it may be
   made cheaper, never removed.
5. Deletion is part of done: a milestone that adds without removing its
   superseded counterpart is not complete.

## Risks

- **Undeclared inputs** (the new mapping-drift): countered by T2 rehearsals
  and the permanent nightly rerun; divergences are R2 issues.
- **JavaFX test hermeticity** (shared toolkit state across methods):
  pilot in T0 exists to burn this down first; fallback is one JVM fork per
  test class, accepted cost.
- **Conversion volume** (~111 registrations): schematic, one pattern,
  agent-parallelizable per area; parity is scripted, not judged by eye.
- **CI cache poisoning:** cache key scope per protected ref, CI-only write
  credentials; worst case equals today (full re-run).
- **Reviewer false positives:** "unclear" escalates to the CI judge, never
  blocks permanently, never reaches the owner.
