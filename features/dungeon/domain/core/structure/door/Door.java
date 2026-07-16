package features.dungeon.domain.core.structure.door;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;

public record Door(
        long doorId,
        long roomId,
        long clusterId,
        Cell relativeCell,
        Direction direction
) {

    public Door {
        doorId = Math.max(0L, doorId);
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        Objects.requireNonNull(relativeCell);
        Objects.requireNonNull(direction);
    }

    public BoundaryState doorBoundaryState() {
        return boundaryState(BoundaryState.Kind.DOOR);
    }

    public BoundaryState restoredWallState() {
        return boundaryState(BoundaryState.Kind.WALL);
    }

    private BoundaryState boundaryState(BoundaryState.Kind kind) {
        return new BoundaryState(clusterId, relativeCell.level(), relativeCell, direction, kind);
    }

    public record BoundaryState(
            long clusterId,
            int level,
            Cell relativeCell,
            Direction direction,
            Kind kind
    ) {
        public BoundaryState {
            Objects.requireNonNull(relativeCell);
            Objects.requireNonNull(direction);
            Objects.requireNonNull(kind);
        }

        public enum Kind {
            DOOR,
            WALL
        }
    }
}
