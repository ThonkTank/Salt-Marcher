## Architecture Note

Encounter builder and combat code should depend on local ports plus adapters in `internal/wiring`.
Direct calls into other feature APIs belong in those adapters, not in encounter application or combat services.

## Generator Conventions

- `EncounterBuilderService` owns request normalization and cross-feature enrichment before calling the generator.
- Generator search policies stay pure/static and receive already-normalized requests plus resolved analysis data.
- `EncounterResultAssembler` is the single generator-internal factory for `GenerationResult` variants.
- Public generator entrypoints may accept a nullable `GenerationContext`, but they normalize it once before passing it deeper.
- `EncounterConstraintPolicy` exposes one public API per concept: state evaluation, completion checks, and reachability checks.
