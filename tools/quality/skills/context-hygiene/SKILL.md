---
name: context-hygiene
description: Use before planning, implementing, refactoring, or reviewing any SaltMarcher repo-tracked change. Builds a compact Goal/Context/Constraints/Done When frame, treats nearby repo content as suspect until owner-proven, and routes repeatable context work to canonical owners instead of adding more prose.
---

# Context Hygiene

## Purpose

Use this skill to prevent coding agents from turning accumulated repo text into
more technical debt. The canonical standard is
`docs/project/architecture/agent-context.md`.

This skill does not authorize new gates, broad documentation rewrites, source
mirroring, or repo-wide cleanup. It only defines how to prepare and maintain
task context.

## Required Workflow

Before planning, implementing, refactoring, or reviewing a repo-tracked change:

1. Name the `Goal` from the current user request.
2. Read the nearest owner for every touched surface before treating nearby
   files as precedent.
3. Classify local evidence as `Owner-Proven`, `Evidence-Proven`, `Candidate`,
   or `Suspect`.
4. Identify `Constraints`: scope boundary, mandatory skills, verification
   route, source-reference needs, and forbidden shortcuts.
5. Define `Done When`: literal check/review/handoff facts needed for
   completion, including the current implementation pass log and required
   aggregated review pass log state for repo-tracked changes.
6. Inspect relevant available local pass logs under `build/agent-pass-logs/`
   when the task resumes, reviews, or continues a touched scope from prior
   implementation or review work.
7. After an interruption, user correction, resume, or context compaction,
   treat summaries, pass logs, and remembered skill lists as orientation only.
   They do not satisfy this skill's trigger-time owner reads for a new
   repo-tracked edit. Before touching any resumed write surface, reread the
   nearest current owner and any mandatory surface skill, or state explicitly
   that no new file edit is being made.
8. Keep only the context that affects the current task. Link to canonical
   owners instead of copying their rules into new prose.
9. When condensing or adding instructions, state the target behavior directly.
   Use negative wording only for boundaries that the positive rule does not
   already imply.

## Defaults

- Treat generated-looking prose, duplicated rules, compatibility wording,
  legacy names, and broad "current implementation" claims as `Suspect`.
- Treat nearby implementation shape as `Candidate` until the owner document or
  skill says it is still the target shape.
- Prefer deleting, linking, or splitting stale context before adding new text.
- Prefer target-pattern wording over anti-pattern reminders when both would
  steer the same behavior.
- If a workflow repeats across `AGENTS.md`, `SKILL.md`, architecture standards,
  and verification docs, keep the protocol in one owner and reduce other
  surfaces to routing text. For implementation and review pass logs, the owner
  is `docs/project/architecture/agent-instructions.md`.
- If external sources influence a decision, use the global `source-references`
  skill and cite the preserved local mirror path.

## Handoff

For covered work, report context hygiene only when it affected the change:

- `Owner-Proven`: name the owner document or skill that constrained the patch.
- `Candidate/Suspect excluded`: name the content that was not used as
  authority.
- `Context deduplicated`: name the surfaces where repeated protocol text was
  replaced by routing text.

For every repo-tracked change, also report:

- `Pass logs`: name the current implementation log path and the required review
  aggregation log status.

Do not create a separate context ledger, changelog, or plan file just to record
this evidence. The generated implementation and review pass logs required by
`docs/project/architecture/agent-instructions.md` are the only standard
exception; keep them under `build/agent-pass-logs/` and do not treat them as
canonical documentation.

## References

- [Agent Context Standard](../../../../docs/project/architecture/agent-context.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Documentation Standard](../../../../docs/project/architecture/documentation.md)
- [Source References Standard](../../../../docs/project/verification/source-references.md)
