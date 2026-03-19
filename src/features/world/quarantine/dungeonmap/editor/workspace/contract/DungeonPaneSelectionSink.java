package features.world.quarantine.dungeonmap.editor.workspace.contract;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

public interface DungeonPaneSelectionSink {

    void onRoomSelected(DungeonRoom room);

    void onClusterSelected(DungeonRoomCluster cluster);

    void onCorridorSelected(DungeonCorridor corridor);

    void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint);

    void onCorridorDoorSelected(CorridorDoorHandle handle);

    void onCorridorDoorSelectionChanged(CorridorDoorHandle handle);

    void onCorridorWaypointSelected(CorridorWaypointHandle handle);
}
