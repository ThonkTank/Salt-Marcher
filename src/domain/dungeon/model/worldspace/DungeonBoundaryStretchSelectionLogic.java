package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchSelectionLogic {

    // Remove this bridge when boundary-stretch callers use RoomClusterWallMap directly.
    Optional<StretchSelection> resolveStretch(
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Optional<src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan.Selection> coreSelection =
                RoomClusterWallMap.fromKeyedRows(DungeonBoundaryStretchCoreBoundaryRows.rowsByKey(boundaries))
                        .stretchSelection(
                                RoomClusterFloorMap.fromCells(
                                        DungeonBoundaryStretchCoreGeometry.clusterCells(target, sourceEdges)),
                                DungeonBoundaryStretchCoreGeometry.edges(sourceEdges),
                                deltaQ,
                                deltaR,
                                deltaLevel);
        if (coreSelection.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(DungeonBoundaryStretchCoreSelectionAdapter.fromCore(
                coreSelection.get(),
                DungeonBoundaryStretchCoreBoundaryRows.boundariesByKey(boundaries)));
    }
}
