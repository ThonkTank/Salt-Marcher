Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: SaltMarcher agent workflow tiers, role boundaries, review,
and instruction-surface change rules.

# Agent Instruction Standard

## Tier Model

Every tracked change is classified before editing.

**S - Small**

Use S when the write set is limited to Markdown docs or a single-file fix with
exactly one obvious correction and no architecture, API, state, or shape
decision. Run the matching verification command. Independent review is optional.

**M - Medium**

Use M for normal implementation work that is not S or L. State a 5-15 line plan
in the PR: goal, write set, proof command, and risks. Implement, run proof, get
one independent review, and merge only after green CI.

**L - Large**

Use L when the change touches two or more layers' public surfaces, dependency
versions, build or verification wiring, enforcement packages, or agent
instruction surfaces. Before implementation, append a one-page design note to
`docs/project/journal/YYYY-MM.md` covering problem, target state, alternatives
considered, scope boundary, and done-when facts. Add an ADR before implementation
when the Documentation Standard requires one for the change class. The journal
remains the short design or incident record. The user may waive either artifact.

## Roles

- **Implementer** writes the change and its proof.
- **Verification Runner** runs assigned proof commands on the final checkout
  and records literal results. The implementer must not substitute this role
  when final independent proof was requested.
- **Reviewer** reviews the final diff independently and writes the verdict in
  the PR review.

## Review

Always apply `lens-code-quality`. Add `lens-security` when the diff touches IO,
persistence, parsing, external input, or shell/exec. Add `lens-performance`
when it touches hot collection loops, caching, rendering, startup, or memory
pressure. Add `lens-architecture` when it touches layer boundaries, owner
surfaces, public APIs, dependency direction, or build/check topology.

Verdicts are:

- `Approve`
- `Rework`
- `Blocked`
- `Proof Refresh Required`

Return `Proof Refresh Required` whenever any tracked file changed after the
last relevant proof run.

## Stable-State Barrier

While an implementation, fix, proof, or review role may still change or review
the target write set, do not launch proof, review, desktop install, or other
expensive side work against that same checkout. After any wait, interruption,
resume, or user correction, refresh the user instruction, worktree dirty paths,
and ownership boundary before continuing. Summaries are orientation only; read
current owners before new tracked edits.

## Blockers

A blocked pass stays WIP with the blocker named in the PR. Direct review fixes
are allowed only for S-tier findings. Everything else goes back to the
implementer with the review findings; no separate planner or repair-plan
review chain is required.

## Parallel Work

Parallel agents may share the repo-root checkout only when the caller assigns
disjoint write sets and serializes edits to files that more than one agent
might touch. Do not create linked worktrees or temporary isolation branches
unless the user explicitly asks.

## Instruction-Surface Changes

Edits to `AGENTS.md`, any `SKILL.md`, `agents/openai.yaml`, or this document
are tier L and use `agent-instruction-engineering`. Such changes must not raise
total instruction volume: state in the PR which instruction lines were removed
to pay for lines added, or show that the net line count is unchanged or lower.

## References

- [Agent Guide](../../../AGENTS.md)
- [Documentation Standard](../documentation.md)
- [Quality Platforms](../verification/quality-platforms.md)
