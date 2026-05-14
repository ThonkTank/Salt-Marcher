# SaltMarcher Callchain Tool

This directory owns an ad-hoc developer tool for method-level callchain
diagrams. It is not a Gradle gate and it does not define architecture truth.

## Setup

```bash
tools/callchain/setup-joern.sh
```

The default install root is `build/callchain/joern`. Set `JOERN_HOME` when
using a different Joern CLI directory.

Graph rendering requires Graphviz `dot`.

## Index

```bash
JOERN_HOME=build/callchain/joern/joern-cli tools/callchain/index.sh --refresh
```

The CPG is written to `build/callchain/saltmarcher-cpg.bin.zip`.

## Render

```bash
JOERN_HOME=build/callchain/joern/joern-cli \
  tools/callchain/render-callchain.sh \
  src.domain.travel.TravelApplicationService#applyDungeonTravelSession
```

Outputs are written under `build/callchain/out/<selector>/`:

- `callers.svg`
- `callees.svg`
- `both.svg`
- matching `.dot` files
- `candidates.tsv`
- `summary.txt`

Use `--depth <n>` to control transitive expansion, `--include-external` to keep
non-project methods, and `--refresh` after source changes.

## Limits

The diagrams are static-analysis evidence, not a runtime trace. Reflection,
JavaFX event dispatch, ServiceLoader discovery, and listener registration may
need source-level interpretation beside the generated graph.
