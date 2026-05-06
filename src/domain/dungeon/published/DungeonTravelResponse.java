package src.domain.dungeon.published;

public sealed interface DungeonTravelResponse permits
        DungeonTravelResponse.Surface,
        DungeonTravelResponse.Move {

    record Surface(DungeonTravelSurfaceSnapshot surface) implements DungeonTravelResponse { }

    record Move(DungeonTravelMoveResult result) implements DungeonTravelResponse { }
}
