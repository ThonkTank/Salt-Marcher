package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchEdge;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchCoreSelectionAdapter {

    private DungeonBoundaryStretchCoreSelectionAdapter() {
    }

    // Remove this bridge when boundary-stretch callers consume RoomClusterBoundaryStretchPlan.Selection directly.
    static StretchSelection fromCore(
            RoomClusterBoundaryStretchPlan.Selection coreSelection,
            Map<EdgeKey, DungeonClusterBoundary> boundariesByKey
    ) {
        return StretchSelection.fromCore(
                coreSelection,
                stretchEdges(coreSelection, boundariesByKey),
                sourceKeys(coreSelection));
    }

    private static List<StretchEdge> stretchEdges(
            RoomClusterBoundaryStretchPlan.Selection coreSelection,
            Map<EdgeKey, DungeonClusterBoundary> boundariesByKey
    ) {
        List<StretchEdge> result = new ArrayList<>();
        for (RoomClusterBoundaryStretchPlan.StretchEdge edge : coreSelection.edges()) {
            result.add(new StretchEdge(
                    DungeonBoundaryStretchCoreGeometry.dungeonEdge(edge.edge()),
                    DungeonBoundaryStretchCoreGeometry.dungeonKey(edge.key()),
                    boundariesByKey.get(edge.key())));
        }
        return List.copyOf(result);
    }

    private static Set<DungeonBoundaryKey> sourceKeys(RoomClusterBoundaryStretchPlan.Selection coreSelection) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        for (EdgeKey key : coreSelection.sourceKeys()) {
            result.add(DungeonBoundaryStretchCoreGeometry.dungeonKey(key));
        }
        return result;
    }
}
