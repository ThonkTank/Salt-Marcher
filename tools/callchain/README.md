# SaltMarcher Callchain Tool

This directory owns an ad-hoc developer tool for method-level callchain
diagrams. It is not a Gradle gate and it does not define architecture truth.

Agents must read `tools/quality/skills/callchain-tool/SKILL.md` before indexing,
rendering, interpreting, or citing this tool's output.

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
  features.dungeon.application.DungeonTravelRuntimeApplicationService#applyDungeonTravelSession
```

Text-first outputs are written under `build/callchain/out/<selector>/`:

- `callchain.txt`
- `callers.txt`
- `callees.txt`
- matching `.dot` files for optional external rendering
- `candidates.tsv`
- `summary.txt`

Available render options are `--depth <n>`, `--include-external`, and
`--refresh`.

## Agent Workflow

Agent-only selection, freshness, interpretation, and evidence rules live in
`tools/quality/skills/callchain-tool/SKILL.md`. This README remains the sole
owner of setup, index, render, option, and output-path instructions.
