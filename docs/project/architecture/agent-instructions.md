Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Minimal SaltMarcher agent execution and review rules.

# Agent Instruction Standard

## Direct Execution

Start implementation when the requested outcome and acceptance criteria are
clear. Planning, design notes, role chains, model assignments, writer
allocations, and phase artifacts are optional tools, never prerequisites.
Use them only when they remove a concrete implementation risk or the user asks
for them.

For work spanning context compactions, one short delivery file may record the
current tree, completed work, proof, and next action. It must not become a
second workflow or require per-role artifacts.

## Proof And Review

Run focused diagnostics while implementing and `./gradlew check` once the
candidate is ready. Refresh only proof affected by later edits.

Use an independent final review when the blast radius justifies it. Main owns
review scope, lens selection, neutral briefs, proof freshness, finding
aggregation, and the final verdict. For multi-lens review, Main launches the
specialist reviewers directly and in parallel where practical. Reviewers start
without conversation history, inspect evidence independently, remain
read-only, and do not launch subagents. Do not insert a review coordinator,
Overview agent, finding-classifier, separate review document, or
planner-reviewer-implementer chain. One reviewer remains sufficient when one
lens covers the material risk.

During a staged migration, a finding on structure, naming, or style already
owned by a later slice does not block the current slice unless the current
change worsens it, creates behavior, data, or security risk, invalidates proof,
or makes the current slice claim false. Do not polish a surface scheduled for
replacement merely to satisfy an intermediate review.

## Parallel Work

Delegate only concrete, independent tasks with disjoint write sets. Stop or
redirect delegated work immediately when the user changes direction. Shared
files have one writer at a time.

## Instruction Surfaces

Keep `AGENTS.md`, skills, and this standard concise and non-duplicative.
Instructions must name their trigger and required behavior. Delete obsolete
rules instead of layering exceptions over them.

## References

- [Agent Guide](../../../AGENTS.md)
- [Documentation Standard](../documentation.md)
- [Quality Platforms](../verification/quality-platforms.md)
