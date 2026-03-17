package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.model.Point2i;

public record DungeonCorridorWaypointInsert(
        long corridorId,
        int insertIndex,
        Point2i cell
) {
}
