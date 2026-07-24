Status: Active
Owner: Independent Aletheia Process Evaluator
Last Reviewed: 2026-07-24
Charter Version: C-0.2.0
Evaluation Version: E-0.3.0
Product Process Version: A-0.3.0
Improvement Process Version: B-0.3.0
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

## References

- [Product Process](product-process.md)
- [Process Improvement](process-improvement.md)
- [Documentation](../../documentation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
