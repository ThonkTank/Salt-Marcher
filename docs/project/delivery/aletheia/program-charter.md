Status: Active
Owner: SaltMarcher Product Owner
Last Reviewed: 2026-07-27
Charter Version: C-0.9.1
Source of Truth: User-given authority, workstream boundaries, agent assignment, maturity semantics, and completion boundary for the GM-Core program.

# GM-Core Aletheia Program Charter

Interview-derived needs and acceptance criteria determine product scope,
behavior, and completion. They are evidence to interpret, not wording to obey
mechanically. Existing code, architecture, tests, reviews, metrics, prior
investment, or a model's confidence cannot establish product truth by
themselves. Practical counterevidence may reopen any product, structure, or
process premise.

## Five Independent Role Processes

- **A — Product Delivery (Codex coordinator and Codex phase agents)** owns the
  canonical roadmap and is the only process that changes shipped runtime code,
  production resources, or product contracts. A
  implements one independently usable slice at a time until the whole GM core
  is complete.
- **B1 — Behavior Assurance (Codex coordinator and Codex phase agents)**
  antagonistically tests whether the
  product solves the interview-derived user problems completely, coherently,
  and usefully through real workflows. B1 challenges omissions, contradictions,
  weak interpretations, cross-workflow behavior, failure recovery, and whether
  an apparently conforming capability is actually sufficient for its purpose.
- **B2 — UX Assurance (Claude coordinator and Claude phase agents)**
  antagonistically tests information
  architecture, workflow shape, clarity, learnability, visual quality,
  accessibility, localization, feedback, recovery, and in-game tutorials in
  realistic rendered interaction.
- **B3 — Structural Assurance (Claude coordinator and Claude phase agents)**
  antagonistically tests architecture,
  state and dependency ownership, simplicity, maintainability, performance,
  resource use, concurrency, resilience, persistence, privacy, security, and
  capacity for later change.
- **C — Process Optimization (Codex coordinator and Codex phase agents)**
  researches and tests improvements to
  governance, working processes, skills, workflows, and verification. C
  optimizes measured speed, quality, and cost without hiding regression in any
  dimension or weakening product acceptance and safety.

B1, B2, and B3 do not repair product code. They build practical tests,
measurements, probes, or disposable experiments and return evidence plus
precise instructions to A. C changes no product requirement or product code and
cannot approve its own proposal. All five processes continue beside one another
without becoming intermediate owner gates.

## Continuous Autonomous Operation

The Product Owner delegates adoption of a reversible, non-production process
change to its named role coordinator once a fresh independent evaluator
qualifies the exact candidate and every frozen speed, quality, cost, safety,
rollback, and shipped-boundary guard passes. No intermediate owner response is
required. This delegation never covers shipped behavior or resources, product
requirements or acceptance, weakened `check` or CI, real data, secrets,
external transmission, paid services, or an unevaluated tradeoff.
It executes a standing owner decision; it is not self-approval by C or an
evaluator.

A role goal persists until its program exit. Queueing, another role's active
worker, a temporarily unavailable host window, a retryable admission result, or
a quiet phase agent is not a terminal blocker. The coordinator preserves the
in-flight candidate and its artifacts, continues safe independent work, and
retries within its frozen budget. It replaces a phase agent only after positive
evidence of failure, budget expiry, or a falsified premise—not merely because
the agent is quiet, slow, or nearly complete. If one candidate cannot proceed,
the role may advance non-conflicting preparation but does not discard completed
work or end its standing goal.

## Research, Evidence, And Tooling

Every role coordinator must give its phase agents access to online research and
the practical tools needed to decide their assigned problem. Important product,
design, architecture, finding, maturity, and process decisions must combine
local practical evidence with applicable professional knowledge; purely
theoretical reasoning, intuition, or model consensus is insufficient.

Research starts with primary standards, authoritative documentation, original
research, and maintained professional tools. External evidence follows [Source
References](../../verification/source-references.md): preserve an auditable
original and readable extract in the global mirror before relying on it. Online
research may inform interpretation, methods, thresholds, and alternatives but
cannot create SaltMarcher product scope. All acquisition and use remains inside
the [Resource Policy](../../policies/resource-policy.md): do not upload repository
source or real data, expose secrets, or enable paid or unapproved services.

B1, B2, B3, and C begin each candidate by checking whether their role worktree
has tools that can quantify the relevant baseline and discriminate the proposed
change. Prefer an established out-of-the-box tool over custom construction when
it fits the use case. Before trusting it, record source, version, license,
configuration, reproducible command, resource cost, and calibration against at
least one known-good and one known-bad case. Isolate newly sourced executables
and dependencies until provenance, safety, and utility are established. Build a
custom tool only when no suitable tool exists or it cannot be sourced, and test
the custom oracle with the same controls.

Experimental tools stay in the role worktree. Once independently evaluated, a
role may merge a handoff-ready test or non-production tool under the boundary
below. Any tool change that affects shipped application behavior returns as an
instruction and is implemented only by A. C treats tool selection, setup latency, measurement validity,
evaluation methods, false-positive and false-negative behavior, repeatability,
maintenance, tokens, compute, and total cost as process variables subject to
the same Aletheia cycle.

## Role Coordinators, Conversations, And Worktrees

Each process runs through its own role coordinator in its own persistent
conversation. No global coordinator manages, sequences, summarizes, or approves
multiple roles. Each role coordinator selects bounded work, starts fresh phase
subagents, enforces budgets and exclusive writers, verifies artifact-complete
handoffs, and routes the evaluated result. It does not replace the phase agents
by authoring and approving one monolithic answer.

Concept, test, and evaluation are separate subagent assignments. The evaluation
agent is fresh and did not author the concept or candidate. A repair uses a new
test candidate and fresh evaluator; a restart returns to a fresh concept agent.
Subagents communicate through frozen commits, briefs, commands, and literal
results rather than shared conversational assumptions. A role reconstructs
current truth from canonical owners, exact commits, PR/CI state, executable
evidence, and retained measurements; another role conversation's memory or
summary is never authority.

Only A works directly in the canonical `projects/SaltMarcher` checkout. B1, B2,
B3, C, and every evaluator use separate Git worktrees rooted at the exact latest
stable product baseline. That baseline is the green target-branch tip containing
the newest checkpoint-complete A slice plus every accepted non-production
handoff merged since it. Non-A processes never edit A's working tree or use
uncommitted A state as evidence.

Non-A role work may return only as handoff-ready tests, verification or analysis
tools, or precise instructions for A, including evaluated roadmap and process
instructions. A role coordinator may merge its own evaluated, scoped work
through the repository's normal branch, PR, green-check, and owner rules when it
does not change shipped application behavior, runtime code or resources, or a
product contract. A alone implements and integrates every productive change.
Experimental product or structural prototypes remain in their origin worktree.
A defect-demonstrating test that would leave the target red remains a handoff
until A integrates it atomically with the repair. After every merge into A's
branch or `main`, all non-A processes fetch and synchronize or recreate their
worktrees at the exact newest stable product baseline before further work. If
an evaluation was in flight, its frozen old-commit result remains historical
evidence and the phase stops; any still-relevant question becomes a new
committed candidate with a fresh evaluator on the new baseline. If the new base
invalidates a premise, oracle, or workload, the candidate restarts from concept.

Every handoff names the producer and product commits, executable evidence or
measurement location, evaluation and maturity state, uncertainty, and next
owner action. An urgent artifact-complete finding is posted to A's current PR
when it affects that candidate, otherwise to the [program umbrella
issue](https://github.com/ThonkTank/Salt-Marcher/issues/555). A reads both at
every checkpoint and immediately before merge. Only A decides whether the
evidence pauses or reopens product work.

## Resource And Termination Discipline

A owns the delivery critical path. B1, B2, B3, and C may each hold at most one
active candidate and preregister time, token or turn, compute, and external-cost
budgets. They select the highest expected risk or process value, stop as
`inconclusive` when a budget expires, and never prolong the program merely to
search for hypothetical improvement.

At each A slice boundary, each B reviewer samples the changed surface through
its own lens plus at most one highest program-wide risk. C tests at most one
highest-value process variable. Program closure uses one bounded integrated B1,
B2, and B3 sweep against the interview journeys and unresolved risks. C closes
when no evaluated required proposal remains and its final budget exposes no new
severe evidence.

All newly started heavy local Gradle, Java, UI, benchmark, or synthetic-worker
batches use the currently adopted cooperative host-admission tool. A receives
intent priority; B1, B2, B3, and C run one finite admitted non-A batch at a
time. A retryable deferral waits and retries without becoming a blocked goal.
Already-running workers are allowed to finish and are never killed merely to
retrofit admission. This is local same-user scheduling, not a global
coordinator, security boundary, or guarantee against host failure.

The admission executable itself runs as a top-level host command. A nested
sandboxed launch cannot observe or coordinate the host it is meant to guard and
is invalid availability evidence. In Codex, invoke the adopted executable with
host execution (`sandbox_permissions=require_escalated`) and keep the admitted
payload, working directory, environment, and audit path explicit. This standing
authorization covers only the local, finite, already-permitted workload; it
does not authorize network egress, broader filesystem mutation, secrets, paid
services, or real-data access.

On the first heavy batch in a new execution envelope, run one representative
startup canary through that exact host-launched path with a 60-second ceiling.
Reuse its result while the envelope and tool identity remain unchanged. If the
canary fails before the workload starts, C records a bounded process failure
within two minutes; A does not wait for a new C experiment and may run its exact
critical-path workload directly and serially while B1, B2, B3, and C defer new
heavy batches. This fallback expires when the host-launched path is available
again. It never changes product proof or permits overlapping heavy work.

For M13, every B1, B2, B3, and C role coordinator posts an artifact-complete
closure result against the exact candidate to the M13 PR, or to the umbrella
issue when no PR exists. It names covered risks and journeys, budget, exact
commits and commands, independent evaluator result, unresolved uncertainty, and
whether any required handoff remains. A cannot complete M13 until all four
closure results are present and consistent with the candidate.

## Aletheia Cycle For B1, B2, B3, And C

Each candidate passes through three independently staffed phases under its role
coordinator:

1. **Concept:** freeze a falsifiable question, owner boundary, baseline,
   practical experiment, deciding metrics, researched standards, risks,
   resource budget, and rollback.
2. **Test:** implement and run the smallest real test, probe, rendered
   interaction, benchmark, structural canary, or reversible process canary
   under demanding production-relevant conditions. Reading and intuition alone
   are not proof.
3. **Evaluation:** a fresh independent evaluation subagent who did not author
   either earlier phase replays the candidate, negative controls, metrics, and
   rollback, then qualifies it as repair, restart, or bounded use. The
   evaluator does not coordinate roles, adopt proposals, or change production
   code.

## Maturity

Every implemented A slice and every B1, B2, B3, or C candidate that reaches
evaluation receives exactly one maturity. Concepts and in-progress tests are
`unevaluated`, which is not a fifth maturity:

- `Rejected`: unsuitable; stop extending it and restart from the falsified
  premise. Retain only useful evidence.
- `Proof of Concept`: the intended signal or behavior is demonstrated, but the
  implementation form is inadequate and disposable.
- `Preliminary`: adequate for bounded use, but explicitly open to redesign or
  replacement.
- `Final`: the rare highest-quality seal. The form is the best attainable
  clean, simple, correct, robust, maintainable, and cohesive solution; credible
  superior alternatives are exhausted; practical scenarios show flexibility
  for plausible future requirements; and no remaining planned or foreseeable
  dependency is likely to require changing it.

Anything except `Final` may be reopened or overhauled at any time and cannot be
treated as mandatory project truth. Uncertainty requires `Preliminary`.
Premature `Final` is a severe finding. New binding needs or counterevidence may
reopen even `Final`.

## Completion Boundary

The program ends only when every interview-derived GM-Core need is implemented,
integrated, and practically verified through production routes; every required
in-game tutorial is present, interactive, contextually correct, and the full
tutorial starts automatically on first installation and after every update
while remaining skippable; no confirmed product defect, severe finding, or
required roadmap item remains unresolved; local `./gradlew check` and required
CI are green; the exact candidate is published and locally installed; and final
integrated owner acceptance passes. A residual confirmed deviation requires
explicit Product Owner acceptance. All five processes run until this boundary
is met.
