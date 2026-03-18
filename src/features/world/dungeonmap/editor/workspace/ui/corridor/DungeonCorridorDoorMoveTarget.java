package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

public record DungeonCorridorDoorMoveTarget(
        long roomId,
        Point2i roomCell,
        DungeonRoomCluster.EdgeDirection direction
) {
}
