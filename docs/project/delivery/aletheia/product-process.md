Status: Active
Owner: Aletheia A
Last Reviewed: 2026-07-24
Charter Version: C-0.2.0
Process Version: A-0.3.0
Evaluation Version: E-0.3.0
Source of Truth: Current temporary execution rules for GM-Core product slices.

# GM-Core Product Process

Authority and completion come only from the [Program
Charter](program-charter.md). This file controls execution, not product truth.

## Slice Start

Before product mutation, select one unmet interview-derived acceptance outcome
through its canonical owner ID. In the slice's one short delivery owner, pin
that ID, the candidate base commit, Product Process `A-0.3.0`, and the commit
that contains this process version. Also name the intended production route and
the command, probe, counterexample, measurement, or owner observation that can
decide the outcome. Do not create generic role ledgers or structured evidence
records.

A running slice keeps its pinned process if B proposes a newer version. Change
it only through an explicitly reversible canary accepted under [Process
Evaluation](process-evaluation.md); otherwise apply an adopted process at the
next slice boundary.

## Work

Follow [Agent Instructions](../../architecture/agent-instructions.md). Prefer a
vertically usable slice with a real production route and concrete oracle. A
binding claim cites its canonical owner. An observed claim requires an actual
execution or owner observation against the named candidate and its literal
result. A read-only review, plausible mechanism, unexecuted command, or local
record about an execution remains a hypothesis until practically reproduced or
established by binding owner evidence.

Use practical tests, demonstrations, measurements, failure injection, or a
disposable experiment when they can decide a consequential uncertainty. When
counterevidence invalidates a premise, reopen the root decision before adding a
bridge. Prior investment is not evidence for retaining a decision.

## Checkpoint

Commit the candidate and run affected diagnostics plus the proof required by
[Quality Platforms](../../verification/quality-platforms.md). A fresh agent or
human who did not implement the slice then checks out or otherwise isolates the
candidate commit, reruns the frozen command, probe, or counterexample, inspects
its literal output and the candidate Git and CI state, and reports both the
verdict and uncertainty. The reviewer must judge whether the route and oracle
actually establish the acceptance outcome; a file, digest, role label, or green
unrelated test cannot establish that semantics.

Record only the compact outcome, proof location, reviewer, uncertainty, and
next action in the slice's existing short delivery owner or PR review. Do not
add a per-role report or second proof ledger. A slice is not accepted while the
independent replay is missing, materially different from the original
conditions, or inconclusive.

A failure caused solely by unrelated or untracked workspace state is neither a
product regression nor a green gate. Preserve that state and replay the exact
candidate in an isolated clean worktree or after its owner resolves the
interference.

## Product Owners

- [Interview baseline](../../interviews/program-needs/README.md)
- [Program capabilities](../../requirements/requirements-program-capabilities.md)
- [Program technical needs](../../architecture/program-technical-needs.md)
- [Vision](../../vision.md)
- [Resource policy](../../policies/resource-policy.md)
- [Agent Guide](../../../../AGENTS.md)
