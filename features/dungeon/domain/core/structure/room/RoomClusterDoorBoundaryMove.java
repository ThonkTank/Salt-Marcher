package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record RoomClusterDoorBoundaryMove(
        DungeonClusterBoundary oldDoorBoundary,
        Cell nextRelativeCell,
        Direction nextDirection,
        DungeonTopologyRef topologyRef
) {
}
