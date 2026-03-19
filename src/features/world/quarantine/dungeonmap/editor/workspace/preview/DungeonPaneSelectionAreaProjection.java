package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public interface DungeonPaneSelectionAreaProjection {

    DungeonPaneSelectionAreaProjection UNSUPPORTED = (startInclusive, endInclusive) -> null;

    DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive);
}
