Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Hex travel readback, party-token movement, and compact travel
state proof obligations.

# Hex Travel Verification

## Purpose

This document owns proof traceability for Hex runtime travel behavior over
authored Hex maps. It covers the Hex-specific stable tile-id convention,
party-token Hex readback, movement through the Hex surface, and compact
`Reise` state-tab readback.

## Verified Sources

- [Hex Feature Requirements](../requirements/requirements-hex.md)
- [Hex Travel Requirements](../requirements/requirements-hex-travel.md)
- [Hex Travel State Requirements](../requirements/requirements-hex-travel-state.md)
- [Hex Domain](../domain/domain-hex-map.md)

## Scope Boundary

This verification document covers Hex interpretation of party-owned overworld
travel positions. It does not cover Dungeon travel, party roster rules, weather
generation, campaign clocks, or encounter simulation.

## Verification Methods

- `Mechanically Enforced`: `./gradlew hexMapEditorBehaviorHarness
  --console=plain` covers Hex map readback plus the travel readback and move
  route.
- `Mechanically Enforced`: `./gradlew hexTravelStateBehaviorHarness
  --console=plain` covers compact `Reise` state-tab binding from
  `HexTravelSnapshot`.
- `Mechanically Enforced`: `./gradlew checkDocumentationEnforcement
  --console=plain` for documentation structure after docs-only changes.

## Proof IDs

| ID | Obligation | Required proof | Current status |
| --- | --- | --- | --- |
| `HEX-TRAVEL-001` | Stable Hex tile id | Hex axial `q,r` round-trips through the stable tile-id convention used by party-owned overworld travel positions. | Ready |
| `HEX-TRAVEL-002` | Party-token Hex readback | A party-owned overworld travel position pointing at a valid Hex tile projects through `HexTravelModel` and renders party-token feedback on the Hex map. | Ready |
| `HEX-TRAVEL-003` | Party-token movement | The Hex `Reisegruppe` tool moves the existing party token through `PartyApplicationService` without creating Dungeon travel semantics. | Ready |
| `HEX-TRAVEL-004` | Invalid party-token movement | The Hex `Reisegruppe` tool rejects coordinates outside the selected Hex map radius and leaves the previous travel position active. | Ready |
| `HEX-TRAVEL-005` | Overlay-only travel redraw | Travel-only party-token updates redraw the party overlay without redrawing the Hex tile layer. | Ready |
| `HEX-TRAVEL-006` | Travel tool label | The Hex map header shows the user-facing `Reisegruppe` tool label instead of the internal `MOVE_PARTY` key. | Ready |
| `HEX-TRAVEL-007` | Marker draft preservation | Marker draft name, type, and note survive a `Reisegruppe` tool refresh on the combined Hex surface. | Ready |
| `HEX-TRAVEL-008` | Render-cap safety | Hex map readback above the current Canvas render radius shows a clear non-rendered state and does not project tile or hit data into Canvas backing storage. | Ready |
| `HEX-TRAVEL-STATE-001` | Empty compact state | The runtime `Reise` state tab shows an explicit empty Hex travel state when no approved Hex readback exists. | Ready |
| `HEX-TRAVEL-STATE-002` | Active compact state | The runtime `Reise` state tab binds compact Hex travel readback for location, status, context, weather, time of day, pace, and hint. | Ready |

## Known Gaps

- Weather and time-of-day values remain `nicht verfuegbar` until a later
  travel-context source publishes them.
- Hex travel currently uses click-to-move through the `Reisegruppe` tool rather
  than drag gestures.

## References

- [Hex Travel Requirements](../requirements/requirements-hex-travel.md)
- [Hex Travel State Requirements](../requirements/requirements-hex-travel-state.md)
- [Travel State Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-travel-state-tab.md:1)
