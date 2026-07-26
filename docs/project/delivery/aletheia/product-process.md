Status: Active
Owner: Aletheia A
Last Reviewed: 2026-07-26
Charter Version: C-0.3.0
Process Version: A-0.4.0
Evaluation Version: E-0.3.1
Source of Truth: Current temporary execution rules for GM-Core product slices.

# GM-Core Product Process

Authority and completion come only from the [Program
Charter](program-charter.md). This file controls execution, not product truth.

## Slice Start

Before product mutation, select one unmet interview-derived acceptance outcome
through its canonical owner ID. In the slice's one short delivery owner, pin
that ID, the candidate base commit, Product Process `A-0.4.0`, and the commit
that contains this process version. Also name the intended production route and
the command, probe, counterexample, measurement, or owner observation that can
decide the outcome. Do not create generic role ledgers or structured evidence
records.

A running slice keeps its pinned process if B proposes a newer version. Change
it only through an explicitly reversible canary accepted under [Process
Evaluation](process-evaluation.md); otherwise apply an adopted process at the
next slice boundary. The Charter's implementation-maturity rule is a direct
owner instruction and therefore applies immediately to every running slice
despite an earlier process pin.

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

## Implementation Maturity And Waves

Advance every feature in implementation waves. At slice start, after a
decisive proof or severe finding, and at the slice checkpoint, classify the
implemented candidate as exactly one maturity:

- `Rejected`: the candidate is unsuitable. Stop extending it and restart the
  implementation from its deciding premise; retain only evidence useful to the
  restart.
- `Proof of Concept`: the intended observable behavior is demonstrated, but
  the implementation is structurally or operationally inadequate. It may stand
  temporarily, but no planner may treat it as a required foundation.
- `Preliminary`: the current implementation and proof are adequate for now. No
  immediate rewrite is required, but a later wave may reopen, redesign, or
  replace it without preserving its internal shape.
- `Final`: the candidate has earned the highest implementation-quality seal.
  Current requirements are implemented in the best attainable form: maximally
  clean, simple, correct, cohesive, robust, and maintainable; no credible
  materially superior form remains unexamined; practical change scenarios show
  flexibility under plausible future new or changed requirements; and a
  dependency-horizon audit shows that no remaining planned or foreseeable
  integration slice must access it in a way that could require changes. This is
  the only maturity closed by default. Any uncertainty requires `Preliminary`;
  premature finalization is a severe finding. New binding needs or practical
  counterevidence still reopen it.

Before planning the next wave, decide whether the current maturity permits
extension or calls for reopening the root implementation. Do not build a bridge
solely to preserve a non-final candidate. Record the classification, concise
evidence basis, and explicit reopen boundary in the slice's one short delivery
owner or roadmap entry; do not create a maturity registry. A label describes
implementation confidence only. It cannot establish product truth, acceptance,
compatibility, or program completion.

## Checkpoint

Give each acceptance-deciding oracle one disposable causal negative control
where practical. Remove or perturb the claimed cause while holding the relevant
conditions stable; the control must make the same proof fail or become
inconclusive. If no such control is practical, record why and the residual
uncertainty without weakening the positive route or changing acceptance.

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

## Final Owner-Acceptance Boundary

This is a binding owner timing decision rather than a B process proposal and
therefore applies immediately to running slices despite an earlier process pin.
Do not wait for Aaron's personal acceptance between product slices. A slice may
continue into integration only after its named outcome has practical
production-route proof, independent replay, affected diagnostics, a literal
green `./gradlew check`, green required CI, an installed candidate, and relevant
UI automation where applicable. Owner observations offered during development
are binding counterevidence or clarification, but become a mandatory
intermediate gate only when Aaron explicitly requests one for that slice.

Aaron performs personal visual, interaction, and assistive-technology
acceptance against the fully integrated, installed GM-Core candidate at program
completion. Each deviation found there reopens every owning acceptance outcome
and slice, blocks program completion, and requires repaired slice proof plus a
new integrated owner test. Intermediate technical acceptance never overrides
final practical counterevidence; the Charter remains the sole completion
authority.

## Compatibility Covenant

Before complete GM-Core owner acceptance and authorization for first
non-disposable use or distribution, an internal schema, commit, test fixture,
or development install creates no legacy-compatibility obligation. A may
replace persisted representations and recreate only state positively identified
as disposable development or test data. Unknown or real data remains protected
by the owner-data rules.

The covenant starts only when one record contains all of the following literal
evidence for the exact candidate:

1. Complete GM-Core acceptance required by the Charter.
2. Owner authorization for first non-disposable use or distribution, with the
   exact commit and artifact.
3. An inventory of externally durable data surfaces and their frozen version or
   equivalent reader/writer expectation.
4. A production-route fresh-install probe that creates representative durable
   state, closes, reopens, and reads it with that artifact.

After that first trigger, every later change that can encounter data from a
supported released artifact must practically prove preservation or replay an
explicit upgrade path from the oldest supported baseline. Renaming or reverting
the process cannot make released data disposable. Destructive recreation then
requires the same owner authority as any other real-data modification.

## Product Owners

- [Interview baseline](../../interviews/program-needs/README.md)
- [Program capabilities](../../requirements/requirements-program-capabilities.md)
- [Program technical needs](../../architecture/program-technical-needs.md)
- [Vision](../../vision.md)
- [Resource policy](../../policies/resource-policy.md)
- [Agent Guide](../../../../AGENTS.md)
