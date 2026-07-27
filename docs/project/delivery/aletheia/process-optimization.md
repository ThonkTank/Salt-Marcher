Status: Active
Owner: Aletheia C
Last Reviewed: 2026-07-27
Charter Version: C-0.9.1
Process Version: C-2.2.1
Evaluation Version: E-0.7.0
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

C's scope explicitly includes the tools and evaluation methods used by every
role: availability, setup and feedback latency, calibration, discrimination,
coverage, reproducibility, false positives and negatives, maintenance burden,
security, resource use, token cost, and whether a maintained professional
alternative outperforms custom tooling.

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

The coordinator selects one evidenced process failure or opportunity, verifies
that C has tools capable of measuring all three dimensions, and freezes a
stable product baseline and budget. A concept subagent researches
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

Evaluation qualifies a proposal; it never adopts it. Under the Product Owner's
standing delegation in the Program Charter, the named role coordinator adopts
an exact qualified reversible non-production process change automatically when
all frozen guards pass. C keeps research and unevaluated
canaries in its own worktree. After adoption, C's coordinator may merge a scoped
process document, skill, workflow, test, or non-production tool through a green
PR for a SaltMarcher-owned surface. Global or cross-project instructions go to
their actual owning maintainer; A only consumes an externally adopted version
and never copies a global skill into this repository. If an instruction
requires shipped application changes, only A implements that part. A running
slice repins only when the canary specifically proves that safe; otherwise the
change starts at the next slice boundary.

The handoff records exact commits, literal measurements, all three tradeoffs,
maturity, owner decision, rollback, and reopen trigger. After every merge, C
synchronizes or recreates its worktree at the newest stable product baseline.

At M13, C posts a closure result for the exact candidate even when it has no
proposal. It contains process surfaces and history sampled, speed-quality-cost
budget and measurements, commands and commits, fresh evaluator result,
unresolved uncertainty, and remaining required handoffs.

## Current Candidates

- **Crash-safe cooperative host admission — adopted, Preliminary:** C5 at
  candidate `ccce150ec5` passed its complete retained matrix and fresh replay.
  It preserves A intent priority, serializes finite non-A batches, and retains
  lease custody through independent loss of either supervisor or watchdog until
  the old command group is gone. New heavy local role-worker batches use
  `tools/quality/aletheia-c5/host-lease-native`; non-A exit `75` means wait and
  retry, never terminate the role goal. Do not interrupt an already-running
  worker merely to wrap it. The bounded claim is cooperative same-user local
  scheduling with independent loss of at most one controller—not hostile
  isolation, correlated controller loss, or host-failure safety. Reopen on any
  overlap, premature admission/release, material overhead regression, threat-
  boundary expansion, or operational maintenance burden.
  C5 is an outer host scheduler, so its executable—not merely its payload—must
  be launched with host execution. A sandboxed wrapper invocation is a launcher
  integration failure and cannot establish C5 or workload unavailability.
  Current paired evidence on `07ea4e183` reproduced the historical Gradle
  wildcard-IP failure for both wrapped and unwrapped commands inside the same
  restricted network sandbox, while direct host Gradle completed and unchanged
  C5 wrapping the same host Gradle command also completed. The exact MAT Usage
  preflight likewise completed with exit `13` in `4.96 s` direct and `5.40 s`
  through unchanged host-launched C5; the historical 900-second result is not
  currently reproducible. Operational use follows the Charter's one-canary,
  two-minute-failure, immediate-A-fallback rule rather than launching a long C
  investigation on A's critical path.

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

The async-oracle and CI-retention candidates do not change A's process until a
fresh evaluator qualifies their concrete instruction. A qualified bounded
instruction is then adopted under the Charter without an intermediate owner
prompt and begins at the next slice boundary unless its canary explicitly
proves an in-flight repin safe.

## References

- [Program Charter](program-charter.md)
- [Product Process](product-process.md)
- [Shared Evaluation](process-evaluation.md)
- [Agent Instructions](../../architecture/agent-instructions.md)
- [Quality Platforms](../../verification/quality-platforms.md)
- [Source References](../../verification/source-references.md)
