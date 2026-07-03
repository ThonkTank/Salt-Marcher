---
name: autodev-process-optimizer
description: Use when running, planning, changing, or reviewing the SaltMarcher process-autoresearch loop that optimizes implementer prompts, slice briefs, context budgets, model routing, review routing, feedback capture, variant archive selection, and promotion of developer-process variants.
---

# Autodev Process Optimizer

## Purpose

Use this skill for the outer SaltMarcher process-autoresearch loop. The loop
optimizes developer process, not product code directly. It experiments on how
inner implementers are instructed, scoped, reviewed, and measured.

This skill does not replace SaltMarcher `AGENTS.md`, mandatory skills,
verification routes, review rules, pass logs, or publication policy. Those
surfaces are the fixed evaluation harness for ordinary process experiments.

## Required Workflow

Before running, planning, changing, or reviewing a process experiment:

1. Read `docs/project/architecture/autodev-process-loop.md`.
2. Read `docs/project/verification/autodev-process-feedback.md`.
3. Run the normal SaltMarcher preflight before any repo-tracked change.
4. Classify the run as `baseline`, `variant`, `promotion`, or `review`.
5. Read only the private `.codex/autodev/` files needed for the run.
6. If `.codex/autodev/` is missing, bootstrap only the required ignored layout
   and templates named in `docs/project/architecture/autodev-process-loop.md`.
7. Keep protected intake and raw feedback out of implementer prompts, pass
   logs, commits, PR text, and tracked documentation.
8. Select the evaluation task from actionable protected intake first. Use a
   maintenance fallback only when no `open` or `selected` intake item can be
   bounded safely.
9. For a `variant` run, perform an `archive-selection` phase: select one
   parent from `.codex/autodev/variant-archive.jsonl` or record why the run
   falls back to the baseline.
10. Select exactly one process hypothesis and one primary mutation for a child
   variant run.
11. Give each inner implementer a reduced slice brief with only the needed
   sanitized task, read set, write set, direct constraints, steps, and Done
   When checks.
12. Preserve all fixed SaltMarcher proof, review, and publication obligations.
13. Require one feedback packet per inner implementation attempt and compute the
    fixed metrics before scoring the process variant.
14. Record the experiment in `.codex/autodev/experiments.tsv`.
15. Update the private variant archive when the run creates, keeps, discards,
    quarantines, or promotes a variant.
16. Keep, discard, crash, blocked, or quarantine the private variant according
    to the verification standard.

## Fixed Harness Rules

The process optimizer MUST NOT treat these as normal experiment knobs:

- mandatory skill routing
- required Implementation Review Coordinator cycles, including the
  qualitative `code-simplifier` packet for covered implementation work
- required planner escalation before repair for systemic review, architecture,
  behavior-harness, or proof feedback
- implementation and review pass-log obligations
- documentation enforcement, focused handoff, production handoff, desktop
  install, CI, or branch-protection readback requirements
- Implementation Review Coordinator and specialist review routing
- stable publication policy
- protected intake boundary

If a process finding suggests one of these surfaces should change, open a
promotion candidate. Do not apply it as a private runtime variant.

## Variant Knobs

Process variants MAY change:

- implementer prompt shape
- reduced slice-brief format
- context size and read-set constraints
- model and reasoning-effort routing
- review lens selection and reviewer briefing shape
- feedback questions
- stop rules stricter than the fixed harness

Child variants MUST change one primary process mutation from their selected
parent. Do not bundle prompt wording, model routing, review routing, and
feedback-question wording into one child variant. The fixed primary metric
definitions are not variant knobs; changing them is a promotion candidate.

## Task Selection Rules

Use protected intake before maintenance fallback. An intake item is actionable
only when its status is `open` or `selected` and its allowed and forbidden
surfaces are specific enough for a safe reduced slice.

If no actionable intake item exists, the optimizer MAY select one bounded
maintenance fallback from repo evidence such as recurring review findings,
architecture friction, qualitative review opportunities, performance hot-path
evidence, verification friction, or duplicated governance text. Fallback slices
MUST have explicit Done-When bullets, narrow read and write sets, and the normal
proof and Implementation Review Coordinator gates. If no safe fallback can be
bounded, record the run as `blocked`.

Maintenance fallback candidates do not need to be written into protected intake
unless the user wants to preserve them. Do not use fallback selection to bypass
an actionable protected intake item.

## Archive Selection Rules

Before launching a child variant, choose a parent by inspecting only the private
archive and aggregate feedback needed for the decision. Prefer parents with:

- better comparable score history
- low proof-failure, review-blocker, user-correction, and delayed-regression
  rates
- matured delayed signals
- useful novelty or descendant value
- task-class relevance for the selected slice

Use the fixed `parent_weight` formula from
`docs/project/verification/autodev-process-feedback.md` when comparable metrics
are available. If the formula cannot be applied, record the missing metric and
fall back to baseline only when the fixed harness remains intact.

Do not expose the archive, protected intake, raw feedback packets, or held-out
evaluation sets to inner implementers. If no archive entry is safe to use,
record a baseline fallback and continue only when the fixed harness remains
intact.

## Feedback Rules

Each inner attempt must produce a feedback packet with the schema required by
`docs/project/verification/autodev-process-feedback.md`. The packet must include
`task_source` plus the raw counters needed to compute `harness_pass`,
`done_when_pass_rate`, `diagnostic_value_rate`, `proof_success_rate`,
`review_blocker_rate`, `rework_rate`, `context_cost`, `elapsed_cost`,
`dirty_attribution`, `delayed_stability`, `held_out_pass_rate`, `cost_units`,
and `process_score`.

The optimizer scores verified useful progress over process cost using the fixed
primary formula from the verification standard. It must penalize proof failure,
stale proof, missed mandatory skills, missed required Implementation Review
Coordinator cycle or qualitative packet, missed required planner escalation,
review blockers,
dirty-tree ambiguity, user correction, delayed regressions, and context bloat.
Until the verification standard changes, score computation may use only the
documented `score_inputs` keys.

Archive runs may attach `archive_variant_id`, `parent_variant_id`,
`evaluation_set_id`, and `novelty_notes` to feedback packets. These fields are
private operational evidence and must stay out of tracked handoff text except
as aggregate status.

The experiment TSV is only an index and must use this column order:
`timestamp`, `variant_id`, `parent_id`, `task_class`, `run_status`,
`process_score`, `harness_pass`, `held_out_pass_rate`, `cost_units`,
`safe_summary`. Before writing `safe_summary`, replace tabs and newlines with
spaces, inspect the first non-whitespace character, and prefix the field with a
single quote when that character is `=`, `+`, `-`, or `@`. Do not copy protected
intake, held-out slices, raw packet details, prompt text, or archive notes into
the TSV.

Do not score unverified product changes as verified progress. `harness_pass = 0`
blocks progress credit for any run that weakens the fixed SaltMarcher harness.
Do not hide failed proof or review findings to make a process variant look
better.

## Promotion Rules

Private variants stay under `.codex/autodev/variants/` until promotion.

Promote a process variant into tracked instructions only when:

- repeated feedback shows better `process_score` for comparable task classes
- each promotion sample has `harness_pass = 1`
- at least one held-out evaluation slice supports the improvement
- blocker, review-churn, and user-correction rates do not worsen
- the promoted rule can be expressed narrowly in the owning instruction or
  documentation surface
- the promotion pass uses `agent-instruction-engineering` and any relevant
  architecture or verification skills
- the promotion pass runs the required documentation proof and Implementation
  Review Coordinator review

Promotion is a repo-tracked instruction change, not a private experiment.

## Stop Rules

Stop the current optimizer run and record `crash` or `blocked` when:

- the worktree has dirty paths that cannot be attributed safely
- the fixed proof or review harness cannot run
- branch-protection readback is required but unavailable
- a process variant exposes protected intake outside the optimizer
- no valid feedback packet can be produced
- the run exhausts its configured token, time, or slice budget

## Handoff

For covered work, report:

- process run type and variant id
- parent variant id or baseline fallback status for archive runs
- private intake handling status without exposing protected content
- feedback packet and experiment ledger paths
- variant archive status without exposing protected archive contents
- keep, discard, crash, blocked, quarantine, or promotion result
- fixed proof and review status for any repo-tracked changes
- whether delayed feedback remains pending

For governance-only, planning-only, or review-only work with no private variant
run, report private-run fields as `not_applicable`.

## References

- [Autodev Process Loop](../../../../docs/project/architecture/autodev-process-loop.md)
- [Autodev Process Feedback](../../../../docs/project/verification/autodev-process-feedback.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Karpathy Autoresearch Extract](/home/aaron/Schreibtisch/projects/references/autodev/karpathy-autoresearch.md)
- [Darwin Godel Machine Extract](/home/aaron/Schreibtisch/projects/references/autodev/darwin-godel-machine-2505.22954.md)
