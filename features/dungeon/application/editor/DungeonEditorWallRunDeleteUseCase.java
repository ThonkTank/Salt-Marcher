package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteTarget;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorWallRunDeleteUseCase {
    private final DungeonEditorBoundaryClusterCellsHelper clusterCells =
            new DungeonEditorBoundaryClusterCellsHelper();

    ResolvedDelete interiorRunForBoundary(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            features.dungeon.domain.core.geometry.Edge edge
    ) {
        if (edge == null || edge.from() == null) {
            return ResolvedDelete.none(clusterId);
        }
        return targetFor(
                wallFacts(snapshot, edge.from().level()),
                clusterId,
                wallMap -> wallMap.wallDeleteResolver().deleteTarget(
                        wallMap.clusterCells(),
                        DungeonEditorCoreWallGeometry.edge(edge)));
    }

    ResolvedDelete cornerRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            VertexKey vertex
    ) {
        DungeonEditorCoreWallFactsByLevel wallFacts = wallFacts(snapshot, vertex.level());
        for (Long clusterId : wallFacts.clusterIds()) {
            ResolvedDelete target = targetFor(
                    wallFacts,
                    clusterId,
                    wallMap -> wallMap.wallDeleteResolver().cornerDeleteTarget(
                            wallMap.clusterCells(),
                            DungeonEditorCoreWallGeometry.cell(vertex)));
            if (target.active()) {
                return target;
            }
        }
        return ResolvedDelete.none(0L);
    }

    ResolvedDelete cellRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            CellKey cell
    ) {
        DungeonEditorCoreWallFactsByLevel wallFacts = wallFacts(snapshot, cell.level());
        for (Long clusterId : wallFacts.clusterIds()) {
            ResolvedDelete target = targetFor(
                    wallFacts,
                    clusterId,
                    wallMap -> wallMap.wallDeleteResolver().cellDeleteTarget(
                            wallMap.clusterCells(),
                            DungeonEditorCoreWallGeometry.cell(cell)));
            if (target.active()) {
                return target;
            }
        }
        return ResolvedDelete.none(0L);
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

    private ResolvedDelete targetFor(
            DungeonEditorCoreWallFactsByLevel wallFacts,
            long clusterId,
            CoreWallTargetSelector selector
    ) {
        DungeonEditorCoreWallFacts wallMap = wallFacts.forCluster(clusterId);
        return new ResolvedDelete(clusterId, selector.select(wallMap));
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

    record ResolvedDelete(long clusterId, RoomClusterWallDeleteTarget target) {
        ResolvedDelete {
            target = target == null
                    ? new RoomClusterWallDeleteTarget(List.of(), RoomClusterWallDeleteTarget.TargetKind.NONE)
                    : target;
            clusterId = active(target) ? clusterId : 0L;
        }

        static ResolvedDelete none(long clusterId) {
            return new ResolvedDelete(
                    clusterId,
                    new RoomClusterWallDeleteTarget(List.of(), RoomClusterWallDeleteTarget.TargetKind.NONE));
        }

        boolean protectedExterior() {
            return target.isProtectedExterior();
        }

        boolean active() {
            return active(target);
        }

        Set<EdgeKey> edges() {
            Set<EdgeKey> result = new LinkedHashSet<>();
            for (features.dungeon.domain.core.geometry.Edge edge : target.edges()) {
                result.add(DungeonEditorCoreWallGeometry.runtimeEdge(edge));
            }
            return Set.copyOf(result);
        }

        private static boolean active(RoomClusterWallDeleteTarget target) {
            return target.isProtectedExterior() || target.interiorRun();
        }
    }
}
