Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Archive evaluation, pass/fail, delayed-feedback, and evidence
ownership details for Autodev Process Feedback.

# Autodev Process Feedback Archive Rules

## Archive Evaluation

When a feedback packet references an archive variant, the optimizer evaluates
the variant by combining:

- direct `process_score` on comparable task classes
- `harness_pass`, `proof_success_rate`, and review-blocker rate
- user-correction rate, delayed-regression rate, and `delayed_stability`
- `context_cost`, `elapsed_cost`, and total `cost_units` trend
- descendant value from later child variants that reuse this variant as a
  useful stepping stone
- `held_out_pass_rate` when a private evaluation set is available

Archive comparisons MUST group `protected_intake` and `maintenance_fallback`
runs separately unless the promotion evidence explicitly covers both sources.

Parent selection uses this DGM-like archive weight:

```text
parent_weight =
  sigmoid(process_score, midpoint=baseline_score)
  * (1 / (1 + functioning_child_count))
  * maturity_factor
  * novelty_factor
```

`functioning_child_count` counts child variants that produced a valid feedback
packet and did not crash the fixed harness. `maturity_factor` is `1` for mature
delayed signals, `0.5` for immature delayed signals, and `0` for known unresolved
regression. `novelty_factor` is review-owned in the range `0` to `1` and
penalizes repeated mutations that do not explore a meaningfully different
process line.

Archive scoring is still derived from documented `score_inputs`; descendant
value is a private aggregate used for parent selection and MUST NOT override a
failed fixed harness. A variant MUST NOT be promoted from archive status on
immediate score alone.

## Pass Or Fail Criteria

A process experiment is `keep` when:

- its `process_score` is better than the baseline or current active variant for
  comparable task classes and task source
- `harness_pass = 1`
- blocker and user-correction rates do not increase
- required proof and review remained intact
- the variant did not expose protected intake to implementers

A process experiment is `discard` when:

- `process_score` is equal or worse after accounting for penalties
- `harness_pass` is lower than the comparable baseline
- token reduction is achieved by weakening proof, review, or context evidence
- the variant causes more rework, review churn, cost without useful progress, or
  user correction
- the run crosses the private-intake boundary

A process experiment is `crash` when:

- the optimizer cannot produce a valid slice, feedback packet, or score
- the fixed harness cannot run because of process-variant behavior
- dirty-tree ambiguity prevents attribution of changed paths

A process experiment is `blocked` when:

- required external state is unavailable, such as branch-protection readback,
  user input, or an allowed private lab write
- a safe parent selection cannot be made from the archive and baseline fallback
  would hide the blocker
- the run exhausts its configured token, time, or slice budget before a valid
  feedback packet can be produced

`blocked` records the stopped attempt but does not keep, promote, or score a
child variant as useful progress. `blocked` and `crash` runs are logged with
their metrics, but `harness_pass = 0` prevents them from counting as progress.

A process experiment is `quarantine` when:

- the immediate score looks positive but delayed feedback is not mature
- the variant is promising but needs more samples before promotion
- the variant lacks a held-out evaluation slice but may be useful as an archive
  stepping stone
- the variant affects tracked instruction surfaces and needs a normal
  instruction-change pass

A process variant is eligible for promotion only after repeated positive
samples against a comparable baseline and at least one held-out evaluation slice
support the improvement without increasing blocker, correction, or regression
rates.

## Delayed Feedback

SaltMarcher does not have a single immediate scalar metric like the original
autoresearch benchmark. The optimizer MUST revisit prior feedback when later
events occur:

- a commit is reverted
- CI fails after local proof passed
- the user corrects or rejects the outcome
- a review finding repeats across later runs
- the same bug resurfaces
- a process variant causes recurring context bloat or missed skill routing
- a child variant shows the parent was a useful or harmful stepping stone

Delayed signals update the private feedback ledger and may demote a previously
kept variant to quarantine or discard.

## Evidence Ownership

Private feedback packets and experiment ledgers live under `.codex/autodev/`
and are not committed. The private variant archive and held-out evaluation sets
live there as well. Tracked handoff reports may cite aggregate process status,
but they MUST NOT copy protected intake, raw private feedback, evaluation sets,
or archive contents.

Tracked instruction changes that promote a process variant must cite:

- the stable process rule being changed
- aggregate feedback evidence, without protected details
- the proof and review route used for the instruction change
- the preserved external source when the change relies on autoresearch or
  Darwin Godel Machine mapping
