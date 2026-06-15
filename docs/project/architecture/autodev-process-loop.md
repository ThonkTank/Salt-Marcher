Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-14
Source of Truth: Architecture for the SaltMarcher process-autoresearch loop,
including fixed harness boundaries, mutable process-program boundaries, and
promotion rules for developer-process variants.

# Autodev Process Loop

## Purpose

SaltMarcher uses the Autodev Process Loop to improve the developer process
that drives implementation work. The loop experiments on how implementers are
briefed, scoped, model-routed, reviewed, and given feedback. It does not
experiment directly on product code as its primary object.

The loop adapts the Karpathy autoresearch pattern into SaltMarcher governance
and borrows the Darwin Godel Machine archive pattern only for private process
variants: the fixed evaluation harness remains stable, the mutable process
program is small, each experiment records comparable feedback, promising
variants can branch from earlier variants, and successful process variants can
be promoted only after evidence shows they improve verified progress per
process cost.

## Stakeholders And Concerns

Primary consumers:

- the user, who supplies protected feature and bug intake
- the process optimizer, which evaluates developer-process variants
- implementation agents, which receive reduced slice briefs
- review coordinators, which inspect implementation results and process
  feedback

The architecture answers these concerns:

- what the process optimizer may change freely
- what must remain fixed as SaltMarcher's evaluation harness
- how private intake is separated from implementer context
- when process variants can be kept, discarded, or promoted
- how the loop minimizes tokens without weakening proof or review

## Architecture Mapping

SaltMarcher maps the autoresearch roles as follows:

| Autoresearch role | SaltMarcher role |
| --- | --- |
| fixed preparation and evaluation files | `AGENTS.md`, mandatory skills, verification routes, review protocol, publication rules |
| mutable training file | private developer process program and process variants |
| scalar validation metric | normalized process score from structured feedback |
| experiment ledger | private `.codex/autodev/experiments.tsv` |
| keep or reset branch | keep, discard, or quarantine a process variant |
| open-ended agent archive | private process variant archive with parent and child lineage |

The autoresearch mapping is source-backed by the preserved Karpathy
autoresearch extract in the global reference mirror. The archive and parent
selection model is source-backed by the preserved Darwin Godel Machine extract
in the same mirror.

## Fixed Harness Boundary

The process optimizer MUST treat the following SaltMarcher surfaces as fixed
evaluation harness for an ordinary process experiment:

- workspace and SaltMarcher `AGENTS.md` rules
- mandatory skill routing
- context hygiene, repo-tool, code-exploration, and layer-skill obligations
- the required qualitative `code-simplifier` pass for covered implementation
  work
- planner escalation before repairs for systemic review, architecture-check,
  behavior-harness, or proof feedback
- implementation and review pass-log obligations
- required proof routes such as documentation enforcement, focused handoff,
  production handoff, and desktop install when applicable
- Overview-coordinated review and publication rules
- branch-protection readback when stable publication is claimed

A process experiment MUST NOT weaken, bypass, or reinterpret these surfaces to
improve its score. Changes to these surfaces are not normal experiments; they
are tracked instruction or governance changes and follow the standard
SaltMarcher review path.

## Mutable Process Program

The mutable experiment object is the developer process variant. A variant MAY
change:

- implementer prompt shape
- reduced slice-brief structure
- allowed read-set size and context budget
- model and reasoning-effort routing
- review lens selection and review briefing shape
- feedback-question wording
- stop rules that are stricter than the fixed harness

Variants live privately under `.codex/autodev/variants/` until promoted.
Implementation agents receive only a reduced slice brief derived from the
active variant. They MUST NOT receive the full protected intake, the private
experiment ledger, the variant archive, or unrelated feedback history.

## Task Selection

The optimizer selects the evaluation task in this order:

1. Use an actionable protected intake item with status `open` or `selected`
   when its allowed and forbidden surfaces are specific enough for a safe
   reduced slice.
2. If no actionable protected item exists, choose one bounded maintenance
   fallback candidate from repo evidence.
3. If neither source yields a safe slice with objective Done-When and a proof
   route, record the run as `blocked`.

Maintenance fallback candidates are existing-code improvements only:
architecture cleanup, consolidation, simplification, performance improvement,
verification or tooling quality, and documentation-governance cleanup. They are
evaluation tasks for process variants; they do not become protected intake
unless the user explicitly records them there.

## Variant Archive

The private variant archive records process variant genealogy. It lets the
optimizer branch from useful prior variants instead of only hill-climbing from
the latest active process program.

Archive entries live in `.codex/autodev/variant-archive.jsonl`. Each line is a
JSON object with at least:

- `schema_version`
- `variant_id`
- `parent_id`
- `generation`
- `task_classes`
- `hypothesis`
- `mutation_summary`
- `scores`
- `status`

`variant_id` identifies one private process variant. `parent_id` points at the
baseline or earlier variant used as the mutation source. `generation` is zero
for the baseline and increments by one from parent to child. `hypothesis` is
the expected process improvement. `mutation_summary` names the single primary
process change.

Archive entry `status` is separate from experiment-run result. Archive entry
status is one of `baseline`, `candidate`, `active`, `kept`, `discarded`,
`quarantined`, or `promoted`. Experiment-run results are `keep`, `discard`,
`crash`, `quarantine`, or `blocked`. A `keep` result updates the archive entry
to `kept` or `active`; `discard` updates it to `discarded`; `quarantine`
updates it to `quarantined`; promotion updates it to `promoted`. `crash` and
`blocked` do not promote an archive entry and MUST record the failed attempt in
feedback or the experiment ledger without treating the child as a kept variant.

Before a `variant` run, the optimizer MUST select one parent from the archive
or record why it is falling back to the baseline. Parent selection SHOULD
prefer variants with better comparable score history, low proof-failure and
blocker rates, low user-correction and delayed-regression rates, enough novelty
to avoid repeating the same mutation, and matured delayed signals. The feedback
standard owns the fixed `parent_weight` formula used to combine these factors.
Greedy selection of only the best current score is allowed only when the
hypothesis is explicitly a greedy-selection experiment.

Child variants MUST change exactly one primary process mutation from their
selected parent. Archive branching MAY explore variants whose immediate score
is not best when they provide useful novelty and do not worsen fixed-harness
failure rates. Stable `AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or
documentation rules are never mutated through this private archive; they change
only through the promotion model below.

## Private Lab Boundary

The private process lab lives under the ignored `.codex/autodev/` directory:

- `intake.md` holds protected user-provided features and bugs
- `process-program.md` holds the active private process program
- `experiments.tsv` records comparable process experiments with fixed metric
  index columns
- `variant-archive.jsonl` records process variant parent and child lineage
- `feedback/*.jsonl` holds raw feedback packets from inner runs
- `evaluation-sets/` holds private held-out process evaluation slice sets
- `variants/active/`, `variants/children/`, `variants/discarded/`, and
  `variants/promoted/` hold process variant drafts

This private lab is operational state, not canonical project documentation.
Tracked files may describe the schema and rules, but they MUST NOT copy
protected intake items or raw private feedback.

## Bootstrap Layout

A fresh private lab is valid when these ignored paths exist:

```text
.codex/autodev/intake.md
.codex/autodev/process-program.md
.codex/autodev/experiments.tsv
.codex/autodev/variant-archive.jsonl
.codex/autodev/evaluation-sets/
.codex/autodev/feedback/
.codex/autodev/variants/active/
.codex/autodev/variants/children/
.codex/autodev/variants/discarded/
.codex/autodev/variants/promoted/
```

`experiments.tsv` MUST start with this header:

```text
timestamp	variant_id	parent_id	task_class	run_status	process_score	harness_pass	held_out_pass_rate	cost_units	safe_summary
```

The `safe_summary` field is an operator summary, not a copy of protected
intake. Any text field written to the TSV MUST replace tabs and newlines with
spaces, then inspect the first non-whitespace character. If that character is
`=`, `+`, `-`, or `@`, prefix the field with a single quote before writing.
Feedback packets use JSON Lines under `feedback/`; the TSV only indexes scored
experiments. It MUST NOT store raw packet details, protected intake, held-out
slice contents, prompt text, review transcripts, or archive notes. `run_status`
is one of `keep`, `discard`, `crash`, `blocked`, `quarantine`, or `promote`.
`process_score`, `harness_pass`, `held_out_pass_rate`, and `cost_units` are
copied from the fixed metrics defined by the feedback standard.

`variant-archive.jsonl` MAY start empty during bootstrap. Once the baseline is
known, the first archive entry SHOULD record the active baseline variant with
`generation` set to `0`, `parent_id` set to `null`, and `status` set to
`baseline`.

`intake.md` MUST be created with this minimal private template:

```text
# SaltMarcher Autodev Private Intake

## Record Template

id:
type: feature|bug
priority: P0|P1|P2|P3
title:
evidence:
acceptance:
allowed_surfaces:
forbidden_surfaces:
status: open|selected|done|blocked|deferred
notes:

## Items

The item list may be empty. When no actionable `open` or `selected` item exists,
the optimizer may use a bounded maintenance fallback without writing it here.
```

`process-program.md` MUST be created with this minimal private template:

```text
# SaltMarcher Autodev Process Program

id: baseline-YYYY-MM-DD
status: active

## Fixed Harness

- Do not weaken SaltMarcher AGENTS rules, mandatory skills, proof routes,
  code-simplifier, planner escalation, Overview review, pass logs, or
  publication policy.
- Treat the private intake as optimizer-only context.
- Give implementers reduced slice briefs only.

## Baseline Loop

1. Read the private intake and prior feedback.
2. Select one task candidate from actionable intake, or from a bounded
   maintenance fallback only when no actionable intake item exists.
3. Select a parent variant from the private archive or record baseline
   fallback.
4. Produce a reduced implementation brief.
5. Run the normal SaltMarcher implementation workflow unchanged, including the
   required code-simplifier pass and planner escalation for covered work.
6. Capture a feedback packet.
7. Score the run with the fixed process metrics and primary score formula.
8. Keep, discard, crash, blocked, or quarantine the process variant.
```

## Promotion Model

The process optimizer MAY keep or discard private variants based on feedback.
A private variant becomes project governance only after all conditions below
are true:

- repeated runs show better verified progress per process cost
- at least one held-out evaluation slice supports the improvement
- blocker, proof-failure, review-churn, and user-correction rates do not worsen
- the promoted wording is reduced to stable instruction or documentation text
- the change runs through the standard instruction-change workflow, including
  `agent-instruction-engineering`, documentation enforcement, pass logs, and
  Overview review

Promotion updates the relevant tracked instruction or documentation surface.
Private experiment files remain untracked.

## References

- [Autodev Process Feedback](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/autodev-process-feedback.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
- [Karpathy Autoresearch Extract](/home/aaron/Schreibtisch/projects/references/autodev/karpathy-autoresearch.md:1)
- [Darwin Godel Machine Extract](/home/aaron/Schreibtisch/projects/references/autodev/darwin-godel-machine-2505.22954.md:1)
