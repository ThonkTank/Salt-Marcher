Status: Active
Owner: Independent Aletheia Process Evaluator
Last Reviewed: 2026-07-26
Charter Version: C-0.3.0
Evaluation Version: E-0.3.1
Last Evaluated Product Process: A-0.3.2
Last Evaluated Improvement Process: B-0.3.1
Source of Truth: Independent qualification and adoption of temporary GM-Core process changes.

# GM-Core Process Evaluation

Authority comes only from the [Program Charter](program-charter.md). This file
qualifies process deltas; it does not verify product completeness or replace
[Quality Platforms](../../verification/quality-platforms.md). Aletheia B may
propose a delta but cannot evaluate or approve it, set its verdict, or alter its
success conditions during a trial.

## Proven Boundary

Local prose, schemas, role labels, hashes, and arithmetic can establish only
their own structural consistency. They cannot establish that a command ran,
that evidence proves the asserted meaning, that the named evaluator was
independent, or that two workloads were comparable. This contract therefore
requires practical replay and judgment instead of a validator that would make
those guarantees appear executable.

An evaluator is independent only when a fresh agent or human who did not author
the process proposal or implement the compared change performs the evaluation.
A recorded identity is not proof of independence. B may supply materials and
answer factual questions but must not direct the verdict.

## Independent Replay

For every proposed process change, the evaluator must:

1. Confirm one demonstrated process failure and one changed process variable.
2. Freeze the historical or current slice, baseline and candidate process
   revisions, workload, evidence route, and resource limit where applicable.
3. In an isolated candidate state, actually rerun the frozen command, probe, or
   counterexample for baseline and candidate. Inspect literal output, exit
   status, candidate commit and tree, working-tree interference, and relevant
   local or remote CI state.
4. Judge whether each route and oracle establishes the asserted outcome. Report
   uncertainty, environmental differences, missing semantics, and
   non-comparable work instead of filling gaps with inference.
5. Exercise one reversible canary and its rollback before permanent adoption.
6. Record a compact verdict with the replay commands, proof locations,
   observations, uncertainty, and rollback result in the existing slice
   delivery owner or process-change PR review.

The evaluator adopts only when the predicted improvement appears under the
frozen comparison, acceptance evidence and severe-finding detection do not
regress, no candidate-attributed proof fails, and the canary rolls back cleanly.
Reject a harmful change. Report an uncertain or non-comparable result as
inconclusive; it is never evidence of improvement. A rollback restores prior
behavior under a higher version rather than rewriting history.

## Limits

This evaluation qualifies a process change, not product completeness. Product
tests, runtime observation, measurements, owner decisions, independent product
review, and user acceptance retain their own authority. If the evaluator cannot
practically access or reproduce material evidence, the verdict remains
inconclusive.

## Adopted Compatibility-Covenant Verdict

Verdict: `ADOPTED` for Product Process `A-0.3.2`; no running slice is repinned.
In particular, the Campaign Runtime slice retains its recorded `A-0.3.0` pin.
The demonstrated failure was that `A-0.3.1` named no
boundary between disposable pre-user state and data that must survive a later
release, so the owner had to correct a legacy-compatibility obligation applied
before any user or non-disposable data existed. The one changed variable is the
monotonic trigger in [Product Process](product-process.md).

The frozen baseline query below exited `1` with empty output. The same `rg`
pattern against candidate `A-0.3.2` exited `0` at lines `72`, `75`, `76`, and
`85`. This establishes the single instruction delta, not its behavioral value;
the canary below establishes the latter.

```text
git show 9782d1d8:docs/project/delivery/aletheia/product-process.md |
  rg -n 'Compatibility Covenant|legacy-compatibility obligation|non-disposable use or distribution'
rg -n 'Compatibility Covenant|legacy-compatibility obligation|non-disposable use or distribution' \
  docs/project/delivery/aletheia/product-process.md
```

An independent evaluator ran `python3 -B evaluate.py` from disposable
`/tmp/aletheia-compat-trigger-canary` on Python `3.13.13`, Linux
`6.19.14-108.fc42.x86_64`, with the isolated process worktree frozen at commit
`9782d1d8dc8ddb859e4af6cd3f955a0f25a99086`. The evaluator source SHA-256 was
`225f88aea3c75d0c0c4f6f3c678f199eeb90108b25147cc4b8c692a6d95f656a`.
It built four executable zipapp artifacts. Their SHA-256 values were internal
`138ab6fc60b267fff521b4611e2c593da830b156b5d982ea2c5fa97ee82a5bf3`,
release-v1
`e568bd989191fadedb81e97aeb35600bc2a7da495213b28f17221d26c4dcc5a5`,
compatible-v2
`14dd5c017b50c1c5eac0097040ea3f26983a48e7ae2c378c6cd52e36928d7583`,
and incompatible-v2
`d04c4487ab9f699b9a1ba7cd39d17f649d0c15385365322307ebd0aac605e71d`.

Literal observations were:

```text
INTERNAL_CREATE_OK rows=1
INTERNAL_TRIGGER=INACTIVE reason=missing_completion_acceptance_authorization_and_release_baseline
RELEASE_V1_CREATE_OK campaigns=1 active=campaign-1 name=Synthetic_Keep
RELEASE_V1_READ_OK campaigns=1 active=campaign-1 name=Synthetic_Keep
RELEASE_TRIGGER=ACTIVE
TRIGGER_NEGATIVE_CONTROLS=PASS missing_each_condition=inactive false_artifact_hash=inactive
COMPATIBLE_V2_READ_OK campaigns=1 active=campaign-1 name=Synthetic_Keep
COMPATIBLE_SUCCESSOR=PRESERVED bytes=unchanged
INCOMPATIBLE_V2_READ_FAILED reason=no such table: campaign_records
INCOMPATIBLE_SUCCESSOR=DETECTED covenant=violated bytes=unchanged
ROLLBACK=PASS baseline_artifact_reopened_frozen_state
```

The artifact routes were `python3 artifacts/internal.pyz create
state/internal.sqlite`, `python3 artifacts/release-v1.pyz create|read
state/released.sqlite`, `python3 artifacts/compatible-v2.pyz read
state/released.sqlite`, `python3 artifacts/incompatible-v2.pyz read
state/released.sqlite`, and the release-v1 read again after restoring the frozen
copy.

The deliberately incompatible successor exited `23`; every other artifact
route exited `0`. The released-state SHA-256 before and after both successor
reads and rollback was
`9365735edf992a28a064dc0f7783132315d4c11eab19e239b19be10e00082f0c`.
Rollback restored and reopened the frozen state with the frozen artifact, then
the evaluator removed the disposable artifact, data, and evidence directory.
The canary therefore distinguished internal-only state from an authorized
synthetic release, preserved the compatible successor, detected the
incompatible successor, kept severe-finding detection live through negative
controls, and left no candidate-attributed failure or rollback residue.
This canary qualifies only the trigger and its false-positive/false-negative
controls. It does not qualify a SaltMarcher data format, a future release
artifact, genuine owner authorization, or a migration; those still require the
literal evidence named by the adopted rule.

## References

- [Product Process](product-process.md)
- [Process Improvement](process-improvement.md)
- [Documentation](../../documentation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
