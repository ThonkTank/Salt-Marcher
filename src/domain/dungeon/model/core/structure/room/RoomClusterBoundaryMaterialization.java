package src.domain.dungeon.model.core.structure.room;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;

public final class RoomClusterBoundaryMaterialization {
    private RoomClusterBoundaryMaterialization() {
    }

    public static @Nullable BoundaryRow forEdge(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge,
            @Nullable BoundaryKind kind
    ) {
        return RoomClusterWallMap.materializeRow(clusterCells, center, clusterId, edge, kind);
    }

    public static @Nullable BoundaryRow openForEdge(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge
    ) {
        return forEdge(clusterCells, center, clusterId, edge, BoundaryKind.OPEN);
    }

    public enum BoundaryKind {
        WALL,
        DOOR,
        OPEN
    }

    public record BoundaryRow(
            long clusterId,
            int level,
            Cell relativeCell,
            Direction direction,
            BoundaryKind kind
    ) {
        public BoundaryRow {
            Objects.requireNonNull(relativeCell);
            Objects.requireNonNull(direction);
            Objects.requireNonNull(kind);
        }
    }

}
