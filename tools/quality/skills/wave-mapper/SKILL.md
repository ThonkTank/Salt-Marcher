---
name: wave-mapper
description: "Use as the Mapping phase in Wave Coordination to turn a coordinated-workflow objective into the local-contract roadmap before per-wave planning and implementation."
---

# Wave Mapper

## Role

Use this skill as the Mapping phase for a coordinated goal. The mapper
converts a high-level objective into the local-contract roadmap artifact used by
the Wave Coordinator and Planner agents.

## Required Workflow

1. Receive the Wave Coordinator brief, including goal, constraints,
   non-goals, current blockers, and required proof/review obligations.
2. Identify only the minimum canonical scope needed to brief explorers. When
   local context-hygiene or code-exploration skills exist, use them before
   relying on nearby files or precedent.
3. Launch Explorer subagents in parallel to inspect likely hot-spots.
   - Use one explorer per independent area.
   - Start Explorer subagents clean; do not fork the current conversation.
   - Use `gpt-5.4-mini` with `low` reasoning effort for Explorer subagents when
     the runtime supports those overrides.
   - Keep explorer prompts read-only and narrow (path and question scoped).
   - Require explorers to use local exploration/context-hygiene skills when
     available.
   - Require explorers to separate owner-proven evidence from candidate,
     inferred, or suspect evidence.
   - When the goal touches code covered by a local preflight trigger, assign
     at least one narrowly scoped Explorer to gather the required evidence
     before roadmap completion.
4. Consolidate findings into the roadmap required by the local artifact
   contract.
5. Populate the roadmap according to that contract with mapping evidence, wave
   boundaries, blocker dispositions, and explorer evidence. Mapping is
   incomplete when triggered local preflight evidence or non-clean
   dispositions required by the local contract are missing.
6. Do not generate implementation tasks in mapping.
7. Return the exact roadmap path to the Wave Coordinator as the required output.

## Output Contract

Return the roadmap path and confirm that the roadmap follows the local artifact
contract. If no local roadmap contract exists, report that as a planning blocker
instead of inventing roadmap fields in this skill.

## Explorer Output Contract

Each Explorer result must stay bounded to the assigned question and include:

- inspected files, directories, owner documents, or commands
- exact owner-proven evidence with file references where available
- candidate, inferred, or suspect evidence clearly separated from owner-proven
  evidence
- relevant areas intentionally not inspected
- blockers or ambiguity that the planner must not treat as settled
- local preflight evidence and dispositions when the assigned question touches
  code covered by a local preflight trigger

Explorer results must not include broad repo summaries, unrelated nearby
precedent, or implementation instructions.

## Scope Isolation Rule

Mark roadmap content as coordinator/planner context. Do not write roadmap
content as implementation-agent prompts; planners derive worker artifacts only
through the local wave-plan contract.
