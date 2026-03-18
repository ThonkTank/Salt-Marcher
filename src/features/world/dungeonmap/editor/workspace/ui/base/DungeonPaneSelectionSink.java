package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;

public interface DungeonPaneSelectionSink {

    default void onRoomSelected(DungeonRoom room) {
    }

    default void onClusterSelected(DungeonRoomCluster cluster) {
    }

    default void onCorridorSelected(DungeonCorridor corridor) {
    }

    default void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {
    }

    default void onCorridorDoorSelected(CorridorDoorHandle handle) {
    }

    default void onCorridorDoorSelectionChanged(CorridorDoorHandle handle) {
    }

    default void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
    }
}
