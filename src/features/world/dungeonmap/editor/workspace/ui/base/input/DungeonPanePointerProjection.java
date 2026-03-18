package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

public interface DungeonPanePointerProjection {
    DungeonLayout dungeonLayout();
    Point2i worldPointAt(double screenX, double screenY);
    double worldX(double screenX);
    double worldY(double screenY);
    DungeonRoomCluster findClusterAt(double screenX, double screenY);
    DungeonRoom findRoomAt(double screenX, double screenY);
    DungeonCorridor findCorridorAt(double screenX, double screenY);
    CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY);
    DungeonCorridorEndpoint corridorEndpointLocationAt(double screenX, double screenY, DungeonRoom room, DungeonCorridor corridor);
    DungeonRoomCluster clusterById(long clusterId);
}
