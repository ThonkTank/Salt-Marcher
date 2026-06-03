package src.domain.dungeon.model.core.component;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public record CorridorDoorBinding(
        long roomId,
        long clusterId,
        Cell relativeCell,
        Direction direction
) {

    public CorridorDoorBinding {
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        Objects.requireNonNull(relativeCell);
        Objects.requireNonNull(direction);
    }
}
