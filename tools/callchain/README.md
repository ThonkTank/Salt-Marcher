# SaltMarcher Callchain Tool

This directory owns an ad-hoc developer tool for method-level callchain
diagrams. It is not a Gradle gate and it does not define architecture truth.

Agents must read `tools/quality/skills/callchain-tool/SKILL.md` before setup,
indexing, rendering, interpreting, or citing this tool's output.

## Setup

```bash
tools/callchain/setup-joern.sh
```

The default install root is `build/callchain/joern`. Set `JOERN_HOME` when
using a different Joern CLI directory.

## Index

```bash
JOERN_HOME=build/callchain/joern/joern-cli tools/callchain/index.sh --refresh
```

The CPG is written to `build/callchain/saltmarcher-cpg.bin.zip`.

## Render

```bash
JOERN_HOME=build/callchain/joern/joern-cli \
  tools/callchain/render-callchain.sh \
  src.domain.dungeon.DungeonTravelRuntimeApplicationService#applyDungeonTravelSession
```

Text-first outputs are written under `build/callchain/out/<selector>/`:

- `callchain.txt`
- `callers.txt`
- `callees.txt`
- matching `.dot` files for optional external rendering
- `candidates.tsv`
- `summary.txt`

Use `--depth <n>` to control transitive expansion, `--include-external` to keep
non-project methods, and `--refresh` after source changes.

## Agent Workflow

Detailed agent workflow, selector guidance, refresh rules, evidence strength,
and handoff templates live in
`tools/quality/skills/callchain-tool/SKILL.md`.
