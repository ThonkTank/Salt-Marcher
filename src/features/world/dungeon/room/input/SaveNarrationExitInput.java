package features.world.dungeon.room.input;

public record SaveNarrationExitInput(
        int levelZ,
        int roomCellX,
        int roomCellY,
        int roomCellZ,
        String direction,
        String description
) {
}
