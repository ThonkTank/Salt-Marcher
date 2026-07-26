Status: Active
Owner: Aletheia C
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
Process Version: C-2.0.0
Evaluation Version: E-0.6.0
Source of Truth: Temporary protocol for measured GM-Core work-process optimization.

# C — Process Optimization

C researches governance, working processes, skills, workflows, verification
ergonomics, and implementation history to improve measured speed, quality, and
cost. C is a Codex role process: its Codex coordinator delegates concept,
reversible test, and independent evaluation to separate Codex subagents under
the [Program Charter](program-charter.md).

C observes A and B1-B3 only through live repository history, exact artifacts,
metrics, PR/CI state, and canonical owners. It does not coordinate their
conversations, change product requirements or product code, or use chat
summaries as evidence.

## Optimization Boundary

Every candidate preregisters at least one deciding or guard metric for:

- **Speed:** lead time, queue time, feedback latency, retries, or time to a
  decisive result.
- **Quality:** severe escapes, oracle discrimination, reproducibility,
  correctness, maintainability, or accepted-outcome coverage.
- **Cost:** tokens, agent turns, compute time, external spend, review load, or
  retained-process overhead.

The frozen brief names baseline window, threshold, repetitions, noise bound,
resource ceiling, total evaluation overhead, rollback, and the canonical owner
who may accept a bounded regression. A gain in one dimension is not an
improvement when another degrades without a measured, explicit, authorized
tradeoff. C cannot weaken `./gradlew check`, required CI, data safety, or final
product acceptance to manufacture speed or savings.

## Practical Cycle

The coordinator selects one evidenced process failure or opportunity and
freezes a stable product commit and budget. A concept subagent researches
primary standards and comparable methods, changes one process variable, and
defines prediction, metrics, negative controls, rollback, and owner boundary. A
separate test subagent implements the smallest reversible instruction, skill,
workflow, governance, or tooling canary in C's own worktree and compares it with
the baseline on equivalent real work. A fresh evaluation subagent replays both
conditions, verifies all guards and total overhead, and qualifies repair,
restart, or bounded use.

A synthetic workload must reproduce or measurably correlate with at least one
frozen real A, B1, B2, B3, or C incident on every deciding and guard signal.
Without that fidelity, the result is capped at `Proof of Concept` or
`Preliminary` and cannot justify durable adoption. Read-only argument, model
consensus, or an unmeasured shorter prompt is not proof.

## Adoption And Handoff

Evaluation qualifies a proposal; it never adopts it. The named canonical owner
alone adopts a qualified process change. C keeps research, canaries, and
evaluation artifacts in its own worktree and returns only a handoff-ready
process instruction for A; experimental tooling is not merged. A implements
the adopted instruction productively at the evaluated boundary. A running
slice repins only when the canary specifically proves that safe; otherwise the
change starts at the next slice boundary.

The handoff records exact commits, literal measurements, all three tradeoffs,
maturity, owner decision, rollback, and reopen trigger. After every merge, C
synchronizes or recreates its worktree at the newest stable product-slice
commit.

## Current Candidates

- **Operation-scoped asynchronous terminal oracles — unevaluated:** required CI
  exposed three oracles sampling queue drains, fixture-wide absence, or an
  ungated transient state instead of their causal terminal condition. Evidence:
  [PR #559](https://github.com/ThonkTank/Salt-Marcher/pull/559), commits
  `8c3e87369`, `a695027af`, and `8451c11df`, and CI runs
  [30198497562](https://github.com/ThonkTank/Salt-Marcher/actions/runs/30198497562)
  and [30199633707](https://github.com/ThonkTank/Salt-Marcher/actions/runs/30199633707).
  On exact `8451c11df`,
  `./gradlew check --rerun-tasks --console=plain` completed green locally in
  11m3s. Cross-workload evaluation is still required before changing a rule.
- **Failure-only CI result retention — unevaluated:** failed jobs did not retain
  literal JUnit assertion details. A bounded canary must measure diagnostic
  value, security, storage, and workflow cost before adoption.

Neither candidate changes A's process until a fresh evaluator qualifies a
concrete instruction and its named canonical owner adopts it.

## References

- [Program Charter](program-charter.md)
- [Product Process](product-process.md)
- [Shared Evaluation](process-evaluation.md)
- [Agent Instructions](../../architecture/agent-instructions.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [Source References](../../verification/source-references.md)
