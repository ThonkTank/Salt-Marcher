package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.foundation.geometry.Point2i;

public record GridSegment(
        Point2i from,
        Point2i to
) {
}
