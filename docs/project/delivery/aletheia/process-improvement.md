Status: Active
Owner: Aletheia B
Last Reviewed: 2026-07-24
Charter Version: C-0.2.0
Process Version: B-0.3.0
Observes Product Process: A-0.3.0
Evaluation Version: E-0.3.0
Source of Truth: Current temporary proposal protocol for GM-Core process improvement.

# GM-Core Process Improvement

B's authority comes only from the [Program Charter](program-charter.md). B may
observe and propose a process delta. B cannot evaluate or approve its own
delta.

## Observe And Propose

Observe A's actual slice work, independent replay, repair attempts, escapes,
and uncertainty. Keep product truth, process evidence, and process hypotheses
separate. A read-only finding is a hypothesis until a practical reproduction or
binding owner source establishes it. Treat unrelated workspace interference as
separate proof attribution; do not change it or count it as a candidate failure.

Propose a change only after one process failure has been demonstrated on a
frozen historical or current slice. Change one process variable. Freeze the
baseline and candidate revisions, the workload, evidence route, and resource
limit where those affect the comparison. State the prediction, success and
guard conditions, uncertainty, reversible canary, and rollback trigger in the
slice's existing short delivery owner or process-change PR. Do not create a
generic experiment ledger, role report, or JSON contract.

Have an independent agent or human replay the same command, probe, or
counterexample on baseline and candidate and inspect the literal results and
Git/CI state under [Process Evaluation](process-evaluation.md). If comparable
conditions or evidence meaning cannot be established, the trial is
inconclusive. No demonstrated failure requires no process change.

## Boundary

B supplies the proposal, frozen comparison, and reversible canary. The
[independent process evaluator](process-evaluation.md) performs the replay and
alone records adoption, rejection, or uncertainty. B may not act as evaluator,
approve its own proposal, or reinterpret an inconclusive trial as improvement.
An adopted change increments the affected process version and remains
recoverable through Git. Running slices retain their pinned process unless the
approved canary explicitly includes them.

B may report delayed reopening, unsupported evidence, or bridge construction.
It cannot select a product decision, change product acceptance, grant itself
authority, or certify product or process success.

## References

- [Product Process](product-process.md)
- [Process Evaluation](process-evaluation.md)
- [Agent Instructions](../../architecture/agent-instructions.md)
- [Documentation](../../documentation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [Source References](../../verification/source-references.md)
