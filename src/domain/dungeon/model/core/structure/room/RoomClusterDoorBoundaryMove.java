package src.domain.dungeon.model.core.structure.room;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record RoomClusterDoorBoundaryMove(
        DungeonClusterBoundary oldDoorBoundary,
        Cell nextRelativeCell,
        Direction nextDirection,
        DungeonTopologyRef topologyRef
) {
}
