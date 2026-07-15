---
name: repo-tools
description: Optional catalog for discovering SaltMarcher repo-local developer tools and their evidence strength when a task needs one.
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

## Handoff

Report repo-tool usage only when it affected the work: tool name, selector or
scope, governing skill, and evidence strength.
