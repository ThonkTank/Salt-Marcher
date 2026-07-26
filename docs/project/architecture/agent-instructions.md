Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-23
Source of Truth: Minimal SaltMarcher agent execution and review rules.

# Agent Instruction Standard

## Direct Execution

Start implementation when the requested outcome and acceptance criteria are
clear. Planning, design notes, role chains, model assignments, writer
allocations, and phase artifacts are optional tools, never prerequisites.
Use them only when they remove a concrete implementation risk or the user asks
for them.

Use the opt-in `architecture-planning` skill only when the user explicitly asks
for adversarial error search and a revision-or-replanning loop for either a
Greenfield target architecture or an architecture-significant refactor design.
That skill produces a reviewed design, not implementation or migration
sequencing. Use Codex Plan Mode or a concise direct plan for ordinary
implementation sequencing after architecture decisions are settled.

For work spanning context compactions, one short delivery file may record the
current tree, completed work, proof, and next action. It must not become a
second workflow or require per-role artifacts.

## Proof And Review

Run focused diagnostics while implementing and `./gradlew check` once the
candidate is ready. Refresh only proof affected by later edits.

Outside an explicitly chartered Aletheia role process, use an independent final
review when the blast radius justifies it. Every standard review or handoff-
validation agent first applies the global
`lens-adversarial-review-agent`; Main owns
review scope, lens selection, neutral briefs, proof freshness, finding
aggregation, and the final verdict. For multi-lens review, Main launches the
specialist reviewers directly and in parallel where practical. Reviewers start
without conversation history, inspect evidence independently, remain
read-only, and do not launch subagents. Do not insert into a standard review a coordinator,
Overview agent, finding-classifier, separate review document, or
planner-reviewer-implementer chain. One reviewer remains sufficient when one
lens covers the material risk.

The GM-Core Aletheia B1, B2, and B3 role processes are experimental assurance,
not standard review or handoff-validation agents. Under the [Program
Charter](../delivery/aletheia/program-charter.md), their role coordinators must
launch separate concept, practical-test, and evaluation subagents. They may
implement isolated tests, probes, instrumentation, and measurements while
remaining outside product repair. Standard review agents remain read-only and
do not inherit this exception.

During a staged migration, a finding on structure, naming, or style already
owned by a later slice does not block the current slice unless the current
change worsens it, creates behavior, data, or security risk, invalidates proof,
or makes the current slice claim false. Do not polish a surface scheduled for
replacement merely to satisfy an intermediate review.

## Parallel Work

Delegate only concrete, independent tasks with disjoint write sets. Stop or
redirect delegated work immediately when the user changes direction. Shared
files have one writer at a time.

For the active GM-Core program, Aletheia A, B1, B2, B3, and C each run through
their own role coordinator in a separate persistent conversation. There is no
global coordinator. Every role coordinator launches separate concept, test,
and fresh evaluation subagents; it does not perform all phases itself. Their
canonical [Charter](../delivery/aletheia/program-charter.md#role-coordinators-conversations-and-worktrees)
defines agent families, artifact-complete handoffs, and exclusive writers. Only
the A process works directly in the canonical `projects/SaltMarcher` checkout
or changes shipped application code, resources, or product contracts. B1, B2,
B3, C, and their evaluators use separate Git worktrees. Their coordinators may
merge evaluated, green tests, non-production tools, and instructions through a
scoped PR, but never productive code. After every merge, each non-A worktree
synchronizes to the exact latest stable product baseline and restarts any
affected frozen candidate under the Charter.

Aletheia phase agents may and should research professional methods, standards,
and maintained tools online when they can improve a consequential decision.
Purely theoretical reasoning is insufficient. Follow [Source
References](../verification/source-references.md) for external evidence and the
[Resource Policy](../policies/resource-policy.md) for downloads, services,
secrets, costs, and data egress. Calibrate sourced and custom tools before using
their output as evidence.

## Instruction Surfaces

Keep `AGENTS.md`, global skills, repo-specific skills, and this standard
concise and non-duplicative. Instructions must name their trigger and required
behavior. Delete obsolete rules instead of layering exceptions over them.

## References

- [Agent Guide](../../../AGENTS.md)
- [Documentation Standard](../documentation.md)
- [Quality Platforms](../verification/quality-platforms.md)
- [Aletheia Program Charter](../delivery/aletheia/program-charter.md)
