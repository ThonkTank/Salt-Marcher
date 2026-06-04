package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonClusterBoundaryGeometryLogic {

    private static final DungeonClusterBoundaryMaterializationAdapter BOUNDARY_MATERIALIZATION =
            new DungeonClusterBoundaryMaterializationAdapter();

    Map<Integer, List<DungeonClusterBoundary>> filterBoundaries(
            Iterable<DungeonClusterBoundary> boundaries,
            Map<Integer, List<DungeonCell>> cellsByLevel,
            DungeonCell center
    ) {
        List<DungeonClusterBoundary> filtered = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            DungeonBoundaryTouch touch = touch(
                    boundary.absoluteEdge(center),
                    new LinkedHashSet<>(cellsByLevel.getOrDefault(boundary.level(), List.of())));
            if (retainsBoundary(boundary, touch)) {
                filtered.add(boundary);
            }
        }
        return DungeonClusterBoundaryOrdering.boundariesByLevel(filtered);
    }

    @Nullable DungeonClusterBoundary boundaryForEdge(
            Set<DungeonCell> clusterCells,
            DungeonCell center,
            long clusterId,
            DungeonEdge edge,
            DungeonClusterBoundaryKind kind,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        DungeonClusterBoundaryMaterializationAdapter.ClusterBoundaryMaterialization materialization =
                BOUNDARY_MATERIALIZATION.prepare(clusterCells, center, clusterId);
        return materialization.materializeBoundary(
                edge,
                kind,
                topologyRef);
    }

    @Nullable DungeonClusterBoundary openBoundaryForEdge(
            Set<DungeonCell> clusterCells,
            DungeonCell center,
            long clusterId,
            DungeonEdge edge
    ) {
        DungeonClusterBoundaryMaterializationAdapter.ClusterBoundaryMaterialization materialization =
                BOUNDARY_MATERIALIZATION.prepare(clusterCells, center, clusterId);
        return materialization.materializeOpenBoundary(
                edge);
    }

    private boolean retainsBoundary(DungeonClusterBoundary boundary, DungeonBoundaryTouch touch) {
        if (boundary.isOpen()) {
            return touch.touchesCluster();
        }
        return touch.touchesCluster();
    }

    private DungeonBoundaryTouch touch(DungeonEdge edge, Set<DungeonCell> clusterCells) {
        List<DungeonCell> insideCells = insideCells(edge.touchingCells(), clusterCells);
        return new DungeonBoundaryTouch(insideCells);
    }

    private static List<DungeonCell> insideCells(List<DungeonCell> touchingCells, Set<DungeonCell> clusterCells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : touchingCells == null ? List.<DungeonCell>of() : touchingCells) {
            if (clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }
}
