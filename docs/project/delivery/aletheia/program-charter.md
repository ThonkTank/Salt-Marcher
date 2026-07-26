Status: Active
Owner: SaltMarcher Product Owner
Last Reviewed: 2026-07-26
Charter Version: C-0.6.0
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
  canonical roadmap and is the only process that changes production code. A
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

Only A works in the canonical `projects/SaltMarcher` checkout. B1, B2, B3, C,
and every evaluator use separate Git worktrees rooted at the exact latest
stable product-slice commit. A stable product slice is an exact A-owned commit
whose required local check and CI are green and whose checkpoint is complete.
Non-A processes never edit A's working tree or use uncommitted A state as
evidence.

Non-A role work may return only as handoff-ready tests or precise instructions for
A, including evaluated roadmap and process instructions. Experimental product,
structure, governance, or tooling implementations remain in their origin
worktree; A independently implements every accepted productive change. A alone
integrates product-tree changes. After every merge into A's branch or `main`,
all non-A processes fetch and synchronize or recreate their worktrees at the
exact newest stable product-slice commit before further work. If the new base
invalidates a premise, oracle, or workload, the candidate restarts.

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
