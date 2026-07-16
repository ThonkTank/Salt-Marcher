package features.dungeon.application.editor;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteResolver;

record DungeonEditorCoreWallFacts(
        List<Cell> clusterCells,
        RoomClusterWallDeleteResolver wallDeleteResolver
) {
}
