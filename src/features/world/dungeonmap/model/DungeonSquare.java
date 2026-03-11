package features.world.dungeonmap.model;

public record DungeonSquare(
        Long squareId,
        Long mapId,
        int x,
        int y,
        Long roomId,
        String roomName,
        Long areaId,
        String areaName
) {
}
