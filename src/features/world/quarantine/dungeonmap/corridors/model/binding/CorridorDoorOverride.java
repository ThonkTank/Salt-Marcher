package features.world.quarantine.dungeonmap.corridors.model.binding;

import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Objects;

public record CorridorDoorOverride(
        long roomId,
        long clusterId,
        Point2i relativeCell,
        DungeonRoomCluster.EdgeDirection edgeDirection
) implements ClusterBoundBinding<CorridorDoorOverride> {
    public CorridorDoorOverride {
        Objects.requireNonNull(relativeCell, "relativeCell");
        Objects.requireNonNull(edgeDirection, "edgeDirection");
    }

    @Override
    public Point2i absoluteCell(Point2i clusterCenter) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    @Override
    public CorridorDoorOverride rebuild(long clusterId, Point2i relativeCell) {
        return new CorridorDoorOverride(this.roomId(), clusterId, relativeCell, this.edgeDirection());
    }
}
