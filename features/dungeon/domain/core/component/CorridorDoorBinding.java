package features.dungeon.domain.core.component;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record CorridorDoorBinding(
        long roomId,
        long clusterId,
        Cell roomCell,
        Direction direction,
        DungeonTopologyRef topologyRef
) {

    public CorridorDoorBinding(long roomId, long clusterId, Cell roomCell, Direction direction) {
        this(roomId, clusterId, roomCell, direction, DungeonTopologyRef.empty());
    }

    public CorridorDoorBinding {
        roomId = Math.max(0L, roomId);
        clusterId = Math.max(0L, clusterId);
        Objects.requireNonNull(roomCell);
        Objects.requireNonNull(direction);
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public CorridorDoorBinding withoutTopologyRef() {
        return topologyRef.present()
                ? new CorridorDoorBinding(roomId, clusterId, roomCell, direction)
                : this;
    }
}
