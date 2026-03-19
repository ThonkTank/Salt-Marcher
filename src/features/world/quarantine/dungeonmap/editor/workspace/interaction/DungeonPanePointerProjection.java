package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

public interface DungeonPanePointerProjection {
    DungeonLayout dungeonLayout();
    Point2i worldPointAt(double screenX, double screenY);
    double worldX(double screenX);
    double worldY(double screenY);
    DungeonRoomCluster clusterById(long clusterId);
    DungeonPaneHitTestProjection hitTests();

    default boolean canCreateGraphRoomAt(Point2i world) { return false; }
    default DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) { return null; }
}
