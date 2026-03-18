package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

record DungeonPanePointerHit(
        Point2i world,
        DungeonRoomCluster cluster,
        DungeonRoom room,
        DungeonCorridor corridor,
        CorridorDoorHit corridorDoorHit
) {
}
