# Importer

## Purpose

`src/importer` owns shared CLI-side import and maintenance tooling that sits between crawler output files and persisted database state.

## Canonical Types and APIs

- `importer.pipeline.PipelineObject` - canonical shared import-pipeline root for monster, item, and spell HTML imports.
- `importer.MonsterImportApplicationService` - monster-specific file import plus recovery/override/drift post-processing.
- `importer.Database*Tool` and related CLI tools - explicit maintenance and recovery entrypoints outside feature UI flows.

## Where New Code Goes

- Put shared CLI import orchestration, file collection, transaction batching, and import progress semantics under `importer/pipeline`.
- Keep feature-specific parse/persist steps in the owning feature import service or the monster import service when the behavior is monster-only.

## Forbidden Drift

- Do not recreate bulk-import transaction loops in each CLI importer main.
- Do not move feature-owned parsing or repository writes into generic importer utilities.
