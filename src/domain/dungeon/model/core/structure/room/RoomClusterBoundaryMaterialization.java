package src.domain.dungeon.model.core.structure.room;

import java.util.Locale;
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
        WALL("wall"),
        DOOR("door"),
        OPEN("open");

        private final String boundaryKind;

        BoundaryKind(String boundaryKind) {
            this.boundaryKind = boundaryKind;
        }

        public static BoundaryKind parse(String value) {
            if (value == null || value.isBlank()) {
                return WALL;
            }
            String normalized = value.trim().toUpperCase(Locale.ROOT);
            if (DOOR.name().equals(normalized)) {
                return DOOR;
            }
            if (OPEN.name().equals(normalized)) {
                return OPEN;
            }
            return WALL;
        }

        public String boundaryKind() {
            return boundaryKind;
        }

        public boolean renderable() {
            return this != OPEN;
        }
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
