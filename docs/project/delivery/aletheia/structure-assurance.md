Status: Active
Owner: Aletheia B3
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
Process Version: B3-1.0.0
Evaluation Version: E-0.6.0
Source of Truth: Temporary protocol for antagonistic GM-Core architecture and engineering-quality assurance.

# B3 — Structural Assurance

B3 determines whether the product is built in the simplest sound form that can
meet current quality needs and absorb plausible change. B3 is a Claude role
process: its Claude coordinator delegates concept, practical canary or test,
and independent evaluation to separate Claude subagents under the [Program
Charter](program-charter.md).

## Review Boundary

B3 tests architecture and dependency direction, state and identity ownership,
consistency boundaries, concurrency, cancellation, failure containment,
recovery, persistence, import and export, modularity, trust boundaries,
privacy, security, performance, startup, rendering cost, memory and resource
use, algorithmic scaling, maintainability, testability, and change cost. It asks
whether a smaller or clearer design provides equal or better behavior and
whether current coupling will force later slices into bridges.

Existing architecture and patterns are hypotheses, not protected truth.
Structural criticism must identify an observable quality risk or measured
change cost. A pattern preference, complexity impression, static metric, or
unexecuted performance claim alone is not a finding.

## Practical Cycle

The coordinator freezes the stable A commit, applicable technical-needs IDs,
resource profile, workload, and budget. A concept subagent maps the suspected
mechanism and compares credible alternatives with deciding and guard metrics. A
separate test subagent builds a benchmark, stress or fault probe, dependency or
architecture test, security test, change canary, or disposable structural
prototype in B3's own worktree. A fresh evaluation subagent replays baseline and
candidate under comparable conditions, validates negative controls, and checks
behavior, UX, safety, and resource guards.

A synthetic workload must reproduce or measurably correlate with a frozen real
product journey or incident on all deciding and guard signals. Otherwise it
cannot justify a durable structural instruction. A disposable prototype proves
possibility, never production readiness.

## Handoff

B3 never refactors or repairs production code. It returns only a finished
evaluated test or a precise structural instruction for A with exact commits,
mechanism, workload, measurements, alternatives, tradeoffs, affected owners,
severity, uncertainty, and reopen trigger. Experimental structure remains in
B3's worktree. Urgent findings use the Charter inbox. After every merge, B3
synchronizes or recreates its worktree at the newest stable product-slice
commit.

## References

- [Program Charter](program-charter.md)
- [Product Process](product-process.md)
- [Shared Evaluation](process-evaluation.md)
- [Program Technical Needs](../../architecture/program-technical-needs.md)
- [Source Architecture](../../architecture/source-architecture.md)
- [Resource Policy](../../policies/resource-policy.md)
