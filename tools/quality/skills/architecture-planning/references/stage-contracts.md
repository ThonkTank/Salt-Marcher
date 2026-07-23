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
| Verification anchors | Binding traces, preserved primary sources, calculations, measurements, executable checks, or disposable prototypes available for decision verification |
| Evidence budget | At most three technical evidence-acquisition attempts for the complete run |
| Exclusions | Current-system or delivery evidence forbidden in this mode |
| Success | Objective candidate and review acceptance facts |
| Output owner | Conversation plan or one canonical architecture owner document |

An external source is eligible only after its readable extract and original are
preserved through the global `source-references` skill. Freeze the complete
packet with a repository revision or content hash. If any packet change can
alter decision selection, tradeoff evaluation, or verification, discard the
current candidate but retain the run-wide candidate count. Re-enter the Planner
contract at the next remaining version. Never reset the counter after a packet
refresh; if no version remains, terminate under the Version And Stop Contract.

In `Greenfield`, the active solution-neutral needs and the complete transitive
set of requirements, vision, policy, and constraints that this owner explicitly
declares binding form the binding baseline. Preserve the needs owner's own
binding-versus-readback classification; neither promote a readback source nor
demote a transitive binding source. Record a repository revision or content hash
for the allowed inputs without inspecting excluded current-system material.

In `Evolution`, separate inputs into:

- active needs, confirmed requirements, accepted refactor outcome,
  must-preserve behavior, and compatibility constraints;
- active owner decisions explicitly opened for replacement by the refactor;
- unaffected active owner decisions, which remain binding;
- current implementation, production paths, and tests, which are evidence about
  the starting point rather than target requirements.

Do not replace or weaken an active owner decision unless the accepted scope names
it as opened. For an opened decision, preserve its rationale as evidence but do
not treat its current selection as automatic target truth.

Before `v1`, Main checks that every packet field is present and that no product
ambiguity, missing measurement population, or missing verification anchor can
alter a quality-critical or hard-to-reverse selection. Route product gaps to
the requirements owner and terminate the current run as
`Blocked: binding input unresolved`; owner-supplied input begins a new run.
Acquire missing technical evidence autonomously through
a preserved source, calculation, benchmark, executable check, or disposable
prototype before generating. Count every failed acquisition route against the
run-wide three-attempt Evidence budget. If the required anchor is still absent,
terminate as `No verifiable architecture can be produced`. A non-blocking
evidence gap may remain only when every affected choice stays reversible and the
candidate records the evidence owner, decision trigger, and proof required
before commitment.

## Planner Contract

Give the Planner the Planner contract, neutral task, and frozen packet only.
Require it to:

1. Restate the entity, scope, stakeholders, concerns, binding drivers, and
   priorities.
2. Enumerate architecture decision questions and their dependency order.
3. Generate at least two genuinely different alternatives for every
   quality-critical or hard-to-reverse decision. `Do nothing` is an alternative
   only in `Evolution` mode.
4. Compare alternatives against the binding needs, prioritized quality and
   change scenarios, failure modes, reversibility, proof cost, and available
   verification anchors.
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
- quality-scenario and failure-containment consequences;
- exact traceability and proposed fitness functions;
- compatibility and transition constraints in `Evolution` mode only;
- unresolved evidence gaps and risks without invented answers.

## Quality And Risk Analysis

For a program-wide candidate, derive a prioritized quality-driver tree or
equivalent scenario hierarchy from the binding inputs. Record:

- `Sensitivity point`: a decision, parameter, or assumption whose change
  materially changes a quality response.
- `Tradeoff point`: one decision that improves one binding quality objective
  while degrading another.
- `Risk`: supported uncertainty or weakness that can prevent a binding driver.
- `Non-risk`: an analyzed decision shown adequate by an independent anchor;
  absence of a finding is not a non-risk.
- `Risk theme`: related risks that threaten the same binding driver or need.
- `Quality question log`: decision-discriminating quality questions, their
  anchored responses, and the affected scenario and `AD-*` decision.

Map every item to affected `AD-*` decisions, scenarios, and verification. A
feature or bounded refactor may omit irrelevant categories with a reason.
Record at least one quality question and response for every high-priority
scenario whose result influences an alternative selection.

## Independent Anchor Contract

Accept these anchor classes:

- direct derivation from a binding source statement;
- preserved authoritative or primary external source;
- reproducible calculation, measurement, benchmark, or simulation;
- executable constraint, test, static check, or disposable prototype;
- explicit owner decision, only for product meaning or priority.

Model reasoning, agreement, debate, or a fresh context may discover a finding
or propose an explanation but is `model-only` evidence. It cannot by itself
close a blocker or major, justify a quality-critical or hard-to-reverse
decision, or establish a non-risk. Model diversity does not change this rule.

## Reviser Contract

Give a fresh Reviser the Reviser contract, neutral task, frozen packet,
candidate, and normalized findings only. For every finding, record `accept`,
`reject`, or `route`, the supporting evidence, and its anchor class.

`accept` means the finding is valid and must be corrected. `reject` means the
finding is invalid or out of scope and records why. `route` means the finding
requires a binding-input decision or independent technical anchor before
architecture work can continue. A product route terminates the current run as
`Blocked: binding input unresolved`. A technical route consumes the run-wide
Evidence budget; success freezes the changed packet and re-enters a fresh
Planner at the next remaining run-wide candidate version, while budget
exhaustion returns `No verifiable architecture can be produced`.
Process routed items before accepted findings.

Use a local revision when the finding adds missing precision, traceability,
proof, or containment without changing the selected alternative or its
rationale. Re-enter the Planner contract when correction changes a decision's
objective, invalidates its selection criteria, reverses a quality tradeoff, or
invalidates any dependent decision.

Route product ambiguity to the requirements owner. Resolve missing technical
evidence autonomously through the Independent Anchor Contract. Routing does not
consume a candidate version, but it obeys the terminal results and Evidence
budget above.

## Version And Stop Contract

- `v1`: initial Planner candidate.
- `v2`: first revised or replanned candidate after a rejected `v1`.
- `v3`: final permitted candidate after a rejected `v2`.

These are the only candidate slots for the complete run, including packet
refreshes after a technical route. Every candidate receives the full Error
Search contract. Approval ends the loop. Rejection or invalidation of `v3`, or
a required packet refresh when no candidate slot remains, returns
`No acceptable architecture found`, the remaining findings, and the earliest
invalid `AD-*` decision. It must not emit a fallback architecture or activation
claim.

The other terminal results are:

- `Blocked: binding input unresolved` for product meaning or priority that only
  the requirements owner can decide;
- `No verifiable architecture can be produced` when the run-wide Evidence
  budget is exhausted without a required independent anchor.

Neither result emits a candidate, fallback, or activation claim. Later owner
input or newly available evidence starts a new run with a new frozen packet.

Intermediate candidates, role notes, and findings remain untracked scratch
state. When context compaction makes a handoff file necessary, use the one short
delivery note already permitted by the agent instruction owner; do not create a
new planning registry.

An approved final result names the accepted candidate version, covered needs,
decision and verification trace, disposed findings with their anchor classes,
sensitivity and tradeoff points, risks, non-risks, risk themes, the quality
question log, accepted risks with owners and triggers, and any later
implementation or migration planning boundary. `No acceptable architecture
found` names the remaining findings and earliest invalid `AD-*` decision.
`Blocked: binding input unresolved` names the unresolved binding input and its
requirements owner. `No verifiable architecture can be produced` names the
missing independent anchor and the exhausted acquisition attempts.
