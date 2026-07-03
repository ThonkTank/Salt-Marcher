Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Transition route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Transition Matrix

## Purpose

This catalog owns route expectations for transition creation, deletion,
description editing, destination editing, and bidirectional linking. Shared
proof model, status vocabulary, route ownership, and completion criteria remain
in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-TRN-001` | Create transition | Transition family, destination state card, primary map click | `F6_MULTI_LEVEL_FLOORS` plus direct SQLite anchor rows | Default unlinked entrance and explicit overworld destinations create `CELL` transition rows, topology, unlabeled transition-specific markers, hover-only label text, reload, selection, description edit, and unlinked delete behavior without committed feature-label text; direct `NONE` and `EDGE` anchor rows reload and re-save without losing `anchor_type`, coordinates, or edge direction. | Ready |
| `DE-TRN-002` | Delete transition | Transition family plus secondary transition-marker click | `F13_TRANSITION_DESCRIPTION` | Unlinked transition deletes; linked, reverse-linked, or referenced transition rejects unchanged. | Ready |
| `DE-TRN-003` | Bidirectional transition link | Transition state-panel link card and save | `F13_TRANSITION_DESCRIPTION` | Source destination and target back-link update atomically or both reject unchanged. | Ready |
| `DE-TRN-004` | Edit transition description | Transition selection plus state-panel description card | `F13_TRANSITION_DESCRIPTION` | Description persists without changing destination, link, or cell fields. | Ready |
| `DE-TRN-005` | Create edge transition | Transition family plus primary wall-boundary click | `F4_WALLED_ROOM_WITH_DOOR` | A wall-boundary click creates an `EDGE` transition row with `anchor_edge_direction`, publishes source-edge geometry without transition feature cells, renders an unlabeled transition-specific door-like boundary marker at the edge midpoint, omits committed feature-label text, exposes hover-only label text, and remains selectable/deletable through the transition marker target. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Transition Invariants](verification-dungeon-transition-invariants.md)
- [Dungeon Path Invariants](verification-dungeon-path-invariants.md)
