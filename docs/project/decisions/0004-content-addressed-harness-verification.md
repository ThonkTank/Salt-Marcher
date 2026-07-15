Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-12
Source of Truth: Decision record for replacing bespoke behavior-harness
selection with content-addressed JUnit harness verification.

# 0004 Content-Addressed Harness Verification

## Problem

Behavior harnesses are currently JavaExec tasks that intentionally disable
up-to-date checks. Because they are fail-fast monoliths, the repository also
maintains `tools/quality/config/harness-map.json`,
`tools/quality/scripts/select_harnesses.py`, and the `behavior-gate` CI job to
select enough harnesses for each change. That mapping duplicates information
Gradle can already derive from task inputs once harnesses are normal `Test`
tasks with honest classpaths and declared non-classpath inputs.

## Alternatives

- Keep JavaExec harnesses and improve the selector. Rejected because it keeps
  mapping drift as a permanent system property.
- Convert harnesses to JUnit but keep `behavior-gate` indefinitely. Rejected
  because it leaves both old and new mechanisms alive.
- Convert harnesses to content-addressed JUnit tasks and delete the bespoke
  selection layer once CI owns authoritative cache writes. Chosen.

## Decision

SaltMarcher will convert behavior harnesses to JUnit `Test` tasks in the
milestone order defined by the
[Harness Modernization Roadmap](../architecture/harness-modernization-roadmap.md) (line 1).
Each former proof item ID maps 1:1 to a JUnit test method name. Scenario
semantics are frozen: assertions, inputs, fixtures, visible facts, and
published behavior claims survive conversion unchanged.

T0 introduces the reusable Gradle registration template and converts only
`hexMapEditorBehaviorHarness`. T1 converts the fleet area by area. T4 deletes
the bespoke selector only after CI cache authority and nightly honesty checks
exist.

## Rationale

Gradle task inputs and test result XML are the right durable machinery for
selective behavior proof. JUnit gives per-scenario verdicts without bespoke
report parsing, and Gradle can skip unchanged harnesses without a maintained
source-to-task map once the harness tasks are honestly declared.

## Risks

- A converted harness can omit an input. T2 rehearsals and permanent nightly
  `--rerun-tasks` are the safety net.
- JavaFX state can leak between test methods. T0 must prove the pilot's
  bootstrap and data-directory reset before any fleet conversion starts.
- A local cache hit can be mistaken for proof. The roadmap makes cache trust
  one-directional: CI writes; local reads are feedback only.

## Validation

For T0, validation is literal:

- `hexMapEditorBehaviorHarness` runs green as a `Test` task.
- JUnit XML lists every former proof item as a named test.
- A scenario-level failure does not hide later scenario methods.
- An unrelated-file change leaves the pilot task `UP-TO-DATE`.
- A classpath change re-runs the pilot task.

Later milestone validation follows the roadmap done-when criteria.

## Rollback

Revert the conversion batch or milestone branch. The old JavaExec registration
and bespoke selector remain available until their explicitly named deletion
milestone.

## Supersedes

The H1-H3/H7 selector portions of the harness-traceability plan. H4/H6
concepts survive through the T4/T5 cache-honesty and dossier milestones.
