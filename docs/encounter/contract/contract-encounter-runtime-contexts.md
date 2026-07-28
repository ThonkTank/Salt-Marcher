# Encounter Runtime Context Contract

Status: Active target contract with one manual Godot context; Scene synchronization not yet implemented
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

Encounter owns the mutable builder, initiative, combat, and result state of
each running context. Scene owns which contexts exist, their focus, assigned
PCs, location, initial prepared plan, and NPC role facts. Synchronization MUST
NOT transfer Encounter-owned runtime state back to Scene.

Current production state uses the stable `encounter_context.manual` context.
It proves durable runtime ownership and the complete manual saved-plan combat
journey. The Scene-owned complete-set synchronization API described below is
still target behavior and must not be inferred from that manual context.

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

## Persistence And Current-Format Integrity

The target Encounter owner partition holds context roots, immutable foreign
facts, builder values, rosters and tags, initiative entries, combatants, and
result enemies as explicit versioned JSON values. Large or independently
streamed runtime collections may use Encounter-owned chunks referenced by that
partition. Cross-feature identifiers remain stable values and never become
cross-owner storage links.

Replacing the complete context set and every changed runtime value occurs in
one Campaign generation publication. Saved-plan and runtime-context truth stay
separate typed collections inside the Encounter owner format. A malformed or
unsupported owner format fails closed under the shared persistence lifecycle.
Before the first released Godot format, earlier development formats are
disposable; later compatibility requires an explicit owning contract.


## References

- [Encounter Requirements](../requirements/requirements-encounter.md)
- [Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
