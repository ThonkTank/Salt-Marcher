Status: Active
Owner: Encounter Feature
Consumers: Scene Feature, Encounter State Tab
Last Reviewed: 2026-07-16
Source of Truth: Runtime-context synchronization and persistence boundary.

# Encounter Runtime Context Contract

## Purpose And Boundary

Encounter owns the mutable builder, initiative, combat, and result state of
each running context. Scene owns which contexts exist, their focus, assigned
PCs, location, initial prepared plan, and NPC role facts. Synchronization MUST
NOT transfer Encounter-owned runtime state back to Scene.

## API Surface

`EncounterRuntimeContextApi.synchronize` accepts one complete context set with
a monotonically increasing source revision, one focused typed context ID, and
immutable foreign facts per context. The operation is asynchronous. IDs MUST
be non-blank and unique, the set MUST be non-empty, and the focused ID MUST be
present.

A newer revision creates missing contexts, updates foreign facts without
overwriting existing runtime state, removes contexts absent from the complete
set, and changes focus atomically. A revision not newer than the accepted
revision returns `STALE_IGNORED`. Invalid sets return `INVALID`; persistence
failure returns `STORAGE_ERROR`. Scene retries failed synchronization after
initialization or refresh.

Hostile NPC facts enter the context as enemies, friendly facts enter as allies,
and neutral facts remain outside combat. The first synchronization of a new
context MAY open its initial saved plan; later synchronizations MUST NOT reset
the runtime to that plan.

## Persistence And Compatibility

Encounter migration owner `encounter` version `3` owns the context root,
foreign-fact children, builder values, roster and tags, initiative entries,
combatants, and result enemies. Collections are stored in named relational
tables; opaque payloads and text codecs are not compatible storage formats.
Cross-feature identifiers are stable values and MUST NOT use cross-owner
foreign keys.

Replacing the complete context set and all changed runtime rows occurs in one
SQLite transaction. Existing saved-plan migrations remain compatible. A newer
Encounter feature schema fails closed under the shared persistence lifecycle.

## Verification

Mechanical proof covers migration, relational round-trip, focus and revision
readback, and absence of opaque payload columns. Scene behavior tests cover
save-then-sync failure and retry. User-visible multi-scene state retention
remains part of owner acceptance.

## References

- [Encounter Requirements](../requirements/requirements-encounter.md)
- [Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
