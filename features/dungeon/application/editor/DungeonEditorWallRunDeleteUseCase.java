package features.dungeon.application.editor;

import java.util.Set;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteTarget;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorWallRunDeleteUseCase {
    private final DungeonEditorBoundaryClusterCellsHelper clusterCells =
            new DungeonEditorBoundaryClusterCellsHelper();

    DungeonEditorWallDeleteTarget interiorRunForBoundary(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        if (edge == null || edge.from() == null) {
            return DungeonEditorWallDeleteTarget.none(clusterId);
        }
        return targetFor(
                wallFacts(snapshot, edge.from().level()),
                clusterId,
                wallMap -> wallMap.wallDeleteResolver().deleteTarget(
                        wallMap.clusterCells(),
                        DungeonEditorCoreWallGeometry.edge(edge)));
    }

    DungeonEditorWallDeleteTarget cornerRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            VertexKey vertex
    ) {
        DungeonEditorCoreWallFactsByLevel wallFacts = wallFacts(snapshot, vertex.level());
        for (Long clusterId : wallFacts.clusterIds()) {
            DungeonEditorWallDeleteTarget target = targetFor(
                    wallFacts,
                    clusterId,
                    wallMap -> wallMap.wallDeleteResolver().cornerDeleteTarget(
                            wallMap.clusterCells(),
                            DungeonEditorCoreWallGeometry.cell(vertex)));
            if (target.active()) {
                return target;
            }
        }
        return DungeonEditorWallDeleteTarget.none(0L);
    }

    DungeonEditorWallDeleteTarget cellRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            CellKey cell
    ) {
        DungeonEditorCoreWallFactsByLevel wallFacts = wallFacts(snapshot, cell.level());
        for (Long clusterId : wallFacts.clusterIds()) {
            DungeonEditorWallDeleteTarget target = targetFor(
                    wallFacts,
                    clusterId,
                    wallMap -> wallMap.wallDeleteResolver().cellDeleteTarget(
                            wallMap.clusterCells(),
                            DungeonEditorCoreWallGeometry.cell(cell)));
            if (target.active()) {
                return target;
            }
        }
        return DungeonEditorWallDeleteTarget.none(0L);
    }

    Set<EdgeKey> cornerRunsForCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        return targetFor(
                wallFacts(snapshot, vertex.level()),
                clusterId,
                wallMap -> wallMap.wallDeleteResolver().cornerDeleteTarget(
                        wallMap.clusterCells(),
                        DungeonEditorCoreWallGeometry.cell(vertex)))
                .edges();
    }

    private DungeonEditorWallDeleteTarget targetFor(
            DungeonEditorCoreWallFactsByLevel wallFacts,
            long clusterId,
            CoreWallTargetSelector selector
    ) {
        DungeonEditorCoreWallFacts wallMap = wallFacts.forCluster(clusterId);
        return DungeonEditorWallDeleteTarget.fromCore(clusterId, selector.select(wallMap));
    }

    private DungeonEditorCoreWallFactsByLevel wallFacts(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            int level
    ) {
        return DungeonEditorCoreWallFactsByLevel.from(snapshot, level, clusterCells);
    }

    @FunctionalInterface
    private interface CoreWallTargetSelector {
        RoomClusterWallDeleteTarget select(DungeonEditorCoreWallFacts wallMap);
    }
}
