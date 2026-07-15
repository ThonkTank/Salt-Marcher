Status: Deprecated
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Deprecated historical notes; canonical runtime ownership lives
in `docs/dungeon/domain/domain-dungeon.md`.

# Historical Travel Domain Notes

This file is retained only as a historical terminology pointer during
migration. It is not the canonical owner for travel runtime model placement,
application boundaries, commands, invariants, or persistence policy.

Canonical runtime ownership:

- [Dungeon Domain Model](../../dungeon/domain/domain-dungeon.md) (line 1)

Historical terms below may help when reading older code or pass logs, but they
must not be extended as active model truth.

## Ubiquitous Language

- `TravelDungeonSnapshot`: current runtime dungeon-travel session readback
- `TravelDungeonWorkspaceState`: projected runtime workspace state for one
  current position
- `DungeonTravelSurfaceSnapshot`: authored dungeon traversal facts for the
  current travel session; render-state projection remains view-owned
- `TravelOverlaySettings`: session-local overlay projection controls
