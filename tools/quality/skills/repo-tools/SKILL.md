---
name: repo-tools
description: Use before planning, implementing, refactoring, or reviewing SaltMarcher repo-tracked changes to identify available repo-local developer tools and their evidence strength.
---

# Repo Tools

## Workflow

1. Read this catalog before relying on a repo-local tool.
2. Read a tool-specific skill when one is named.
3. Treat tool output with the evidence strength listed here.
4. Do not add new tools, gates, or generated report formats unless the user
   explicitly asks for that scope.

## Tool Catalog

### Java Method Callchains

- Tool path: `tools/callchain/`
- Helps with: static caller/callee orientation for selected Java methods.
- Governing skill: `tools/quality/skills/callchain-tool/SKILL.md`
- Evidence strength: `Candidate`; confirm dynamic routing in source.

### Agent Context Map

- Tool path: `tools/quality/reporting/agent_context_map.py`
- Helps with: candidate owner docs, mandatory skills, verification guidance,
  and cleanup candidates for a path.
- Evidence strength: `Candidate`; owner docs remain authoritative.
- Typical use: `python3 tools/quality/reporting/agent_context_map.py --surface <path>`

### Project Health Scan

- Tool path: `tools/quality/reporting/project_health_scan.py`
- Helps with: `PROJECT_HEALTH_DEBT` marker/register sync and active debt
  intake for planned paths or worktree state.
- Governing skill: `tools/quality/skills/project-health/SKILL.md`
- Evidence strength: `Evidence-Proven` for literal marker/register sync;
  `Candidate` for trend evidence from logs.
- Typical use:
  `python3 tools/quality/reporting/project_health_scan.py --scope <path>`
  or `python3 tools/quality/reporting/project_health_scan.py --intake --worktree`

## Handoff

Report repo-tool usage only when it affected the work: tool name, selector or
scope, governing skill, and evidence strength.
