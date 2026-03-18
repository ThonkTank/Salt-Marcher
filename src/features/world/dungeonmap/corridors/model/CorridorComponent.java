package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.List;
import java.util.Set;

public record CorridorComponent(
        String componentId,
        long mapId,
        Set<Long> corridorIds,
        Set<Long> roomIds,
        Set<Point2i> cells,
        List<Point2i> outlineVertices,
        List<DoorSegment> doors
) {
}
