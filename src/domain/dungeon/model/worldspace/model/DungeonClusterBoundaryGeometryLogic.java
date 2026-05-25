package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonClusterBoundaryGeometryLogic {

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
        if (invalidBoundaryEdge(edge)) {
            return null;
        }
        List<DungeonCell> touchingCells = DungeonCellOrdering.sortedCells(edge.touchingCells());
        if (invalidTouchingCells(touchingCells)) {
            return null;
        }
        List<DungeonCell> insideCells = insideCells(touchingCells, clusterCells);
        if (!supportsBoundaryKind(kind, insideCells)) {
            return null;
        }
        DungeonCell baseCell = insideCells.getFirst();
        DungeonEdgeDirection direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                clusterId,
                baseCell.level(),
                new DungeonCell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind,
                topologyRef == null ? DungeonTopologyRef.empty() : topologyRef);
    }

    private boolean retainsBoundary(DungeonClusterBoundary boundary, DungeonBoundaryTouch touch) {
        return touch.touchesCluster()
                && (boundary.kind() == DungeonClusterBoundaryKind.DOOR || touch.hasTwoInsideCells());
    }

    private boolean invalidBoundaryEdge(DungeonEdge edge) {
        return edge == null || edge.from() == null || edge.to() == null;
    }

    private boolean invalidTouchingCells(List<DungeonCell> touchingCells) {
        return touchingCells.size() != 2 || touchingCells.getFirst().level() != touchingCells.get(1).level();
    }

    private boolean supportsBoundaryKind(DungeonClusterBoundaryKind kind, List<DungeonCell> insideCells) {
        if (insideCells.isEmpty()) {
            return false;
        }
        if (kind == DungeonClusterBoundaryKind.DOOR) {
            return insideCells.size() <= 2;
        }
        return insideCells.size() == 2;
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

    private @Nullable DungeonEdgeDirection directionFrom(DungeonCell cell, DungeonEdge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }
}
