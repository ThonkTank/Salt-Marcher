---
name: wave-coordination
description: "Use when local governance, task scope, or the user routes work through a coordinated Goal Definition -> CR -> CR Review -> Planning Bundle -> Plan Review -> Implementation -> Review -> Commit/Handoff workflow with clean-start planning, review, implementation, and audit agents, local-owner-defined artifacts, proof, fix loops, and completion audit. This is an operating skill; local governance owns trigger thresholds."
---

# Wave Coordination

## Role

Use this skill to operate coordinated goals through deliberate goal definition,
planning-bundle creation, implementation, review, and handoff. The
coordinator owns the goal, sequencing, phase delegation, proof routing, review
routing, commit readiness, and completion audit.

This skill is task- and repository-independent. It does not replace local
`AGENTS.md`, owner documents, implementation-artifact contracts, verification
policy, or mandatory skills. Read and follow those surfaces first when they
exist. Local governance owns trigger thresholds, artifact shapes, proof
requirements, finding dispositions, and any repository-specific preflight
requirements.

## Mandatory Cycle

Every coordinated implementation goal must pass through this order:

`Goal Definition -> CR -> CR Review -> Planning Bundle -> Plan Review -> Implementation -> Review -> Commit/Handoff`

Do not skip, merge, or reorder Goal Definition, CR, CR Review, Planning
Bundle, Plan Review, Implementation, Review, or Commit/Handoff. Goal Definition and CR are Main/User
responsibilities: Main clarifies the objective, constraints, non-goals, and
success boundaries, then creates the local CR when the local artifact contract
requires one. CR review and planning-bundle review use the local review route and existing
review lenses; non-trivial planning reviews use a coordinator. Planning Bundle
creation uses one clean-start planner to define must-do completion goals,
roadmap, phase decomposition when needed, and worker-ready step plans from the
accepted CR. Implementation changes only assigned phase or slice scope and
produces proof or a blocker.
Review runs after proof and must finish cleanly, or route fixes and fresh proof,
before commit. Commit and push happen only after reviewed scope, fresh proof,
and staging match.

Each delegated phase must have a dedicated owner agent with the correct skill
set for that phase. Do not let the same delegated agent plan, implement, review,
and commit a wave as an undifferentiated pass. The coordinator may sequence the
cycle and integrate results, but delegated phase work is assigned to explicit
phase agents:

- Goal Definition and CR are owned by Main with the user. Main must not hand
  vague, lossy, unreviewed, or unresolved objectives to a planner.
- Planning reviews are owned by a review coordinator for non-trivial planning
  artifacts, or by Main-launched direct lenses for trivial bounded checks.
  The caller assigns exactly one generated review artifact as that review
  coordinator's allowed write surface; Main must not write or replace it.
- Planning Bundle creation is owned by one planning agent that uses `planner`
  plus required local skills. This planner writes the roadmap, any needed
  phase plans, and the implementation-ready wave/step-plan artifacts. The
  caller assigns the bundle artifact paths as the planner's allowed write
  surface.
- Implementation is owned by one or more worker agents with disjoint write
  sets. Each worker must use `wave-implementation-worker` plus the mandatory
  local owner skills for its touched files before editing and must not review or
  commit its own slice.
- Review is owned by a separate review coordinator and risk-based specialist
  reviewers using the workspace's review coordination and lens skills. Review
  agents are independent from implementation agents.
- Commit is owned by a separate commit/audit agent, or by the top-level
  coordinator only after the review result is accepted, proof is fresh, and
  staging exactly matches the reviewed scope. The commit owner must use any
  available commit skill or local commit protocol.

All delegated planner agents, implementation workers, review coordinators,
specialist reviewers, and commit/audit agents must be started clean. Do not fork
the current conversation into subagents. Build each agent prompt from the
goal-definition record, roadmap, local wave-plan artifact, owner documents, and
explicit constraints that apply to that phase only; include each input only when
it is relevant to that role. Every launch packet must name the phase's input
authority, required output artifact path or evidence section, allowed write
surface, and blocked fallback. If a required output cannot be assigned, keep the
phase WIP/blocked instead of relying on chat-only status.

## Agent Model And Effort Routing

When subagent tooling supports model and reasoning-effort overrides, use this
routing unless the user or local policy explicitly requires a different choice:

- Planning bundle planner agent: `gpt-5.5` with `high` reasoning effort.
- Implementation workers using `wave-implementation-worker`: `gpt-5.4` with
  `medium` reasoning effort.
- Overview review coordinator: `gpt-5.4` with `medium` reasoning effort.
- Specialist review agents: `gpt-5.5` with `high` reasoning effort.
- Commit or audit agent: `gpt-5.4` with `medium` reasoning effort.

If an exact model is unavailable, choose the closest available model while
preserving the effort tier: medium for implementation and overview review, high
for planning and specialist review. Record any substitution or runtime
limitation in the roadmap or required local artifact.

If subagent tooling is unavailable or a local policy forbids delegation, record
that as a workflow constraint before proceeding and keep all phase roles
logically separate in the pass log. Do not silently collapse the cycle.

Every phase owner and worker must self-document its own result in the local
owner-defined roadmap, plan, implementation-log, or review-log artifact before
the next phase relies on that result. A worker report is not optional status
chatter; it is the durable handoff artifact for that slice. The coordinator must
not synthesize or replace missing worker reports from memory unless the worker
is unavailable, and then must mark the entry as a coordinator fallback with the
reason.

Keep the chat todo tool aligned with real roadmap progress. Update it when a
phase starts, blocks, completes, or changes scope, and do not mark items ahead
of the roadmap or required local artifact evidence.

If a goal is investigation-only or planning-only, stop before Implementation and
report that no commit phase applies. If implementation begins, the full cycle is
mandatory.

## Required Workflow

1. Main clarifies the goal with the user before delegation. Capture the durable
   objective, explicit non-goals, constraints, success boundary, and unresolved
   questions. When the local artifact contract requires a CR, create and review
   it before roadmap planning.
2. Start one planner clean from the accepted CR or goal-definition record.
   Assign the roadmap path, any required phase-plan paths, wave/step-plan
   paths, and allowed planning-bundle write surface before launch. The planner
   must use `planner` and write only that local planning bundle: roadmap, any
   phase plans needed for broad or dependency-heavy work, and
   implementation-ready wave/step-plan artifacts. The roadmap must define
   must-do completion goals, affected surfaces, required owner documents, proof
   and review route, likely blockers, and what must change where for completion.
3. Main runs the local planning-bundle review before implementation begins. If
   the bundle dropped, reinterpreted, or softened the accepted CR or user
   instructions, Main fixes the CR/goal definition or reruns planning instead
   of treating the bundle as authority.
4. Large phases may be subdivided inside the bundle; do not push underspecified
   phase goals to workers.
5. Keep implementation workers isolated from overall goals and unrelated phase
   context. Do not pass the full roadmap, full coordinator goal, planner
   rationale, prior phase history, or previous phase logs to an implementation
   worker by default.
6. Keep implementation write sets disjoint; serialize the few files that cannot
   be safely parallelized.
7. Give every worker a decision-complete local wave-plan artifact governed by
   the local artifact contract, the assigned implementation-log path, and the
   worker's allowed production and generated-artifact write surfaces. For
   triggered local preflight requirements, include only slice-relevant evidence
   and locally allowed dispositions.
8. Maintain the roadmap as the status/index artifact. Planning,
   implementation, review, fix, commit, and audit entries must use the artifact
   split required by local owner documentation when one exists, and must link
   back to the roadmap. If no local artifact contract exists, report the
   ambiguity as a planning blocker before implementation proceeds.
9. Each worker result must satisfy the local artifact contract for the relevant
    implementation or review log. If no local contract exists, treat the missing
    contract as a planning blocker before relying on the result.
10. After implementation, run the required top-level proof for the changed
    surface or record the exact blocker. Keep proof and dirty-worktree hygiene
    separate in status reports.
11. Run the required handoff review after proof exists.
12. Route findings through a fix loop. Must-fix findings block handoff. Low-risk
    should-fix findings should be fixed in the same pass or disposed according
    to local policy.
13. Commit and push only after proof is fresh, review is clean or every
    non-clean finding is disposed according to local policy, and staged files
    match the reviewed scope.
14. Run the final read-only completion audit required by the local artifact
    contract before marking the goal complete. If no local completion-audit
    contract exists for a broad goal, report that ambiguity before claiming
    completion.

## Coordinator Pacing

After launching workers or reviewers, the coordinator's default action is to
wait for their results. Do not fill wait time with duplicate local reading, extra
planning waves, harness runs, fresh planning agents, or repeated status checks
unless a concrete blocker or new user instruction makes that work necessary.

Use one planner for roadmap, phase decomposition, and implementation-ready step
plans. Do not launch extra planners for general confidence; rerun planning only
when review or evidence exposes a specific unanswered blocker.

While implementation workers are running:

- wait for worker completion instead of re-reading the same scope locally
- do not run proof or harnesses until the worker outputs are integrated or the
  worker explicitly asks for a shared proof run
- do not launch a planning or review agent to reassess interim state
- do not start new workers unless an existing worker reports a blocker that
  requires a separate disjoint slice
- limit coordinator updates to meaningful transitions, blockers, or terminal
  results

If there is genuinely useful non-overlapping work, do it only when it is already
part of the approved planning bundle and will not consume context needed to integrate
worker results. Otherwise preserve context and wait.

## Worker And Review Acceptance

- Do not launch vague workers. Each worker must own a bounded slice with an
  explicit write set or a read-only question.
- Do not start parallel workers that may edit the same file or owner surface.
- Do not proceed to a dependent phase from assumed worker success. Inspect
  worker results first.
- Do not treat a worker result as complete until its required local artifact
  entry is present and matches the worker's final message, changed paths, and
  proof.
- Close completed subagent threads immediately after their result has been
  captured.
- If a worker changes reviewed or tested behavior after review, rerun the
  required proof and launch a fresh review for the new diff.
- If guidance, checks, or docs block a cleaner structure, route that as an
  explicit governance/check phase instead of widening the current worker brief.
- If local preflight was triggered, do not proceed from Planning Bundle to
  Implementation until every non-clean item has a locally allowed disposition.

## Handoff Output

For each completed phase, report:

- phase goal and slices completed
- roadmap location and linked plan/log/review artifacts
- worker outcomes and changed paths
- proof commands with literal results
- review outcome and fix-loop status
- commit hash and push result when committed
- residual separate phases or slices

For final goal completion, report the completion audit facts, not just the last
implementation summary.
