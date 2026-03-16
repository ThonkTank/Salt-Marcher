package features.world.dungeonmap.model;

import java.util.List;
import java.util.Set;

public record CorridorGeometry(
        Long corridorId,
        List<Long> roomIds,
        List<GridSegment> segments,
        Set<Point2i> cells,
        List<DoorSegment> doors,
        boolean directlyAdjacent,
        boolean routable,
        String componentId
) {
    public CorridorGeometry withComponentId(String componentId) {
        return new CorridorGeometry(corridorId, roomIds, segments, cells, doors, directlyAdjacent, routable, componentId);
    }
}
