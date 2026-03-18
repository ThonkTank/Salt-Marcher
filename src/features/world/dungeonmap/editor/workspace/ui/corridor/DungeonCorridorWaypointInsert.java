package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.foundation.geometry.Point2i;

public record DungeonCorridorWaypointInsert(
        long corridorId,
        int insertIndex,
        Point2i cell
) {
}
