Status: Active
Owner: Aletheia A
Last Reviewed: 2026-07-26
Charter Version: C-0.7.0
Process Version: A-0.8.0
Evaluation Version: E-0.7.0
Source of Truth: Current temporary execution rules for GM-Core product slices.

# GM-Core Product Process

Authority and completion come only from the [Program
Charter](program-charter.md). This file controls execution, not product truth.

## Slice Start

Before product mutation, select one unmet interview-derived acceptance outcome
through its canonical owner ID. In the slice's one short delivery owner, pin
that ID, the candidate base commit, Product Process `A-0.8.0`, and the commit
that contains this process version. Also name the intended production route and
the command, probe, counterexample, measurement, or owner observation that can
decide the outcome. Do not create generic role ledgers or structured evidence
records.

A running slice keeps its pinned process when C proposes or an evaluator
qualifies a newer version. A may repin only after the named canonical owner has
durably adopted an explicitly reversible canary qualified under [Process
Evaluation](process-evaluation.md); otherwise apply the owner-adopted process at
the next slice boundary. Binding Charter changes apply immediately unless their
owner explicitly sets a later boundary.

## Aletheia Slice Cycle

A is a Codex role process with a Codex coordinator. For every slice, the
coordinator starts a fresh concept subagent to challenge scope, alternatives,
dependencies, and the production proof route. It then starts a separate
implementation-and-test subagent as the one exclusive productive writer in the
canonical checkout. A fresh evaluation subagent who authored neither phase
checks the committed candidate under [Shared Evaluation](process-evaluation.md).
The coordinator confines itself to dispatch, frozen handoffs, integration,
publication, and routing the verdict.

Only one A phase agent writes at a time. A localized repair uses a new
implementation candidate and fresh evaluator. `Rejected` or a falsified premise
returns to a fresh concept subagent rather than asking the same agent to defend
its design. No phase may approve its own work.

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

For consequential interpretation or implementation choices, the concept agent
researches applicable professional solutions, standards, and maintained tools
and preserves used external evidence under [Source
References](../../verification/source-references.md). The implementation agent
then tests the choice locally through a production-relevant route. No important
choice is accepted from reasoning alone. Prefer a calibrated existing tool over
building a new one, subject to the Charter's provenance, safety, resource, and
negative-control rules.

## Independent Reviewer Inputs

A remains the only product implementer and canonical roadmap owner. A consumes:

- confirmed B1 behavior findings as required repair, restart, or practical-
  refutation slices with their executable evidence;
- confirmed B2 UX findings and evaluated rendered or interaction tests;
- confirmed B3 structural findings, benchmarks, and precise change
  instructions; and
- independently qualified and owner-adopted C process instructions at their
  approved boundary.

Every input must be discoverable without cross-conversation context through an
exact commit and canonical evidence, roadmap, PR, or process-owner location.
Only A works directly in the canonical `projects/SaltMarcher` checkout and
changes shipped application code, resources, or product contracts. Reviewer
inputs may arrive as already merged, green tests or non-production tools, or as
a scoped committed handoff or precise instruction from a separate synchronized
worktree. A inspects every input and performs all productive implementation and
integration through its exclusive writer.

Inputs do not bypass next-step revalidation. A may split, reorder, reopen, or
reject a proposed roadmap step when current practical evidence shows a better
route. B1, B2, and B3 do not repair product code; C changes no product behavior
and does not approve its own process proposals.

## Implementation Maturity And Waves

Advance every feature in implementation waves. At slice start, record the
existing implementation's current maturity; the new candidate remains
`unevaluated` until its evaluation phase. After a decisive proof or severe
finding and at the slice checkpoint, the fresh evaluator assigns exactly one
maturity using the canonical definitions in the [Program
Charter](program-charter.md). The A coordinator or implementation agent may
propose but never award its own classification. `Final` additionally requires
the expanded audit under [Process Evaluation](process-evaluation.md) covering
implementation form, credible alternatives, plausible requirement changes, and
the complete remaining dependency horizon.

Before planning the next wave, decide whether the current maturity permits
extension or calls for reopening the root implementation. Do not build a bridge
solely to preserve a non-final candidate. Record the classification, concise
evidence basis, and explicit reopen boundary in the slice's one short delivery
owner or roadmap entry; do not create a maturity registry. A label describes
implementation confidence only. It cannot establish product truth, acceptance,
compatibility, or program completion.

## Checkpoint

Read the current candidate PR and the
[program umbrella issue](https://github.com/ThonkTank/Salt-Marcher/issues/555)
for artifact-complete urgent handoffs. Repeat this read immediately before
merge. A alone decides whether severe evidence requires pausing, reopening, or
continuing the slice.

At M13, also require the exact-candidate closure results from B1, B2, B3, and C
defined by the Charter. Missing, stale, or inconclusive closure evidence blocks
program completion even when no urgent finding is posted.

Give each acceptance-deciding oracle one disposable causal negative control
where practical. Remove or perturb the claimed cause while holding the relevant
conditions stable; the control must make the same proof fail or become
inconclusive. If no such control is practical, record why and the residual
uncertainty without weakening the positive route or changing acceptance.

Commit the candidate and run affected diagnostics plus the proof required by
[Quality Platforms](../../verification/quality-platforms.md). The fresh A
evaluation subagent checks out or otherwise isolates the candidate commit,
reruns the frozen command, probe, or counterexample, inspects literal output and
the candidate Git and CI state, and reports both verdict and uncertainty. It
must judge whether the route and oracle actually establish the acceptance
outcome; a file, digest, role label, or green unrelated test cannot establish
that semantics.

Record only the compact outcome, proof location, reviewer, uncertainty, and
next action in the slice's existing short delivery owner or PR review. Do not
add a per-role report or second proof ledger. A slice is not accepted while the
independent replay is missing, materially different from the original
conditions, or inconclusive.

A failure caused solely by unrelated or untracked workspace state is neither a
product regression nor a green gate. Preserve that state and replay the exact
candidate in an isolated clean worktree or after its owner resolves the
interference.

## Local Desktop Availability After Every Product Slice

After every productively implemented slice, freeze a clean exact-tree checkout
of the candidate commit and obtain its literal green `./gradlew check` plus
required CI. Before merge, run `./gradlew installDesktopApp` from that unchanged
checkout. Compare the built application JAR, packaging input, and installed
payload digests; read back the desktop entry and launcher target to confirm that
the shortcut resolves to that installed payload. Report the exact commit,
paths, and relevant digests. Leave the desktop shortcut on this latest accepted
slice so Aaron can test it at any time.

Installation is technical slice evidence, not an intermediate owner gate. A
continues autonomously unless Aaron supplies counterevidence or explicitly asks
to pause. Any such observation reopens the owning acceptance outcome and its
current maturity classification.

## Final Owner-Acceptance Boundary

This is a binding owner timing decision rather than a process proposal and
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
- [B1 Behavior Assurance](behavior-assurance.md)
- [B2 UX Assurance](ux-assurance.md)
- [B3 Structural Assurance](structure-assurance.md)
- [C Process Optimization](process-optimization.md)
- [Source References](../../verification/source-references.md)
