---
name: repo-tools
description: Use before planning, implementing, refactoring, or reviewing any SaltMarcher repo-tracked change so agents know which repo-local developer tools exist and which tool-specific skill must be read before using or relying on them.
---

# Repo Tools

## Purpose

Use this skill as the mandatory orientation catalog for SaltMarcher repo-local
developer tools. It tells agents which tools exist, what each tool can help
with, and which tool-specific skill owns detailed operation.

This skill does not contain detailed tool procedure, command walkthroughs,
output templates, or interpretation rules. Tool-specific skills own those.

## Required Workflow

Before planning, implementing, refactoring, or reviewing a SaltMarcher
repo-tracked change:

1. Read this catalog.
2. Decide whether a repo-local tool is useful for the current task.
3. Before running or relying on a tool, read the governing tool-specific skill.
4. Treat tool output with the evidence strength declared by that tool-specific
   skill.
5. Do not add new repo-local tools, gates, generated artifacts, or tool
   documentation paths unless the user explicitly asks for that scope.
6. Treat Implementation Reading Packets and pass-log artifact fields as
   documentation governed by
   `docs/project/architecture/implementation-documentation.md`, not as
   repo-tool catalog content.

## Tool Catalog

### Java Method Callchains

- Tool path: `tools/callchain/`
- Helps with: method-level Java caller/callee context for selected methods,
  pre-refactor orientation, review support, and blast-radius inspection.
- Governing skill:
  `tools/quality/skills/callchain-tool/SKILL.md`
- Read the governing skill before setup, indexing, rendering, interpreting, or
  citing callchain output.

### Agent Context Map

- Tool path: `tools/quality/reporting/agent_context_map.py`
- Helps with: orientation for a repo path's surface class, mandatory skills,
  canonical owner candidates, feature docs, verification guidance, and local
  continuous-refactoring candidates.
- Governing skill: this `repo-tools` skill.
- Evidence strength: `Candidate` orientation only. The output is not a
  canonical owner, verification gate, or substitute for reading the listed
  owners.
- Typical use:
  `python3 tools/quality/reporting/agent_context_map.py --surface <path>`

### Project Health Scan

- Tool path: `tools/quality/reporting/project_health_scan.py`
- Helps with: `PROJECT_HEALTH_DEBT` marker/register synchronization and
  repeated project-health family discovery in pass logs. With `--intake`, it
  also detects active registered debt that intersects planned paths, owner
  areas, or the current worktree and must be resolved before handoff.
- Governing skill:
  `tools/quality/skills/project-health/SKILL.md`
- Evidence strength: `Evidence-Proven` for literal marker/register sync in the
  scanned files and registered debt intake matches; `Candidate` trend evidence
  for pass-log term families.
- Typical use:
  `python3 tools/quality/reporting/project_health_scan.py --scope <path>`
  `python3 tools/quality/reporting/project_health_scan.py --intake --planned-path <path>`
  `python3 tools/quality/reporting/project_health_scan.py --intake --worktree`

## Handoff

Report repo-tool usage only when it affected the work:

- `Repo tools not used`: no repo-local tool was needed.
- `Repo tool used`: name the tool, governing skill, and evidence strength.
- `Repo tool deferred`: name the tool and why it was not appropriate for this
  pass.

Do not create a separate tool ledger, retained report, or documentation page
only to record this evidence.

## References

- [Callchain Tool Skill](../callchain-tool/SKILL.md)
- [Callchain Tool README](../../../callchain/README.md)
- [Agent Context Standard](../../../../docs/project/architecture/agent-context.md)
- [Implementation Documentation Standard](../../../../docs/project/architecture/implementation-documentation.md)
- [Project Health Skill](../project-health/SKILL.md)
