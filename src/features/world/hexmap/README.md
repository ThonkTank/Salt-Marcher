# World Hexmap Feature

This feature owns the hex map domain used by:
- overworld map view (`ui/overworld`)
- travel scene pane (`ui/travel`)
- map editor (`ui/editor`)

## Public entry points

- `service/HexMapService`: main facade for loading, creating and mutating maps.
- `ui/overworld/OverworldView`: read-only map view with party token.
- `ui/travel/TravelPane`: scene pane for travel context.
- `ui/editor/MapEditorView`: map editing workflow.

## Internal structure

- `model/`: hex map domain objects (`HexMap`, `HexTile`)
- `repository/`: map persistence
- `service/adapter/`: hexmap-scoped integration adapters (`HexMapCampaignStateAdapter`)
- `ui/shared/`: feature-local shared UI components (`HexGridPane`)
