# Import Pipeline

## Purpose

`importer/pipeline` owns the shared CLI import orchestration from crawler-produced HTML files into the SQLite database.

## Canonical Types and APIs

- `importer.pipeline.PipelineObject.runMonsterImport(RunMonsterImportInput)` - runs the monster import pipeline, including shared batching plus monster-specific recovery handoff.
- `importer.pipeline.PipelineObject.runItemImport(RunItemImportInput)` - runs the item import pipeline across equipment and magic-item directories.
- `importer.pipeline.PipelineObject.runSpellImport(RunSpellImportInput)` - runs the spell import pipeline and triggers spell-specific post-import maintenance.

## Forbidden Drift

- Do not rebuild file collection, DB setup, bulk-import PRAGMAs, or commit-every-100 semantics in individual importer mains.
- Do not absorb parser or repository ownership into this package.
