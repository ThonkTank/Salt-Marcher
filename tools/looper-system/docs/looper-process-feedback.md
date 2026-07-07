Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-14
Source of Truth: Verification and feedback strategy for SaltMarcher
process-autoresearch experiments, including feedback packet schema, scoring,
pass/fail criteria, and known limits of process feedback.

# Looper Process Feedback

## Purpose

The Looper Process Loop can improve SaltMarcher implementers only when it gets
comparable feedback. This document defines the feedback harness for process
experiments. It verifies process variants, not product behavior.

Product changes produced by inner implementation runs still use the normal
SaltMarcher verification and review routes. This document defines the extra
process-feedback evidence that lets the outer optimizer decide whether a
developer-process variant should be kept, discarded, quarantined, or promoted.

## Verified Sources

This feedback strategy verifies:

- the current private process variant used for an inner implementation run
- the inner run's process cost and context footprint
- mandatory skill and proof-route adherence
- required qualitative implementation-review coverage for covered
  implementation work
- required planner escalation adherence when systemic review, architecture,
  behavior-harness, or proof feedback shaped a repair
- implementation, proof, review, publication, and delayed regression outcomes
- user correction and acceptance signals
- process-score comparison against baseline or prior variants
- parent, child, and held-out evaluation evidence for private variant archives

It does not verify feature correctness directly and does not replace
documentation enforcement, focused handoff, production handoff, desktop
install, CI, or Overview review.

## Feedback Packet

Each inner implementation attempt MUST emit one JSON Lines packet under
`tools/looper-system/state/process-lab/feedback/` before the process optimizer
scores the variant.
The packet MUST include these fields:

| Field | Required meaning |
| --- | --- |
| `schema_version` | Feedback schema version, starting at `1`. |
| `timestamp` | Local timestamp for the feedback packet. |
| `process_variant_id` | Exact private process variant or baseline id used. |
| `task_class` | One of `feature`, `bug`, `architecture`, `quality`, `performance`, `consolidation`, `docs`, `verification`, or `governance`. |
| `task_source` | One of `protected_intake` or `maintenance_fallback`, so fallback work is scored separately from user-requested work. |
| `estimated_complexity` | Optimizer estimate before implementation. |
| `context_budget` | Files read, approximate prompt/tool tokens, and withheld context. |
| `slice_quality` | Ambiguity count, read/write-set precision, and Done-When clarity. |
| `skill_routing` | Mandatory skills expected, used, missed, or corrected, including qualitative implementation-review coverage and planner escalation when covered work requires them. |
| `implementation_result` | Changed paths, completion status, elapsed time, and rework count. |
| `proof_result` | Commands, literal result, log paths, stale-proof findings, and blocker type. |
| `review_result` | Review panel, findings by severity, fix cycles, and final review state. |
| `publication_result` | WIP, stable, blocked, skipped, or not applicable, with reason. |
| `user_feedback` | Accepted, rejected, edited, priority changed, correction, or not yet seen. |
| `delayed_signal` | Later revert, CI failure, repeated bug, repeated review finding, or none known. |
| `delayed_benefit` | Optional delayed benefit verdict: `realized`, `not_realized`, `unverifiable`, or `not_applicable`. |
| `score_inputs` | Numeric inputs used for scoring and penalties. |

Packets may include additional fields, but score computation MUST use only
documented `score_inputs` keys until this document is updated.

Packets MAY include these archive fields when the run belongs to a private
variant archive:

| Field | Optional meaning |
| --- | --- |
| `archive_variant_id` | Variant archive id when different from `process_variant_id`. |
| `parent_variant_id` | Parent variant selected before this attempt. |
| `evaluation_set_id` | Private held-out evaluation slice set used for the attempt. |
| `novelty_notes` | Private optimizer notes about what makes the mutation different. |

These fields are private operational evidence. They MUST NOT expose protected
intake, raw feedback history, or the full variant archive to implementers,
tracked docs, commits, pass logs, or PR text.

### Minimal Packet

A minimal valid feedback packet is one JSON object on one line:

```json
{"schema_version":1,"timestamp":"2026-06-14 00:00:00 CEST +0200","process_variant_id":"baseline-2026-06-14","task_class":"performance","task_source":"maintenance_fallback","estimated_complexity":"small","context_budget":{"files_read":0,"prompt_tokens_estimate":0,"tool_tokens_estimate":0,"withheld_context":"none"},"slice_quality":{"ambiguity_count":0,"read_set_precision":"exact","write_set_precision":"exact","done_when_clarity":"explicit"},"skill_routing":{"expected":[],"used":[],"missed":[]},"implementation_result":{"status":"not_started","changed_paths":[],"elapsed_minutes":0,"rework_count":0},"proof_result":{"commands":[],"literal_result":"not_run","log_paths":[],"blocker_type":"none"},"review_result":{"panel":[],"findings_by_severity":{},"fix_cycles":0,"final_state":"not_reviewed"},"publication_result":{"status":"not_applicable","reason":"baseline"},"user_feedback":{"status":"not_seen"},"delayed_signal":{"status":"none_known"},"score_inputs":{"verified_progress_points":0,"diagnostic_value_points":0,"prompt_tokens_estimate":0,"tool_tokens_estimate":0,"files_read_count":0,"implementation_minutes":0,"proof_minutes":0,"review_minutes":0,"fix_cycles":0,"rework_count":0,"repeated_edit_count":0,"ambiguity_count":0,"missed_skill_count":0,"proof_failure_count":0,"stale_proof_count":0,"review_blocker_count":0,"user_correction_count":0,"delayed_regression_count":0,"dirty_tree_ambiguity_count":0,"private_boundary_violation_count":0,"planned_done_when_count":0,"completed_done_when_count":0,"required_proof_count":0,"successful_proof_count":0,"complexity_points":1,"held_out_attempt_count":0,"held_out_pass_count":0,"harness_pass":0,"done_when_pass_rate":0,"diagnostic_value_rate":0,"proof_success_rate":"not_applicable","review_blocker_rate":0,"rework_rate":0,"context_cost":0,"elapsed_cost":0,"dirty_attribution":1,"delayed_stability":0.5,"held_out_pass_rate":"not_applicable","cost_units":0,"process_score":0}}
```

The example contains no protected intake. Real packets may add private
operator notes, but tracked docs, commits, pass logs, and PR text must cite
only aggregate status.

## Score

The primary score is:

```text
verified_useful_progress / total_process_cost
```

`verified_useful_progress` is earned only for work that reaches the intended
fixed harness state for its scope. Documentation-only work must pass
documentation enforcement. Production-code work must satisfy the applicable
handoff, review, install, and publication rules. Blocked work may receive
partial diagnostic value, but it MUST NOT be scored as verified progress.

`total_process_cost` includes:

- approximate prompt and tool tokens
- files read and context retained
- implementation elapsed time
- proof elapsed time
- review elapsed time
- fix cycles and repeated edits

`score_inputs` MUST contain the raw counters needed to recompute the normalized
metrics below. Existing raw counters remain valid for backward compatibility,
but promotion decisions use the fixed normalized metrics.

### Fixed Metrics

The process score is computed from these fixed, reviewable factors:

| Metric | Required computation |
| --- | --- |
| `harness_pass` | `1` only when every scope-required gate, mandatory skill, implementation pass log, Overview review, review pass log, and publication rule is satisfied; otherwise `0`. Dirty-attribution failure, missed mandatory proof, missed required review, missed required qualitative implementation-review coverage, missed required planner escalation, or private-boundary violation forces `0`. |
| `done_when_pass_rate` | Completed Done-When bullets divided by planned Done-When bullets. Empty or missing Done-When sets score `0`. |
| `diagnostic_value_rate` | Bounded value from useful blocked-run diagnosis, normalized from `0` to `1`; it never counts as verified progress and is multiplied by `0.25` in the primary score. |
| `proof_success_rate` | Successful required proof commands divided by required proof commands. No required proof on a planning-only private run is `not_applicable`; repo-tracked work without required proof scores `0`. |
| `review_blocker_rate` | Must-fix review findings divided by `max(1, complexity_points)`, or by one run when no numeric complexity exists. |
| `rework_rate` | `(fix_cycles + rework_count + repeated_edit_count) / max(1, complexity_points)`. |
| `context_cost` | `files_read_count + ((prompt_tokens_estimate + tool_tokens_estimate) / 1000)`. Token counts are estimates until API or tool usage accounting is available. |
| `elapsed_cost` | `(implementation_minutes + proof_minutes + review_minutes) / 10`, measured in ten-minute process-cost units. |
| `dirty_attribution` | `1` when changed paths and proof evidence are separable from the dirty baseline; `0` when attribution is ambiguous. `0` forces `harness_pass = 0`. |
| `delayed_stability` | `1` only after the configured maturity window has no known revert, CI failure, repeated bug, or repeated review finding; `0` while a known delayed regression is unresolved. Immature signals use `0.5` and keep the variant quarantined. |
| `held_out_pass_rate` | Passed private held-out evaluation slices divided by attempted held-out slices. It may be `not_applicable` before promotion eligibility, but promotion requires at least one attempted held-out slice. |

The raw `score_inputs` keys that feed those metrics are:

| Key | Meaning |
| --- | --- |
| `verified_progress_points` | Useful completed work that passed the required fixed harness. |
| `diagnostic_value_points` | Useful learning from blocked work, capped below verified progress. |
| `prompt_tokens_estimate` | Estimated prompt/context tokens. |
| `tool_tokens_estimate` | Estimated tool-output tokens consumed. |
| `files_read_count` | Number of files read by the inner implementation path. |
| `implementation_minutes` | Inner implementation elapsed minutes. |
| `proof_minutes` | Required proof elapsed minutes. |
| `review_minutes` | Required review elapsed minutes. |
| `fix_cycles` | Review or proof fix cycles. |
| `rework_count` | Repeated implementation edits to the same behavior or artifact. |
| `ambiguity_count` | Ambiguities or clarifications needed after slice launch. |
| `missed_skill_count` | Mandatory skills missed or corrected after launch. |
| `proof_failure_count` | Required proof failures. |
| `stale_proof_count` | Proof freshness failures. |
| `review_blocker_count` | Must-fix review findings. |
| `repeated_edit_count` | Additional repeated edits beyond ordinary fix cycles and rework count. |
| `user_correction_count` | User corrections, rejections, or direction reversals. |
| `delayed_regression_count` | Later revert, CI failure, repeated bug, or repeated review issue. |
| `unrealized_benefit_count` | Delayed Benefit readback verdicts of `not_realized`; weighted like delayed regressions. |
| `dirty_tree_ambiguity_count` | Attribution failures caused by dirty-worktree overlap. |
| `private_boundary_violation_count` | Protected intake or raw private feedback exposed outside the optimizer. |
| `planned_done_when_count` | Number of Done-When bullets assigned before implementation. |
| `completed_done_when_count` | Number of Done-When bullets verified after implementation and review. |
| `required_proof_count` | Number of required proof commands for the run scope. |
| `successful_proof_count` | Number of required proof commands with literal successful result. |
| `complexity_points` | Numeric complexity estimate used only for normalization. |
| `held_out_attempt_count` | Number of private held-out evaluation slices attempted. |
| `held_out_pass_count` | Number of private held-out evaluation slices passed. |

The fixed primary score is:

```text
process_score =
  harness_pass
  * (done_when_pass_rate + 0.25 * diagnostic_value_rate)
  * delayed_stability
  /
  (1 + context_cost + elapsed_cost + rework_rate + review_blocker_rate)
```

`harness_pass = 0` prevents a variant from winning by reducing tokens while
weakening SaltMarcher gates. `proof_success_rate`, `dirty_attribution`, private
boundary status, mandatory skill routing, required qualitative
implementation-review coverage, planner escalation, pass logs, and required review feed into
`harness_pass`; they are
also reported separately so reviewers can identify why a run failed.

`cost_units` is the denominator without the leading `1`:

```text
context_cost + elapsed_cost + rework_rate + review_blocker_rate
```

Penalties apply for:

- proof failure or stale proof
- Overview or specialist review blockers
- missed mandatory skills
- missed or unjustifiably skipped qualitative implementation-review coverage
- missed required planner project-health escalation for systemic feedback
- dirty-tree ambiguity
- oversized or unfocused context
- user correction or rejection
- delayed regression, revert, CI failure, or repeated review issue
- unrealized delayed benefits from readback

## Benefit Readback

Self-directed PRs labeled `task:quality`, `task:consolidation`,
`task:architecture`, or `task:performance` carry one Benefit line in the PR
body. Quantitative form:

```text
Benefit: metric=<name>; direction=<down|up>; scope=<path-or-glob|repo>
```

Qualitative form:

```text
Benefit: qualitative=<one sentence>
Benefit evidence: <one sentence after readback>
```

The first metric registry is: `dup_lines`, `smell_count`,
`class_loc:<file>`, `file_count:<glob>`, and `word_count:<glob>`. `wmc`,
`build_seconds`, and `startup_ms` stay out of the accepted grammar until their
own local resolvers exist; `startup_ms` is owned by the exploratory-smoke
milestone.
Readback evaluates merged PRs after the 7-14 day maturity window and emits
`delayed_benefit`. Quantitative metrics are recomputed against the merge commit
and current `HEAD` where the local toolchain can resolve them. Qualitative
benefits are `realized` only when a `Benefit evidence:` sentence is present;
otherwise they are `unverifiable`. `not_realized` increments
`unrealized_benefit_count` and uses the same penalty weight as
`delayed_regression_count`. A second consecutive `unverifiable` readback for the
same PR is converted to `not_realized`, because uncheckable self-directed
benefit claims must not improve process score indefinitely. Looper-triggered
readback stores journal lines as private pending feedback so a maintenance
session does not start with a dirty tracked checkout; publication into the
tracked monthly journal happens in the next normal PR-capable documentation
slice.

Readback packets with `source=rq4_benefit_readback` are delayed-benefit packets,
not inner implementation-attempt packets. They may omit inner-run fields such as
`process_variant_id`, `task_source`, and full fixed-metric inputs. Consumers use
only `pr_number`, `task_class`, `delayed_benefit`, and documented
`score_inputs.unrealized_benefit_count`, then join the verdict back to the
corresponding inner-run packet when updating process scores.

The process optimizer MUST NOT improve score by reducing required proof,
reducing required review, hiding blockers, or withholding evidence.

Archive evaluation, pass/fail criteria, delayed-feedback revisit rules, and
evidence-ownership details are split to
[Looper Process Feedback Archive Rules](looper-process-feedback-archive.md).

## References

- [Looper Process Loop](looper-process-loop.md)
- [Quality Platforms Standard](../../../docs/project/verification/quality-platforms.md)
- [Agent Instruction Standard](../../../docs/project/architecture/agent-instructions.md)
- [Source References Standard](../../../docs/project/verification/source-references.md)
