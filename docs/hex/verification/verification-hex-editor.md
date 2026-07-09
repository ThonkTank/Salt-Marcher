Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Hex editor behavior and persistence proof obligations.

# Hex Editor Verification

## Purpose

This document owns durable proof traceability for the Hex editor. It names the
focused harness obligations that must exist before Hex editor implementation can
claim the accepted map, tile, terrain, marker, domain, and persistence behavior
is proven.

## Verified Sources

- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)

## Scope Boundary

This verification document covers Hex editor behavior and authored Hex
persistence. It does not cover interactive runtime travel, compact `Reise`
travel-state behavior, Dungeon Editor feature markers, or generic map-canvas
contracts.

## Verification Methods

- `Mechanically Enforced`: `./gradlew hexMapEditorBehaviorHarness
  --console=plain` runs through production Hex editor/domain/persistence
  routes with an isolated `XDG_DATA_HOME`, including a shell-bound
  `HexMapContribution` route through the real `COCKPIT_CONTROLS`,
  `COCKPIT_MAIN`, and `COCKPIT_STATE` slot views.
- `Mechanically Enforced`: `./gradlew sessionPlannerShellLayoutHarness
  --console=plain` mounts `HexMapContribution` in `ShellWorkspacePane` and
  verifies the shared `CatalogCrudControlsView` plus `ShellControls.stack`
  composition gives the main map visible space.
- `Mechanically Enforced`: `./gradlew checkDocumentationEnforcement
  --console=plain` for documentation structure after docs-only changes.
- `Review-Owned`: review confirms requirements, domain, contract, and
  verification ownership remain split and do not redefine each other.

The focused behavior harness is the required local proof for Hex editor
behavior IDs before broader production handoff proof.

## Proof IDs

| ID | Obligation | Required proof | Current status |
| --- | --- | --- | --- |
| `HEX-EDITOR-001` | Create map | User creates a map with nonblank name and nonnegative radius, then sees the editable map loaded through production readback. | Ready |
| `HEX-EDITOR-002` | Edit map metadata, radius bounds, and shrink warning | Name and radius edits persist; malformed over-limit persisted radius fails visibly; destructive radius shrink surfaces a warning before out-of-radius authored data is removed. | Ready |
| `HEX-EDITOR-003` | Select and inspect tile | Selecting a tile exposes coordinate and available tile details without inventing hidden state. | Ready |
| `HEX-EDITOR-004` | Paint terrain | Painting a supported terrain type updates visible map feedback and persists the terrain override for that tile. | Ready |
| `HEX-EDITOR-005` | Place marker | Creating a marker requires name and type, allows optional note, anchors the marker to exactly one owning tile, and renders marker feedback on that tile. | Ready |
| `HEX-EDITOR-006` | Marker validation | Missing marker name or type produces a visible validation failure and does not persist a marker row. | Ready |
| `HEX-EDITOR-007` | Persistence reload | Created map metadata, terrain overrides, and markers reload through the production SQLite route with stable domain meaning. | Ready |
| `HEX-EDITOR-008` | Controls action routing | Map-save controls events and marker-save controls events remain distinct so a marker draft cannot be persisted by pressing map `Speichern`. | Ready |
| `HEX-EDITOR-009` | Marker-save action routing | Marker-save controls events remain distinct from incidental map draft changes so pressing `Marker speichern` persists the marker instead of updating map metadata. | Ready |
| `HEX-EDITOR-010` | Shared shell layout | `HexMapContribution` mounts shared catalog CRUD controls as the fixed stack child, compact Hex controls as the flexible stack child, and keeps the Hex main map visible in `COCKPIT_MAIN`. | Ready |
| `HEX-EDITOR-011` | Catalog rename radius preservation | Renaming a non-current Hex map through the shared catalog CRUD route preserves that target map's existing radius instead of writing the create default. | Ready |
| `HEX-EDITOR-012` | Shell-bound contribution route | Binding `HexMapContribution` through shell slots creates, edits, paints, selects, saves a marker, moves the party token, and reloads persisted Hex map state through the visible slot views. | Ready |
| `HEX-EDITOR-013` | Save failure visibility | State-pane map `Speichern` routes through the production update path; a forced SQLite save failure surfaces visibly and leaves persisted map metadata unchanged. | Ready |

## Pass Or Fail Criteria

The focused Hex editor harness passes only when every proof ID marked ready by
the implementation emits source-backed evidence from the production route. A
proof ID fails when it relies on fixture-only selftests, fake view state,
Dungeon-owned marker semantics, or direct SQLite rows without domain readback.

## Related Proof

- Interactive Hex travel and compact runtime `Reise` travel-state behavior are
  covered by
  `docs/hex/verification/verification-hex-travel.md:1`.

## References

- [Hex Feature Requirements](../requirements/requirements-hex.md)
- [Hex Editor Requirements](../requirements/requirements-hex-editor.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
- [Hex Travel Verification](./verification-hex-travel.md)
