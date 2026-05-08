package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryTouch;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonTopologyRef;

final class DungeonClusterBoundaryGeometryService {

    Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(DungeonRoomCluster cluster) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
            }
        }
        return result;
    }

    Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(Iterable<DungeonClusterBoundary> boundaries) {
        Map<Integer, List<DungeonClusterBoundary>> grouped = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            grouped.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), entry.getValue().stream()
                    .sorted(Comparator
                            .comparingInt((DungeonClusterBoundary boundary) -> boundary.relativeCell().r())
                            .thenComparingInt(boundary -> boundary.relativeCell().q())
                            .thenComparing(boundary -> boundary.direction().name()))
                    .toList());
        }
        return Map.copyOf(result);
    }

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
        return boundariesByLevel(filtered);
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
        List<DungeonCell> touchingCells = DungeonRoomCellProjector.sortedCells(edge.touchingCells());
        if (invalidTouchingCells(touchingCells)) {
            return null;
        }
        List<DungeonCell> insideCells = touchingCells.stream()
                .filter(clusterCells::contains)
                .toList();
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
        List<DungeonCell> insideCells = edge.touchingCells().stream()
                .filter(clusterCells::contains)
                .toList();
        return new DungeonBoundaryTouch(insideCells);
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
