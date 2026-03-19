package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

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

    public static CorridorGeometry empty(Long corridorId, List<Long> roomIds) {
        return new CorridorGeometry(corridorId, roomIds, List.of(), Set.of(), List.of(), List.of(), false, false, null);
    }

    public CorridorGeometry withComponentId(String componentId) {
        return new CorridorGeometry(corridorId, roomIds, segments, cells, doors, waypointCells, directlyAdjacent, routable, componentId);
    }
}
