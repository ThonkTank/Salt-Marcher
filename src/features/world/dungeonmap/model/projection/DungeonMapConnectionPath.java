package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConnectionPoint;

import java.util.List;

public record DungeonMapConnectionPath(
        Long connectionId,
        Long fromRoomId,
        Long toRoomId,
        List<GridPoint> routePoints,
        List<DungeonConnectionPoint> controlPoints,
        boolean directDoorOnly
) {
    public record GridPoint(double x, double y) {
    }
}
