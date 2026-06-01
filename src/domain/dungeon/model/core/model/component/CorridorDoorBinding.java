package src.domain.dungeon.model.core.model.component;

import java.util.Objects;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Direction;

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
