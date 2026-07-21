package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;

final class DungeonBoundaryRehoming {

    private DungeonBoundaryRehoming() {
    }

    static Map<Integer, List<BoundarySegment>> byLevel(
            RoomCluster sourceCluster,
            Map<Integer, List<BoundarySegment>> boundariesByLevel,
            RoomClusterGeometry targetCluster,
            Map<Integer, List<Cell>> targetCellsByLevel
    ) {
        if (sourceCluster == null || targetCluster == null) {
            return Map.of();
        }
        Map<Integer, List<BoundarySegment>> result = new LinkedHashMap<>();
        List<Cell> targetCells = flattenedCells(targetCellsByLevel);
        for (Map.Entry<Integer, List<BoundarySegment>> entry : safeBoundaryMap(boundariesByLevel).entrySet()) {
            List<BoundarySegment> rehomed = rehomedBoundaries(
                    sourceCluster,
                    entry.getValue(),
                    targetCluster,
                    targetCells);
            if (!rehomed.isEmpty()) {
                result.put(entry.getKey(), rehomed);
            }
        }
        return Map.copyOf(result);
    }

    static List<BoundarySegment> flatten(Map<Integer, List<BoundarySegment>> boundariesByLevel) {
        List<BoundarySegment> result = new ArrayList<>();
        for (List<BoundarySegment> boundaries : safeBoundaryMap(boundariesByLevel).values()) {
            for (BoundarySegment boundary : safeBoundaries(boundaries)) {
                result.add(boundary);
            }
        }
        return List.copyOf(result);
    }

    private static List<BoundarySegment> rehomedBoundaries(
            RoomCluster sourceCluster,
            List<BoundarySegment> boundaries,
            RoomClusterGeometry targetCluster,
            List<Cell> targetCells
    ) {
        List<BoundarySegment> result = new ArrayList<>();
        for (BoundarySegment boundary : safeBoundaries(boundaries)) {
            BoundarySegment translated = rehomedBoundary(sourceCluster, boundary, targetCluster, targetCells);
            if (translated != null) {
                result.add(translated);
            }
        }
        return List.copyOf(result);
    }

    private static List<Cell> flattenedCells(Map<Integer, List<Cell>> cellsByLevel) {
        List<Cell> result = new ArrayList<>();
        for (List<Cell> cells : cellsByLevel == null ? List.<List<Cell>>of() : cellsByLevel.values()) {
            for (Cell cell : cells == null ? List.<Cell>of() : cells) {
                if (cell != null) {
                    result.add(cell);
                }
            }
        }
        return List.copyOf(result);
    }

    private static BoundarySegment rehomedBoundary(
            RoomCluster sourceCluster,
            BoundarySegment boundary,
            RoomClusterGeometry targetCluster,
            List<Cell> targetCells
    ) {
        boolean touchesTarget = boundary.edge().touchingCells().stream().anyMatch(targetCells::contains);
        if (!touchesTarget) {
            return null;
        }
        return new BoundarySegment(
                boundary.edgeKey(),
                boundary.kind(),
                boundary.topologyRef());
    }

    private static Map<Integer, List<BoundarySegment>> safeBoundaryMap(
            Map<Integer, List<BoundarySegment>> boundariesByLevel
    ) {
        return boundariesByLevel == null ? Map.of() : boundariesByLevel;
    }

    private static List<BoundarySegment> safeBoundaries(List<BoundarySegment> boundaries) {
        List<BoundarySegment> result = new ArrayList<>();
        for (BoundarySegment boundary : boundaries == null ? List.<BoundarySegment>of() : boundaries) {
            if (boundary != null) {
                result.add(boundary);
            }
        }
        return List.copyOf(result);
    }
}
