Build successful. The refactoring extracts three submethods from `handleRoomToolPress`:

- **`handleGridRoomPaint`** (lines 47–51): sets `PaintInteraction` and begins paint for GRID + ROOM_PAINT
- **`handleGridRoomDelete`** (lines 53–57): same interaction setup for GRID + ROOM_DELETE (currently identical behavior, but separated for future divergence)
- **`handleGraphRoomPress`** (lines 59–70): handles GRAPH view — creates `GraphCreateInteraction` or `GraphDeleteInteraction` with early returns

The main `handleRoomToolPress` now just guards preconditions, handles wall/door tools inline (unchanged), and dispatches by `viewMode × tool` to the three new submethods. Each submethod is ≤15 lines with no nesting beyond a single `if`.
