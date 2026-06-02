package src.domain.dungeon.model.worldspace.model;

import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Direction;

public record DungeonCorridorDoorBinding(
        long roomId,
        long clusterId,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorDoorBinding {
        CorridorDoorBinding binding = new CorridorDoorBinding(
                roomId,
                clusterId,
                relativeCell == null ? new Cell(0, 0, 0) : relativeCell.geometry(),
                direction == null ? Direction.NORTH : direction.geometry());
        roomId = binding.roomId();
        clusterId = binding.clusterId();
        relativeCell = DungeonCell.fromGeometry(binding.relativeCell());
        direction = fromGeometry(binding.direction());
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean hasTopologyRef() {
        return topologyRef.present();
    }

    CorridorDoorBinding toCore() {
        return new CorridorDoorBinding(roomId, clusterId, relativeCell.geometry(), direction.geometry());
    }

    private static DungeonEdgeDirection fromGeometry(Direction direction) {
        return switch (direction) {
            case NORTH -> DungeonEdgeDirection.NORTH;
            case EAST -> DungeonEdgeDirection.EAST;
            case SOUTH -> DungeonEdgeDirection.SOUTH;
            case WEST -> DungeonEdgeDirection.WEST;
        };
    }
}
