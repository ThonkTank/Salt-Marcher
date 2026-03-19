package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public record CorridorWaypointInsert(long corridorId, int insertIndex, Point2i cell) {
}
