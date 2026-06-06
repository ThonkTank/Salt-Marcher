package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryTouch;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class DungeonClusterBoundaryGeometryLogic {

    Map<Integer, List<DungeonClusterBoundary>> filterBoundaries(
            Iterable<DungeonClusterBoundary> boundaries,
            Map<Integer, List<Cell>> cellsByLevel,
            Cell center
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
        return DungeonClusterBoundary.orderedByLevel(filtered);
    }

    @Nullable DungeonClusterBoundary boundaryForEdge(
            Set<Cell> clusterCells,
            Cell center,
            long clusterId,
            Edge edge,
            BoundaryKind kind,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        BoundaryRow materialized = RoomClusterBoundaryMaterialization.forEdge(
                touchingClusterCells(clusterCells, edge),
                center,
                clusterId,
                edge,
                normalizedKind(kind));
        return boundary(materialized, topologyRef);
    }

    @Nullable DungeonClusterBoundary openBoundaryForEdge(
            Set<Cell> clusterCells,
            Cell center,
            long clusterId,
            Edge edge
    ) {
        BoundaryRow materialized = RoomClusterBoundaryMaterialization.openForEdge(
                touchingClusterCells(clusterCells, edge),
                center,
                clusterId,
                edge);
        return boundary(materialized, DungeonTopologyRef.empty());
    }

    private boolean retainsBoundary(DungeonClusterBoundary boundary, DungeonBoundaryTouch touch) {
        if (boundary.isOpen()) {
            return touch.touchesCluster();
        }
        return touch.touchesCluster();
    }

    private DungeonBoundaryTouch touch(Edge edge, Set<Cell> clusterCells) {
        List<Cell> insideCells = insideCells(edge.touchingCells(), clusterCells);
        return new DungeonBoundaryTouch(insideCells);
    }

    private static List<Cell> insideCells(List<Cell> touchingCells, Set<Cell> clusterCells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : touchingCells == null ? List.<Cell>of() : touchingCells) {
            if (clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private static Set<Cell> touchingClusterCells(Set<Cell> clusterCells, @Nullable Edge edge) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : edge == null ? Set.<Cell>of() : edge.touchingCells()) {
            if (cell != null && clusterCells != null && clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static BoundaryKind normalizedKind(@Nullable BoundaryKind kind) {
        return kind == null ? BoundaryKind.WALL : kind;
    }

    private static @Nullable DungeonClusterBoundary boundary(
            @Nullable BoundaryRow materialized,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        if (materialized == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                materialized.clusterId(),
                materialized.level(),
                materialized.relativeCell(),
                materialized.direction(),
                materialized.kind(),
                topologyRef == null ? DungeonTopologyRef.empty() : topologyRef);
    }
}
