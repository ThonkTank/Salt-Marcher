package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteResolver;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorCoreWallFactsByLevel {
    private final Map<Long, Set<CellKey>> cellsByCluster;
    private final RoomClusterWallDeleteResolver wallDeleteResolver;

    private DungeonEditorCoreWallFactsByLevel(
            Map<Long, Set<CellKey>> cellsByCluster,
            RoomClusterWallDeleteResolver wallDeleteResolver
    ) {
        this.cellsByCluster = cellsByCluster == null ? Map.of() : Map.copyOf(cellsByCluster);
        this.wallDeleteResolver = wallDeleteResolver == null
                ? RoomClusterWallDeleteResolver.authored(List.of())
                : wallDeleteResolver;
    }

    static DungeonEditorCoreWallFactsByLevel from(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            int level,
            DungeonEditorBoundaryClusterCellsHelper clusterCells
    ) {
        Map<Long, Set<CellKey>> cellsByCluster = clusterCells.collect(snapshot, level);
        return new DungeonEditorCoreWallFactsByLevel(
                cellsByCluster,
                RoomClusterWallDeleteResolver.authored(
                        DungeonEditorCoreWallGeometry.edges(wallEdges(snapshot, level))));
    }

    Set<Long> clusterIds() {
        return cellsByCluster.keySet();
    }

    DungeonEditorCoreWallFacts forCluster(long clusterId) {
        return new DungeonEditorCoreWallFacts(
                DungeonEditorCoreWallGeometry.cells(cellsByCluster.getOrDefault(clusterId, Set.of())),
                wallDeleteResolver);
    }

    private static Set<EdgeKey> wallEdges(DungeonEditorWorkspaceValues.MapSnapshot snapshot, int level) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        if (snapshot == null) {
            return Set.of();
        }
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            addMatchingWallBoundary(result, boundary, level);
        }
        return Set.copyOf(result);
    }

    private static void addMatchingWallBoundary(
            Set<EdgeKey> result,
            DungeonEditorWorkspaceValues.Boundary boundary,
            int level
    ) {
        if (boundary.edge() == null
                || boundary.edge().from() == null
                || boundary.edge().to() == null
                || boundary.edge().from().level() != level
                || boundary.kind().isDoor()) {
            return;
        }
        result.add(EdgeKey.from(boundary.edge()));
    }
}
