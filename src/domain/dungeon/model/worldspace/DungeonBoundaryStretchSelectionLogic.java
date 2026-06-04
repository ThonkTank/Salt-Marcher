package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchSelectionLogic {

    // Remove this bridge when boundary-stretch callers use RoomClusterBoundaryStretchPlan directly.
    Optional<StretchSelection> resolveStretch(
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        Optional<RoomClusterBoundaryStretchPlan.Selection> coreSelection =
                RoomClusterBoundaryStretchPlan.resolve(
                        DungeonBoundaryStretchCoreGeometry.clusterCells(target, sourceEdges),
                        DungeonBoundaryStretchCoreGeometry.edges(sourceEdges),
                        DungeonBoundaryStretchCoreBoundaryRows.rowsByKey(boundaries),
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
