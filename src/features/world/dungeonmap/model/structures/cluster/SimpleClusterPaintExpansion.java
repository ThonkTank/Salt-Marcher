package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

public record SimpleClusterPaintExpansion(
        TileShape clusterShape,
        long roomId,
        Point2i roomAnchor
) {
}
