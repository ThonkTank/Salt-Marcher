package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.foundation.geometry.Point2i;

public record DoorSegment(
        Point2i start,
        Point2i end,
        long roomId,
        Point2i roomCell
) {
}
