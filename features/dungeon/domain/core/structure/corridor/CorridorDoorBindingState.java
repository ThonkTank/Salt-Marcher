package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record CorridorDoorBindingState(
        long roomId,
        long clusterId,
        Cell relativeCell,
        Direction direction,
        DungeonTopologyRef topologyRef
) {

    public CorridorDoorBindingState {
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

    public CorridorDoorBinding toCore() {
        return new CorridorDoorBinding(roomId, clusterId, relativeCell, direction);
    }
}
