package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public record CorridorDoorMoveTarget(long corridorId, long roomId, Point2i cell, int direction) {
}
