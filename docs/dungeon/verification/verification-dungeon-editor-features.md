Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
Source of Truth: Authored feature-marker route expectations for Dungeon Editor
behavior verification.

# Dungeon Editor Feature Matrix

## Purpose

This catalog owns route expectations for authored feature-marker controls,
create/delete behavior, selection or hit identity, and persistence reload
proof. Shared proof model, status vocabulary, route ownership, and completion
criteria remain in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-FEATURE-001` | Feature family controls | Feature family button and dropdown | `F0_EMPTY_MAP` | `Feature` is a directly visible family button; `POI`, `Objekt`, and `Encounter` live only in the anchored dropdown and not as top-level subaction buttons. | Ready |
| `DE-FEATURE-002` | Feature family sub-option routing | Feature family dropdown | `F0_EMPTY_MAP` | Selecting `POI`, `Objekt`, or `Encounter` routes to the matching tool and reopening the family remembers the last selected option. | Ready |
| `DE-FEATURE-003` | Create POI marker | Feature family default plus primary map click | `F6_MULTI_LEVEL_FLOORS` | One `dungeon_feature_markers` row, one `FEATURE_MARKER` topology ref, published POI feature, active-level render cell, marker glyph, no committed feature-label text, and hover-only marker label persist at the clicked cell. | Ready |
| `DE-FEATURE-004` | Feature marker selection and hit identity | Feature create readback plus authored marker hit | `F6_MULTI_LEVEL_FLOORS` | The authored marker resolves as `MARKER` with element kind `FEATURE_MARKER`, not `CELL`, `LABEL`, or `HANDLE`; feature-marker create selects the marker and publishes inspector readback through state and map-surface snapshots. | Ready |
| `DE-FEATURE-005` | Create Objekt and Encounter markers | Feature family dropdown plus primary map clicks | `F6_MULTI_LEVEL_FLOORS` | Objekt and Encounter options activate the matching tool before map press, then publish distinct `OBJECT` and `ENCOUNTER` authored markers with separate render glyphs. | Ready |
| `DE-FEATURE-006` | Feature marker persistence reload | Reload hop after feature-marker create | `F6_MULTI_LEVEL_FLOORS` | Created authored feature markers survive reload with stable row state, topology refs, published features, and render glyphs. | Ready |
| `DE-FEATURE-007` | Delete feature marker | Active feature family plus secondary map click on authored marker | `F6_MULTI_LEVEL_FLOORS` | Secondary click on an authored feature marker deletes the hit `FEATURE_MARKER` row, topology ref, render glyph, and survives reload while adjacent markers remain stable. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor Map, Projection, And Controls Matrix](verification-dungeon-editor-map-controls.md)
- [Dungeon Editor Selection Matrix](verification-dungeon-editor-selection.md)
