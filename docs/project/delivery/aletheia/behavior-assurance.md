Status: Active
Owner: Aletheia B1
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
Process Version: B1-1.0.0
Evaluation Version: E-0.6.0
Source of Truth: Temporary protocol for antagonistic GM-Core behavior and product-fit assurance.

# B1 — Behavior Assurance

B1 asks whether SaltMarcher actually solves the interview-derived GM problems,
not merely whether code matches a literal sentence. B1 is a Codex role process:
its Codex coordinator delegates concept, practical test, and independent
evaluation to separate Codex subagents under the [Program
Charter](program-charter.md).

## Review Boundary

B1 tests complete user outcomes, domain coherence, capability completeness,
cross-workflow consistency, state transitions, error handling, recovery,
cancellation, import and export outcomes, and useful offline behavior. It looks
for missing work, nominally present but insufficient capability, contradictory
interpretations, accidental workflow assumptions, and locally correct behavior
that fails the end-to-end GM job.

Interviews remain the binding product evidence, but ambiguity is not resolved by
word matching. A concept agent states plausible interpretations and evaluates
them against all interviews, vision, adjacent needs, realistic GM scenarios,
simplicity, reversibility, and future option value. External research may
inform human factors or domain methods but cannot invent SaltMarcher product
scope. If evidence cannot distinguish interpretations, B1 reports the
uncertainty and the safest reversible option; it does not create a hidden
requirement or intermediate owner gate.

## Practical Cycle

The coordinator freezes the exact stable A commit, affected owner IDs, and
budget. A fresh concept subagent defines one falsifiable product question,
credible interpretations, production journey, oracle, counterexample, and
negative control. A separate test subagent implements the smallest production-
route test, scenario harness, failure injection, or probe in B1's own worktree
and preserves literal results. A fresh evaluation subagent replays both the
intended journey and counterexample and classifies the test candidate plus the
product finding as confirmed, refuted, or inconclusive.

Reading, code plausibility, fixture self-tests, and green unrelated tests are
not behavior proof. A permanent handed-off test must exercise the production
route and discriminate a deliberately broken cause.

## Handoff

B1 never repairs product code. It returns only a finished evaluated test or a
precise behavior instruction naming the product and test commits, affected
owner IDs, reproducer, literal result, interpretation analysis, severity,
uncertainty, and reopen condition. A integrates a durable regression test with
its repair so the product branch is not intentionally red. Urgent findings use
the Charter inbox. After every merge, B1 synchronizes or recreates its worktree
at the newest stable product-slice commit.

## References

- [Program Charter](program-charter.md)
- [Product Process](product-process.md)
- [Shared Evaluation](process-evaluation.md)
- [Interview Baseline](../../interviews/program-needs/README.md)
- [Program Capabilities](../../requirements/requirements-program-capabilities.md)
