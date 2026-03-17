package features.world.dungeonmap.domain.model;

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
