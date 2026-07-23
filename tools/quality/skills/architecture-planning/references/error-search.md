# Architecture Planning Error Search

## Role Isolation

Give each specialist the Error Search contract, assigned specialist section,
neutral task, frozen input packet, and candidate. Do not provide conversation
history, Planner notes, other findings, or an intended fix. Specialists remain
read-only, do not launch agents, and report only evidence-backed findings.

After all specialist passes finish, give the clean-start auditor the same packet
and candidate but no specialist output. Main aggregates afterward.

## Universal Checks

Every pass checks relevant concerns for:

- complete and exact source-to-decision traceability;
- internal consistency across views, rules, and decisions;
- objective verification and feasible fitness functions;
- meaningful alternatives and honest tradeoffs;
- no invented product behavior or hidden requirement;
- no current-system anchoring in `Greenfield` mode;
- no unjustified preservation or reinvention in `Evolution` mode;
- explicit one-way doors, assumptions, and failure boundaries.

## Specialist A: Architecture And State

Search for counterexamples involving scope, vocabulary, identity, state owner,
mutation authority, aggregate and consistency boundaries, lifecycle, history,
cross-workflow atomicity, dependency direction, runtime ordering, stale state,
and contradictions between static and runtime views.

## Specialist B: Resilience And Performance

Search for counterexamples involving preservation, recovery, conversion,
portability, cancellation, partial success, retry, scheduling, contention,
resource exhaustion, startup and resume, large workloads, latency budgets,
background-work interference, measurement populations, and unverifiable or
physically inconsistent targets.

## Specialist C: Security And Modularity

Search for counterexamples involving trust boundaries, untrusted input,
permissions and revocation, egress, privacy, deletion, extension failure,
optional-capability removal, change isolation, accessibility, localization, and
hidden dependence on a technology or service. In `Evolution` mode, also search
for violated compatibility and transition constraints; do not introduce them in
`Greenfield` mode.

Do not add a default UX pass. Use a separate UX review only when the user asks
for it or the architecture question explicitly owns interaction design.

## Clean-Start Audit

Re-derive the expected obligations from the frozen packet and compare them with
the candidate. Check the specialist blind spots: omitted needs, nominal rather
than substantive mappings, mutually impossible rules, missing decision edges,
solution-shaped requirements, and claims stronger than their proof route.

Return `approve` or `reject`. Approval requires zero blocker and major findings
and every minor already repaired or recorded in the candidate with its explicit
risk, trigger, and verification owner.

## Finding Contract

Use this shape for every actionable finding:

| Field | Meaning |
| --- | --- |
| ID | Stable `F-*` identifier within the candidate version |
| Severity | `blocker`, `major`, or `minor` |
| Source | Violated need, constraint, decision, or candidate passage |
| Counterexample | Concrete scenario showing the failure |
| Impact | Quality, behavior, safety, or change consequence |
| Evidence | Reproduction, calculation, source, or trace mismatch |
| Affected decisions | `AD-*` dependency closure |
| Correction criterion | Outcome required for the finding to close, without prescribing implementation |

Use `blocker` for an impossible or contradictory candidate, invalid baseline,
or missing information that prevents a coherent architecture. Use `major` when
a binding need, quality scenario, safety boundary, one-way door, or objective
proof is missing or violated. Use `minor` for local precision or risk-recording
gaps that do not invalidate the selected architecture.

Do not report preferences, style suggestions, or speculative improvements as
findings. Do not repair the candidate in the verifier response.
