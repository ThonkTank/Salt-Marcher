package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.domain.model.DungeonRoomCluster;
import features.world.dungeonmap.domain.model.Point2i;

public record DungeonCorridorDoorMoveTarget(
        long roomId,
        Point2i roomCell,
        DungeonRoomCluster.EdgeDirection direction
) {
}
