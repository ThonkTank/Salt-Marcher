---
name: architecture-planning
description: Runs a bounded generate-verify-revise loop for explicitly requested SaltMarcher greenfield target architecture or architecture-significant refactor planning. Use when the user requests a decision-complete architecture design with independent error search and revision or replanning. Do not use for ordinary implementation sequencing, implementation or migration execution, or review-only work.
---

# Architecture Planning

Produce an architecture candidate, not an implementation. Separate generation,
error search, and revision so that a candidate never verifies or repairs itself.

## Non-Negotiable Rules

- Main owns the input packet, neutral role briefs, finding aggregation, candidate
  count, and final verdict. Do not add a coordinator or finding-classifier role.
- Give every Planner, Verifier, and Reviser a fresh context containing only the
  applicable contract, neutral task, and contractually allowed inputs. Do not
  pass conversation history, prior reasoning, or intended fixes. Reviewers
  remain read-only and launch no agents.
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
system. Treat the active solution-neutral needs as authority. Upstream
requirements, vision, policy, and preserved evidence are readback sources only.
Do not inspect current code, tests, architecture, technologies, delivery state,
or migration constraints during generation, verification, or revision.

Use `Evolution` for an architecture-significant refactor of an existing system.
Read the active needs and requirements plus current architecture owners,
contracts, production routes, state and persistence paths, tests, enforcement,
and compatibility constraints. Current structure is evidence, not automatic
target truth.

If the mode is unclear after inspecting the request and owner documents, ask
before generating a candidate.

## Run The Loop

1. Freeze the input packet and an immutable version of every included input.
   Complete the Main gate in the Stage Contracts before generating. Restart at
   `v1` if a binding input changes.
2. Ask a fresh Planner to generate `v1` using the Planner contract.
3. Run the three independent specialist passes. They may run in parallel.
4. Run the clean-start audit afterward without showing it specialist findings.
5. Aggregate duplicate findings directly in Main and give the candidate plus
   normalized ledger to a fresh Reviser.
6. Apply a local revision only when the selected decision and its rationale
   remain valid. Return to a fresh Planner when a core assumption, alternative,
   tradeoff, or downstream decision is invalidated.
7. Re-run every specialist pass and the clean-start audit for each new version.
   Do not verify only the edited section.

Verifier approval establishes a reviewed architecture candidate only. It does
not activate a repository document, authorize implementation, or replace the
normal branch, proof, pull-request, and owner rules.

## Evidence

Use `source-references` before relying on external evidence. The methodological
inspiration is the Generator-Verifier-Reviser loop in:

- `/home/aaron/Schreibtisch/projects/references/agent-methods/aletheia-towards-autonomous-mathematics-research.md`
- <https://arxiv.org/abs/2602.10177>

Adopt the separation and bounded retry, not an assumption that natural-language
verification guarantees correctness. Preserve the explicit failure outcome.
