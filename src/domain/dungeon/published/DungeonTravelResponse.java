package src.domain.dungeon.published;

public sealed interface DungeonTravelResponse permits
        DungeonTravelResponse.Surface,
        DungeonTravelResponse.Move {

    record Surface(DungeonTravelSurfaceSnapshot surface) implements DungeonTravelResponse {

        public Surface {
            surface = surface == null
                    ? new DungeonTravelSurfaceSnapshot(null, "", 0, null, null, "", "", "", "", "", "", null)
                    : surface;
        }
    }

    record Move(DungeonTravelMoveResult result) implements DungeonTravelResponse {

        public Move {
            result = result == null
                    ? new DungeonTravelMoveResult(null, "", new DungeonTravelSurfaceSnapshot(null, "", 0, null, null, "", "", "", "", "", "", null))
                    : result;
        }
    }
}
