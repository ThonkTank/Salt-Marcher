Status: Temporary Migration
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
Source of Truth: Temporary implementation sequence and remaining deletion
boundary for the Dungeon greenfield migration.

# Dungeon Greenfield Delivery

## Why This Exists

The durable target is owned by the Dungeon requirements, domain, architecture,
and persistence contract. This file records only the temporary path from the
shipped whole-map editor to that target and is deleted when the final legacy
route is gone.

## Current Foundation

- passive camera math, negative unbounded scene coordinates, logical paint
  phases on one bounded JavaFX backing surface, and weighted viewport caching live
  in `platform.ui.mapcanvas`
- Dungeon exposes typed Authored and Travel APIs; the travel JavaFX adapter no
  longer imports the travel application service
- pointer-move work is latest-wins and discrete gesture input invalidates stale
  queued moves
- authored preview reuses an immutable loaded workset and has executable proof
  that repeated preview does not reread the repository
- `64 x 64` chunk identity, negative floor-division, visible-plus-one-ring
  loading sets, revision-scoped `256 MiB` viewport caching, off-window
  continuation evidence, viewport snapshots, persisted map revision, and
  SQLite chunk inventory exist
- ordinary single-map authored commands use an incremental before/after write:
  unchanged stable-identity rows are not rewritten, obsolete identities are
  removed in the same transaction, and SQLite accepts only revision `n -> n+1`
- per-session undo/redo is limited to `200` commands or `128 MiB`, is available
  through standard shortcuts, and restores content as a new revision

## Recommended Rollout

1. Replace the editor's application-type dependency bundle with
   `DungeonEditorApi.current/subscribe/dispatch` and move scene translation
   wholly into the Dungeon JavaFX adapter.
2. Replace the cold-load full-map repository adapter with chunk-content reads,
   and migrate the remaining multi-map compatibility write to the incremental
   change path.
3. Drive viewport requests from camera and resize changes, protect visible and
   edited chunks in the `256 MiB` cache, and expose off-window graph
   continuations.
4. Remove fixed map dimensions, unconditional whole-map readback, prepared
   render frames in application code, and the legacy full-record repository
   writer.
5. Qualify performance budgets and parity for editor and travel, then delete
   this delivery note.

## Risks And Dependencies

- cross-chunk corridors, stairs, transitions, and labels require map-wide
  identity with multi-chunk membership, not duplicated entities
- chunk-content reads must preserve one map-wide identity when an entity spans
  several chunks
- existing Dungeon rows are disposable test data, so schema replacement may be
  destructive and automatic; no compatibility or backup phase is required
- the editor JavaFX adapter still imports editor application types and still
  consumes the compatibility full-map projection; the durable architecture
  gate must not claim either boundary is complete before steps 1 through 3

## Milestone Verification

- every migration slice runs `./gradlew check`
- visible behavior uses production-route JavaFX tests
- chunk math, cache eviction, latest-wins scheduling, no-preview-I/O, revision
  persistence, and history have deterministic JUnit proof
- final qualification follows `docs/project/verification/quality-platforms.md`

## Open Delivery Questions

None. Product choices are fixed: seamless sparse coordinates, one Dungeon
feature, platform-owned passive canvas mechanisms, and per-session history.

## References

- [Dungeon Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md)
- [Quality Platforms](../../project/verification/quality-platforms.md)
