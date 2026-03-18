package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.foundation.geometry.Point2i;

public interface DungeonPaneGraphCreationProjection {

    DungeonPaneGraphCreationProjection UNSUPPORTED = world -> false;

    boolean canCreateGraphRoomAt(Point2i world);
}
