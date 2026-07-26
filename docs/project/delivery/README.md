Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-26
Source of Truth: Routing to active temporary project delivery owners.

# Active Project Delivery

This directory routes active delivery work. It does not own product behavior,
architecture, contracts, proof history, or feature status beyond these links.

## Active Programs

The GM-Core program uses five independent Aletheia role processes plus one
shared evaluation contract. Their current, temporary owners are:

- [Program umbrella issue](https://github.com/ThonkTank/Salt-Marcher/issues/555)
- [Product Completion Roadmap](gm-core-roadmap.md) -- revisable Product-A
  sequencing and completion guidance for the whole interview-derived GM core.
- [Program Charter](aletheia/program-charter.md)
- [A — Product Process](aletheia/product-process.md)
- [B1 — Behavior Assurance](aletheia/behavior-assurance.md)
- [B2 — UX Assurance](aletheia/ux-assurance.md)
- [B3 — Structural Assurance](aletheia/structure-assurance.md)
- [C — Process Optimization](aletheia/process-optimization.md)
- [Process Evaluation](aletheia/process-evaluation.md)

Each role runs through its own coordinator in its own persistent conversation;
there is no global coordinator. Each role coordinator launches independent
concept, test, and evaluation subagents. Committed owner documents and exact
artifact links carry every cross-role handoff.

Only A works in the canonical `projects/SaltMarcher` checkout and changes
shipped application code, resources, or product contracts. B1, B2, B3, C, and
their evaluators use separate worktrees. Their coordinators may merge evaluated
green tests, non-production tools, and instructions through scoped PRs. The A
process performs every productive implementation and integration. After each
merge, every non-A worktree synchronizes to the exact latest stable product
baseline.

Each delivery owner is temporary and is removed after its own finish criteria
are met. Durable decisions remain in the linked product owner documents.
