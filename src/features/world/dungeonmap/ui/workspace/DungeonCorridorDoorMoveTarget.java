package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;

public record DungeonCorridorDoorMoveTarget(
        long roomId,
        Point2i roomCell,
        DungeonRoomCluster.EdgeDirection direction
) {
}
