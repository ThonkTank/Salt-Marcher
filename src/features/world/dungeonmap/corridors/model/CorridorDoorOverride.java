package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.Objects;

public record CorridorDoorOverride(
        long roomId,
        long clusterId,
        Point2i relativeCell,
        DungeonRoomCluster.EdgeDirection edgeDirection
) {
    public CorridorDoorOverride {
        Objects.requireNonNull(relativeCell, "relativeCell");
        Objects.requireNonNull(edgeDirection, "edgeDirection");
    }

    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }
}
