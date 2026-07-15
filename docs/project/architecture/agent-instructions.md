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

Use one independent final review when the blast radius justifies it. The same
reviewer may cover correctness, architecture, security, performance, and code
quality. Do not require review panels, separate review documents, or a
planner-reviewer-implementer chain.

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
