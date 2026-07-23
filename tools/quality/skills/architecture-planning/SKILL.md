---
name: architecture-planning
description: Use only when the user explicitly asks for adversarial error search and a revision-or-replanning loop for either a Greenfield target architecture or an architecture-significant refactor design. Produces a bounded Planner-Verifier-Reviser result, not implementation sequencing, migration execution, or review-only work.
---

# Architecture Planning

Produce an architecture candidate, not an implementation. Separate generation,
error search, and revision so that a candidate never verifies or repairs itself.

## Non-Negotiable Rules

- Main owns the input packet, neutral role briefs, finding aggregation,
  candidate count, and final verdict. Do not add a coordinator or
  finding-classifier role.
- Every Verifier first applies the global `lens-adversarial-review-agent`, then
  only its assigned Architecture Planning Error Search section.
- Give every Planner, Verifier, and Reviser a fresh context containing only the
  applicable contract, neutral task, and contractually allowed inputs. Do not
  pass conversation history, prior reasoning, or intended fixes. Reviewers
  remain read-only and launch no agents.
- Treat fresh contexts as context isolation, not independent correctness
  evidence. Model agreement alone cannot close a blocker or major finding,
  justify a hard-to-reverse decision, or establish a non-risk.
- Review at most three candidate versions, `v1` through `v3`. If `v3` is
  rejected, report that no acceptable architecture was found and stop.
- Never call a candidate accepted while a blocker or major finding remains.
  Dispose every minor by repair or by recording an explicit risk, trigger, and
  verification owner in the candidate.
- Keep candidate drafts and finding ledgers temporary. Persist only the final
  owner document and genuinely necessary narrow decisions when the user asks
  for durable documentation.
- Stop on product ambiguity and route it to the requirements owner. Do not turn
  an architectural preference into product behavior.

Read [stage-contracts.md](references/stage-contracts.md) and
[error-search.md](references/error-search.md) completely before starting.

## Select The Mode

Use `Greenfield` when the request asks for a target independent of the current
system. Treat the active solution-neutral needs plus the complete transitive set
of requirements, vision, policy, and constraints that the needs owner explicitly
declares binding as authority. Preserve that owner's binding-versus-readback
classification. Do not inspect current code, tests, architecture, technologies,
delivery state, or migration constraints during generation, verification, or
revision.

Use `Evolution` for an architecture-significant refactor of an existing system.
Read the active needs and requirements, explicitly opened architecture
decisions, unaffected binding owner decisions, contracts, production routes,
state and persistence paths, tests, enforcement, and compatibility constraints.
Only decisions named in the accepted refactor scope may be replaced. Current
implementation structure is evidence, not automatic target truth.

If the mode is unclear, Main may inspect the request plus document status,
ownership, and routing metadata, but not content forbidden by Greenfield mode.
Ask before generating a candidate. If current-system content was already seen,
exclude it from the frozen packet and give every stage a fresh context.

## Run The Loop

1. Freeze the input packet and an immutable version of every included input.
   Complete the Main gate in the Stage Contracts before generating. If a packet
   change later affects decision selection or verification, use a fresh Planner
   at the next remaining run-wide candidate version; never reset the counter.
2. Ask a fresh Planner to generate `v1` using the Planner contract.
3. Run the three context-isolated specialist passes. They may run in parallel.
4. Run the clean-start audit afterward without showing it specialist findings.
5. Aggregate duplicate findings directly in Main, then give the candidate plus
   normalized ledger to a fresh Reviser. The Reviser incorporates or updates
   semantic risk themes inside the next candidate before its full audit.
6. Apply a local revision only when the selected decision and its rationale
   remain valid. Return to a fresh Planner when a core assumption, alternative,
   tradeoff, or downstream decision is invalidated.
7. Re-run every specialist pass and the clean-start audit for each new version.
   Do not verify only the edited section.

Verifier approval establishes a reviewed architecture candidate only. It does
not activate a repository document, authorize implementation, or replace the
normal branch, proof, pull-request, and owner rules.

## Method Evidence

Use the global `source-references` skill before relying on external evidence.
Resolve these logical mirror keys through that skill rather than hard-coding a
machine-specific mirror root:

- `agent-methods/aletheia-towards-autonomous-mathematics-research.md`
- `agent-methods/large-language-models-cannot-self-correct-reasoning-yet.md`
- `architecture-specification/sei-atam-collection.md`

Public sources: <https://arxiv.org/abs/2602.10177>,
<https://arxiv.org/abs/2310.01798>, and
<https://www.sei.cmu.edu/library/architecture-tradeoff-analysis-method-collection/>.
Adopt bounded staged refinement, external verification anchors, and explicit
tradeoff analysis; do not assume natural-language review guarantees correctness.
