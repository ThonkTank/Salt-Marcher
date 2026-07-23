# Architecture Planning Stage Contracts

## Input Packet

Main freezes one packet before candidate generation:

| Field | Required content |
| --- | --- |
| Goal | Architecture question and intended decision outcome |
| Mode | `Greenfield` or `Evolution` |
| Audience | Consumers of the candidate and its decisions |
| Baseline | Exact owner documents plus repository revision, immutable source version, or content hash for every included input |
| Binding inputs | Mode-specific authorities defined below |
| Readback inputs | Sources used only to resolve or audit an existing binding input |
| Current evidence | `Evolution` starting-point owners, contracts, production paths, tests, and enforcement; `none, forbidden` in `Greenfield` |
| Exclusions | Current-system or delivery evidence forbidden in this mode |
| Success | Objective candidate and review acceptance facts |
| Output owner | Conversation plan or one canonical architecture owner document |

An external source is eligible only after its readable extract and original are
preserved through `source-references`. If a binding input changes, discard the
candidate count and start again at `v1`.

In `Greenfield`, only the active solution-neutral needs and constraints stated
inside that owner are binding. Requirements, vision, policy, and preserved
evidence are readback sources for checking provenance or resolving an ambiguity;
they do not independently add target behavior. Record a repository revision or
content hash for the allowed inputs without inspecting excluded current-system
material.

In `Evolution`, the active needs and confirmed requirements plus an explicitly
accepted refactor outcome, must-preserve behavior, and compatibility constraints
are binding. Current structure, production paths, and tests are evidence about
the starting point, not automatic target requirements.

Before `v1`, Main checks that every packet field is present and that no product
ambiguity or missing measurement population can alter selection criteria. Route
such gaps to the requirements owner and do not generate. A non-blocking
technical evidence gap may remain in a candidate only when all affected choices
stay reversible and the candidate records the evidence owner, decision trigger,
and proof needed before commitment.

## Planner Contract

Give the Planner the Planner contract, neutral task, and frozen packet only.
Require it to:

1. Restate the entity, scope, stakeholders, concerns, and binding priorities.
2. Enumerate architecture decision questions and their dependency order.
3. Generate at least two genuinely different alternatives for every
   quality-critical or hard-to-reverse decision. `Do nothing` is an alternative
   only in `Evolution` mode.
4. Compare alternatives against the binding needs, quality and change
   scenarios, failure modes, reversibility, and proof cost.
5. Select a coherent candidate from evidence and priorities, never by vote or
   by combining incompatible advantages from different alternatives.
6. Assign stable `AD-*` decision identifiers and map every binding need through
   `Need -> AD -> View or rule -> Verification`.

Use only the views needed by the concerns. A program-wide candidate normally
covers context, state and ownership, static boundaries, runtime and concurrency,
data and recovery, trust and extensions, deployment, and verification. A
feature or refactor candidate may omit irrelevant views but must say why.

The candidate must contain:

- scope, vocabulary, assumptions, and exclusions;
- selected decisions, alternatives, rationale, costs, and reversibility;
- boundary ownership and dependency direction;
- runtime and consistency behavior for critical cross-workflows;
- quality-scenario and failure containment consequences;
- exact traceability and proposed fitness functions;
- compatibility and transition constraints in `Evolution` mode only;
- unresolved evidence gaps and risks without invented answers.

## Reviser Contract

Give a fresh Reviser the Reviser contract, neutral task, frozen packet,
candidate, and normalized findings only. For every finding, record `accept`,
`reject`, or `route` with evidence.

`accept` means the finding is valid and must be corrected. `reject` means the
finding is invalid or out of scope and records why. `route` means the finding
requires a binding-input decision or external evidence before architecture work
can continue; it pauses both local revision and replanning. Process routed items
before accepted findings. If they change a binding input, discard the candidate
count and restart at `v1`.

Use a local revision when the finding adds missing precision, traceability,
proof, or containment without changing the selected alternative or its
rationale. Re-enter the Planner contract when correction changes a decision's
objective, invalidates its selection criteria, reverses a quality tradeoff, or
invalidates any dependent decision.

Route product ambiguity to the requirements owner. Resolve missing technical
evidence through `source-references`. Neither case consumes another candidate
version until the frozen packet changes or becomes complete.

## Version And Stop Contract

- `v1`: initial Planner candidate.
- `v2`: first revised or replanned candidate after a rejected `v1`.
- `v3`: final permitted candidate after a rejected `v2`.

Every candidate receives the full Error Search contract. Approval ends the
loop. Rejection of `v3` returns `No acceptable architecture found`, the
remaining findings, and the earliest invalid decision. It must not emit a
fallback architecture or activation claim.

Intermediate candidates, role notes, and findings remain untracked scratch
state. When context compaction makes a handoff file necessary, use the one short
delivery note already permitted by the agent instruction owner; do not create a
new planning registry.

An approved final result names the accepted candidate version, covered needs,
decision and verification trace, disposed findings, accepted risks with owners
and triggers, and any later implementation or migration planning boundary. A
failed final result names the remaining findings and earliest invalid decision.
