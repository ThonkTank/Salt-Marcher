Status: Active
Owner: Independent Aletheia Evaluation
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
Evaluation Version: E-0.6.0
Source of Truth: Independent qualification of A, B1, B2, B3, and C candidates.

# Shared Aletheia Evaluation

Every role coordinator delegates evaluation to a fresh phase subagent who did
not author the concept, candidate, test, metrics, or success conditions. This
contract evaluates B1 behavior tests and findings, B2 UX tests and findings, B3
structural tests and findings, C process candidates, and every A product
candidate proposed for `Final`. It does not replace product acceptance,
canonical owners, or [Quality Platforms](../../verification/quality-platforms.md).

## Independence And Isolation

The coordinator supplies an artifact-complete frozen brief and may answer
factual questions, but cannot choose the verdict, change thresholds after
results, or reinterpret missing evidence as success. The evaluator receives no
conversation history and works from exact commits and retained artifacts in a
fresh isolated worktree. It may add evaluation-local tests and experiments but
returns only handoff-ready tests or precise instructions. It never changes
production code, merges a candidate, coordinates another role, or adopts a
proposal.

## Frozen Evaluation

The evaluator must:

1. Freeze the question, owner boundary, exact product, concept, and candidate
   commits, baseline, workload, environment, standards, deciding and guard
   metrics, budget, and rollback.
2. Execute the real test, rendered interaction, probe, benchmark, structural
   canary, or process canary. Reading alone cannot qualify it.
3. Replay baseline and candidate comparably and inspect literal output, Git and
   CI state, retained artifacts, and environmental drift.
4. Apply demanding boundaries and at least one causal negative control. The
   oracle must reject a deliberately broken cause without rejecting an
   unrelated condition.
5. Compare every claimed benefit and guard. Missing runtime detail stays
   unknown and makes the affected claim inconclusive.
6. Exercise rollback and prove restoration without residue.

For B1, also test plausible interview interpretations against complete user
journeys and adjacent needs. For B2, replay rendered tasks, tutorial context,
keyboard and pointer use, scaling, content pressure, and applicable
accessibility standards. For B3, validate mechanism, representative workload,
alternatives, scaling, safety, and change-cost guards. For C, compare speed,
quality, cost, and total measurement overhead. For a proposed A `Final`, compare
credible superior forms, plausible requirement changes, and every remaining
roadmap or foreseeable integration dependency.

## Verdict

The evaluator assigns exactly one Charter maturity to the candidate and records
literal evidence, uncertainty, rollback, and one of:

- `repair`: the premise, baseline, owner boundary, and oracle remain sound and
  the failure is localized;
- `restart`: a premise, owner, oracle, severe guard, or implementation shape is
  falsified; or
- `qualified use`: all deciding thresholds and guards support bounded use.

Every repair becomes a new committed candidate and receives a fresh evaluator.
Every restart returns to a fresh concept subagent. Sunk cost is irrelevant.

For B1, B2, and B3, the evaluator separately classifies the product hypothesis
as `confirmed`, `refuted`, or `inconclusive`; maturity describes the test or
instruction, not product maturity. A confirmed defect returns to A. For C,
evaluation only qualifies the instruction; its named canonical owner alone may
adopt it. For A, the verdict qualifies slice maturity only and cannot establish
whole-program completion.

The compact result belongs in the owning PR, roadmap entry, or process owner and
names exact commits, executable evidence, uncertainty, maturity, repair or
restart decision, proposed adoption boundary, and next owner action. After any
merge, an evaluator still active on other work synchronizes or recreates its
worktree at the newest stable product-slice commit and revalidates its baseline.

## References

- [Program Charter](program-charter.md)
- [B1 Behavior Assurance](behavior-assurance.md)
- [B2 UX Assurance](ux-assurance.md)
- [B3 Structural Assurance](structure-assurance.md)
- [C Process Optimization](process-optimization.md)
- [Documentation](../../documentation.md)
- [Quality Platforms](../../verification/quality-platforms.md)
