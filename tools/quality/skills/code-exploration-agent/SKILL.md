---
name: code-exploration-agent
description: Use as the first skill inside every SaltMarcher subagent whose primary purpose is read-only code exploration for implementation planning, refactor planning, or implementation review.
---

# Code Exploration Agent

## Purpose

Use this skill inside exploration subagents launched by the main
`code-exploration` workflow. The subagent's job is to return source-backed
understanding for one assigned slice, not to plan, implement, review, or make
architecture decisions.

This skill owns exploration-subagent behavior. The caller-owned
`code-exploration` skill owns when to launch subagents, how to combine their
findings, and whether unresolved unknowns block the plan.

## Required Workflow

When assigned a SaltMarcher code-exploration question:

1. Restate the exact assigned question and scope boundary.
2. Stay read-only. Do not edit files, stage changes, run destructive commands,
   or start implementation planning.
3. Search with `rg` or `rg --files`, then read source in execution order.
4. Trace past entrypoints into routers, handlers, binders, factories,
   callbacks, listeners, dispatch tables, state mutations, and publication
   points that belong to the assigned slice.
5. Compare sibling workflows only when they are part of the assigned question
   or needed to validate an apparent shared path.
6. Classify every material claim as `Owner-Proven`, `Evidence-Proven`,
   `Candidate`, or `Suspect`.
7. When the assigned question is an implementation review or continuation
   question, inspect relevant available pass logs under
   `build/agent-pass-logs/` and report them only as operational history.
8. Return only source-backed findings, explicit unknowns, and the next paths a
   caller should inspect if the slice remains unresolved.

Do not infer shared behavior from shared entrypoints, matching names, nearby
files, or callchain output alone. Static tool output can orient the search, but
dynamic routing, lifecycle wiring, listener registration, reflection,
ServiceLoader discovery, JavaFX wiring, generated code, and Gradle/script
dispatch must be confirmed in source or owner documents before being treated as
evidence.

## Patience Contract

Exploration is allowed to take time. Do not stop early because the first search
is noisy, because the path crosses several owners, or because the caller might
be waiting.

- If a branch is still unresolved, keep tracing until you have either evidence
  or a concrete blocker.
- If a command is still running, wait for completion or an explicit tool
  failure before reporting.
- If the assigned scope is too broad, narrow the unanswered part in the final
  unknowns instead of fabricating a conclusion.
- If evidence contradicts the initial assumption, report the contradiction
  directly and do not smooth it into a plan-friendly answer.

The final answer must distinguish "not checked", "checked but unresolved", and
"proven by source or command output".

## Report Shape

Return a compact read-only report:

- `Question`: the exact assigned slice.
- `Entrypoints`: files and symbols inspected.
- `Dispatch`: branch, routing, registration, or lifecycle points found.
- `State`: mutation, projection, publication, cache, task output, or file owner.
- `Variants`: sibling workflows compared and material differences.
- `Evidence`: path-backed facts with trust level.
- `Unknowns`: unresolved seams and why they remain unresolved.
- `Pass Logs`: relevant implementation or review pass logs inspected and any
  repeated reversal, loop, degradation, architecture friction, recurring smell,
  or governance/check miss found in them.

Do not include implementation advice unless the caller explicitly asked for it.

## References

- [Code Exploration Skill](../code-exploration/SKILL.md)
- [Agent Context Standard](../../../../docs/project/architecture/agent-context.md)
- [Context Hygiene Skill](../context-hygiene/SKILL.md)
- [Repo Tools Skill](../repo-tools/SKILL.md)
