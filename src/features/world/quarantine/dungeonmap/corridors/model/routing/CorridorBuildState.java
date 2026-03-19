package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Set;

record CorridorBuildState(
        Set<Point2i> corridorCells,
        Set<GridSegment> segments,
        Set<DoorSegment> doors,
        boolean directlyAdjacentOnly,
        Set<Long> connectedRoomIds,
        CorridorNetworkScore networkScore
) {
    int connectedRoomCount() {
        return connectedRoomIds.size();
    }
}
