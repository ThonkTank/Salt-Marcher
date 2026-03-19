package features.world.quarantine.dungeonmap.corridors.model.primitives;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public record DoorSegment(
        Point2i start,
        Point2i end,
        long roomId,
        Point2i roomCell
) {
}
