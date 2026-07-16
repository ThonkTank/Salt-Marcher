package features.dungeon.domain.core.component;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;

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
