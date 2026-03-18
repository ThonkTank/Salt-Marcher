package features.world.dungeonmap.editor.workspace.ui.preview;

import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

public interface DungeonPaneSelectionAreaProjection {

    DungeonPaneSelectionAreaProjection UNSUPPORTED = (startInclusive, endInclusive) -> null;

    DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive);
}
