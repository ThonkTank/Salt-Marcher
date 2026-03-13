package features.world.dungeonmap.model.domain;

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
