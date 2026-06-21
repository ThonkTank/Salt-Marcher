package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallDeleteResolver;

record DungeonEditorCoreWallFacts(
        List<Cell> clusterCells,
        RoomClusterWallDeleteResolver wallDeleteResolver
) {
}
