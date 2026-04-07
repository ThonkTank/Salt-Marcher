package features.world.dungeon.dungeonmap.corridor.application;

import features.world.dungeon.geometry.GridSegment;

public sealed interface CorridorTopologyEdit permits
        CorridorTopologyEdit.DeleteDoor,
        CorridorTopologyEdit.DeleteSegment,
        CorridorTopologyEdit.DeleteWaypoint {

    record DeleteDoor(GridSegment boundarySegment) implements CorridorTopologyEdit {
    }

    record DeleteSegment(Long memberId, int segmentOrdinal) implements CorridorTopologyEdit {
    }

    record DeleteWaypoint(Long waypointId) implements CorridorTopologyEdit {
    }
}
