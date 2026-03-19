package features.world.quarantine.dungeonmap.corridors.model.primitives;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public record GridSegment(
        Point2i from,
        Point2i to
) {
}
