package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.List;
import java.util.Set;

public record CorridorGeometry(
        Long corridorId,
        List<Long> roomIds,
        List<GridSegment> segments,
        Set<Point2i> cells,
        List<DoorSegment> doors,
        List<Point2i> waypointCells,
        boolean directlyAdjacent,
        boolean routable,
        String componentId
) {
    public CorridorGeometry {
        roomIds = roomIds == null ? List.of() : List.copyOf(roomIds);
        segments = segments == null ? List.of() : List.copyOf(segments);
        cells = cells == null ? Set.of() : Set.copyOf(cells);
        doors = doors == null ? List.of() : List.copyOf(doors);
        waypointCells = waypointCells == null ? List.of() : List.copyOf(waypointCells);
    }

    public CorridorGeometry withComponentId(String componentId) {
        return new CorridorGeometry(corridorId, roomIds, segments, cells, doors, waypointCells, directlyAdjacent, routable, componentId);
    }
}
