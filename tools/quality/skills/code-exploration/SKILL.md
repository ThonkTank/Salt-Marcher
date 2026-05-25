---
name: code-exploration
description: Use before implementation planning, refactor planning, or implementation review for SaltMarcher changes where existing code behavior, call routing, workflow variants, build or check logic, or repo-local tool behavior affects the decision.
---

# Code Exploration

## Purpose

Use this skill to understand existing SaltMarcher code before planning a change
that depends on current behavior. Shared entrypoints, matching names, and nearby
files are not proof that workflows behave the same internally.

This skill owns code-understanding procedure. It does not replace
`context-hygiene`, `repo-tools`, layer skills, architecture standards,
verification rules, or review skills.

## Required Workflow

Before implementation planning, refactor planning, or implementation review for
covered work:

1. Name the behavior, workflow, check, tool, or routing path the task depends on.
2. Use `context-hygiene` to identify the canonical owners and trust level for
   nearby evidence.
3. Use `repo-tools` as the current catalog before relying on repo-local tooling.
4. Search for the named behavior, workflow, symbol, task, or path with `rg` or
   `rg --files`, then read source in execution order.
5. Trace past public entrypoints into routers, handlers, binders, factories,
   callbacks, listeners, dispatch tables, state mutations, and publication
   points.
6. Compare sibling workflows before assuming a shared entrypoint means shared
   behavior.
7. Classify claims with the canonical context trust levels:
   `Owner-Proven`, `Evidence-Proven`, `Candidate`, or `Suspect`.
8. Plan only from `Owner-Proven` or source/command-backed `Evidence-Proven`
   facts. Treat `Candidate` and `Suspect` claims as risks, follow-up questions,
   or scope boundaries.

If the task depends on an unverified dynamic seam, stop and report it instead
of planning as if it were understood. Common dynamic seams include JavaFX event
wiring, listener registration, reflection, ServiceLoader discovery, generated
code, shell/bootstrap registration, Gradle lifecycle wiring, and scripts that
dispatch to package-specific behavior.

## Exploration Shape

Keep the exploration compact but source-backed:

- `Entrypoint`: public method, command, task, script, listener, or UI callback.
- `Dispatch`: internal routing and branch points that choose workflow variants.
- `State`: owner of mutation, projection, publication, cache, or file output.
- `Variants`: sibling workflows checked and how they differ.
- `Tools`: repo-local tools used, their governing skill, and evidence strength.
- `Unknowns`: seams not proven deeply enough for the requested plan; unknowns
  are notes, not authority.

Do not create a separate exploration document unless the user asks for one. Use
this shape mentally, in a plan, or in handoff when it materially affects the
work.

## Tools

Prefer normal source-reading tools first:

- `rg` / `rg --files` for search and file discovery.
- Targeted file reads for execution order and ownership context.
- `git status --short --branch` before repo-tracked edits.
- Focused Gradle help or dry inspection commands when build behavior is the
  subject and the command does not rewrite tracked files.

Use repo-local tools only through their governing skill:

- Read `tools/quality/skills/repo-tools/SKILL.md` for the current catalog.
- For Java method callchains, read
  `tools/quality/skills/callchain-tool/SKILL.md` before setup, indexing,
  rendering, interpreting, or citing output.
- Treat callchain output as `Candidate` static-analysis evidence. Confirm
  routing, lifecycle, dynamic dispatch, listener, reflection, JavaFX, and
  ServiceLoader conclusions in source or owner documents.
- Use `python3 tools/quality/reporting/agent_context_map.py --surface <path>`
  to orient owners, mandatory skills, and verification surfaces when the
  touched path is unclear. This output is `Candidate` orientation from the
  `repo-tools` catalog; confirm decisions against the listed owners.

Batch file reads and searches when the needed files are knowable up front. Make
sequential reads only when the previous result reveals the next necessary path.
Stop when the entrypoint, dispatch path, state owner, relevant variants, and
unknowns are evidenced enough for the current decision.

## Exploration Subagents

Use exploration subagents only for broad, separable, read-only questions that
would flood the main context or can run independently. Give each subagent one
narrow question and require paths, symbols, evidence strength, and unknowns.

Every exploration subagent must use
`tools/quality/skills/code-exploration-agent/SKILL.md` before reading or
reporting. The caller must wait for source-backed findings before planning from
that subagent's assigned slice.

## Handoff

Report code exploration only when it affected the work:

- `Code exploration`: entrypoint, dispatch path, variants checked, and state
  owner.
- `Repo tool used`: tool, governing skill, selector or scope, and evidence
  strength.
- `Unknown deferred`: unresolved seam and why it does not block the current
  scope.

Do not claim a workflow is shared, dead, safe, or isolated unless the explored
path proves that claim.

## References

- [Agent Context Standard](../../../../docs/project/architecture/agent-context.md)
- [Context Hygiene Skill](../context-hygiene/SKILL.md)
- [Repo Tools Skill](../repo-tools/SKILL.md)
- [Callchain Tool Skill](../callchain-tool/SKILL.md)
- [Code Exploration Agent Skill](../code-exploration-agent/SKILL.md)
