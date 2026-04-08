package features.world.dungeon.room.state;

public record SaveNarrationExitState(
        int levelZ,
        int roomCellX,
        int roomCellY,
        int roomCellZ,
        String direction,
        String description
) {
}
