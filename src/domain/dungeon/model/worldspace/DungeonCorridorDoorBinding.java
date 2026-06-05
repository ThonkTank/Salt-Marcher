package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonCorridorDoorBinding(
        long roomId,
        long clusterId,
        Cell relativeCell,
        Direction direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorDoorBinding {
        CorridorDoorBinding binding = new CorridorDoorBinding(
                roomId,
                clusterId,
                relativeCell == null ? new Cell(0, 0, 0) : relativeCell,
                direction == null ? Direction.NORTH : direction);
        roomId = binding.roomId();
        clusterId = binding.clusterId();
        relativeCell = binding.relativeCell();
        direction = binding.direction();
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    CorridorDoorBinding toCore() {
        return new CorridorDoorBinding(roomId, clusterId, relativeCell, direction);
    }
}
