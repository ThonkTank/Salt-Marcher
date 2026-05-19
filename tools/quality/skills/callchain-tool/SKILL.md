---
name: callchain-tool
description: Use before setup, indexing, rendering, interpreting, or citing SaltMarcher's `tools/callchain/` output, or whenever caller/callee context, callchains, Joern, or method-level static-analysis context could help a SaltMarcher task.
---

# Callchain Tool

## Purpose

Use this skill for SaltMarcher's repo-local Java method callchain tool under
`tools/callchain/`. The tool gives method-level static caller/callee context
for a selected Java method.

Callchain output is `Candidate` static-analysis evidence only. It is not an
architecture owner, verification gate, dependency source of truth, Java
language-server call hierarchy, or runtime trace.

Check reflection, JavaFX event dispatch, ServiceLoader discovery, runtime
listener registration, and other dynamic seams against source code or canonical
owner documents when they matter.

## When To Use

Use this tool when static caller/callee context can materially improve the task:

- pre-refactor orientation for a selected method
- review support for a method-level behavior or dependency concern
- blast-radius inspection before changing a method, public entrypoint, or
  callback-like seam
- validating whether a proposed change is local or touches a wider call path

Do not use it when the task only needs file search, type lookup, documentation
owner checks, or runtime behavior evidence.

## Setup

Run setup only when Joern is missing:

```bash
tools/callchain/setup-joern.sh
```

The default install root is `build/callchain/joern`. Set `JOERN_HOME` only when
using a different Joern CLI directory.

Generated output stays under `build/callchain/**`. Do not commit generated
callchain output, Joern workspaces, CPGs, DOT files, or rendered diagrams unless
the user explicitly asks for a repo-tracked artifact.

## Index

Build or refresh the code property graph before rendering callchains:

```bash
JOERN_HOME=build/callchain/joern/joern-cli tools/callchain/index.sh --refresh
```

The CPG is written to `build/callchain/saltmarcher-cpg.bin.zip`.

Refresh the index after source changes that could affect the selected method,
its callers, or its callees. If the source changed after the current index was
created, treat old output as stale and refresh before relying on it.

## Render

Render a selected method:

```bash
JOERN_HOME=build/callchain/joern/joern-cli \
  tools/callchain/render-callchain.sh \
  src.domain.dungeon.DungeonTravelRuntimeApplicationService#applyDungeonTravelSession
```

Use `--depth <n>` to control transitive expansion. Start with a shallow depth
when the method is central or likely to have many callers. Increase depth only
when the extra context changes the decision.

Use `--include-external` only when library or JDK calls are relevant to the
question. Keep project-only output for architecture, ownership, and local
refactor decisions.

Text-first outputs are written under `build/callchain/out/<selector>/`:

- `callchain.txt`
- `callers.txt`
- `callees.txt`
- matching `.dot` files for optional external rendering
- `candidates.tsv`
- `summary.txt`

## Selector Guidance

Prefer selectors that include package, class, and method:

```text
src.domain.dungeon.DungeonTravelRuntimeApplicationService#applyDungeonTravelSession
```

If a selector is ambiguous:

- inspect `candidates.tsv`
- choose the candidate with the expected package/class
- rerender with the more specific selector
- do not treat the first candidate as authoritative without checking it

For overloaded methods, confirm the selected candidate against source before
using the output as evidence.

## Interpreting Output

Use callchain output to ask better source questions, not to replace source
reading.

- Treat reachable callers/callees as `Candidate` until confirmed in source.
- Treat missing dynamic edges as unknown, not absent.
- Confirm any architecture, lifecycle, or ownership conclusion against the
  nearest canonical owner.
- When reporting output, name the selector, depth, whether external calls were
  included, and whether the index was refreshed after relevant source changes.

## Review Templates

Use these compact frames in handoff or review notes only when the callchain
materially affected the work.

Pre-refactor:

```text
Callchain: <selector>, depth <n>, refreshed <yes/no>
Evidence strength: Candidate static analysis
Observed callers/callees: <short summary>
Source confirmation: <files or owners checked>
Decision impact: <what changed because of this context>
```

Review:

```text
Callchain review: <selector>, depth <n>
Concern checked: <ownership/lifecycle/dependency/hot path>
Candidate evidence: <short summary>
Confirmed by source/owner: <yes/no and path>
Finding impact: <none / should fix / must fix / separate slice>
```

Blast radius:

```text
Blast radius: <selector>, depth <n>, external calls <included/excluded>
Likely affected local callers: <short list>
Dynamic seams checked: <reflection/JavaFX/ServiceLoader/listeners/source>
Scope decision: <local / broader same owner / separate slice>
```

## References

- [Callchain README](../../../callchain/README.md)
- [Repo Tools Skill](../repo-tools/SKILL.md)
- [Agent Context Standard](../../../../docs/project/architecture/agent-context.md)
