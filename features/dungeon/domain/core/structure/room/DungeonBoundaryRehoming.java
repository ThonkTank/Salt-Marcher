package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

final class DungeonBoundaryRehoming {

    private DungeonBoundaryRehoming() {
    }

    static Map<Integer, List<DungeonClusterBoundary>> byLevel(
            RoomCluster sourceCluster,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            RoomClusterGeometry targetCluster,
            Map<Integer, List<Cell>> targetCellsByLevel
    ) {
        if (sourceCluster == null || targetCluster == null) {
            return Map.of();
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        List<Cell> targetCells = flattenedCells(targetCellsByLevel);
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : safeBoundaryMap(boundariesByLevel).entrySet()) {
            List<DungeonClusterBoundary> rehomed = rehomedBoundaries(
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

    static List<DungeonClusterBoundary> flatten(Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel) {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries : safeBoundaryMap(boundariesByLevel).values()) {
            for (DungeonClusterBoundary boundary : safeBoundaries(boundaries)) {
                result.add(boundary);
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonClusterBoundary> rehomedBoundaries(
            RoomCluster sourceCluster,
            List<DungeonClusterBoundary> boundaries,
            RoomClusterGeometry targetCluster,
            List<Cell> targetCells
    ) {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : safeBoundaries(boundaries)) {
            DungeonClusterBoundary translated = rehomedBoundary(sourceCluster, boundary, targetCluster, targetCells);
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

    private static @Nullable DungeonClusterBoundary rehomedBoundary(
            RoomCluster sourceCluster,
            DungeonClusterBoundary boundary,
            RoomClusterGeometry targetCluster,
            List<Cell> targetCells
    ) {
        Edge absoluteEdge = boundary.absoluteEdge(sourceCluster.center());
        RoomClusterBoundaryMaterialization.BoundaryRow row = RoomClusterBoundaryMaterialization.forEdge(
                targetCells,
                targetCluster.center(),
                targetCluster.clusterId(),
                absoluteEdge,
                boundary.kind());
        if (row == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                targetCluster.clusterId(),
                row.level(),
                row.relativeCell(),
                row.direction(),
                row.kind(),
                boundary.topologyRef());
    }

    private static Map<Integer, List<DungeonClusterBoundary>> safeBoundaryMap(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return boundariesByLevel == null ? Map.of() : boundariesByLevel;
    }

    private static List<DungeonClusterBoundary> safeBoundaries(List<DungeonClusterBoundary> boundaries) {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary != null) {
                result.add(boundary);
            }
        }
        return List.copyOf(result);
    }
}
