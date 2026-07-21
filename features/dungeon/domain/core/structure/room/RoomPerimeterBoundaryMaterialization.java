package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.component.boundary.BoundaryKind;

final class RoomPerimeterBoundaryMaterialization {

    private RoomPerimeterBoundaryMaterialization() {
    }

    static Map<Integer, List<BoundarySegment>> fromFloorCells(
            RoomCluster cluster,
            Iterable<Cell> currentCells,
            Map<Integer, List<BoundarySegment>> preservedBoundariesByLevel
    ) {
        Map<DungeonBoundaryKey, BoundarySegment> boundariesByKey = preservedByKey(cluster, preservedBoundariesByLevel);
        for (BoundarySegment boundary : perimeterWallBoundaries(cluster, currentCells)) {
            boundariesByKey.putIfAbsent(DungeonBoundaryKey.from(boundary.edge()), boundary);
        }
        return BoundarySegment.orderedByLevel(boundariesByKey.values());
    }

    private static Map<DungeonBoundaryKey, BoundarySegment> preservedByKey(
            RoomCluster cluster,
            Map<Integer, List<BoundarySegment>> preservedBoundariesByLevel
    ) {
        Map<DungeonBoundaryKey, BoundarySegment> result = new LinkedHashMap<>();
        for (List<BoundarySegment> boundaries : safeBoundaries(preservedBoundariesByLevel).values()) {
            for (BoundarySegment boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.edge()), boundary);
            }
        }
        return result;
    }

    private static List<BoundarySegment> perimeterWallBoundaries(
            RoomCluster cluster,
            Iterable<Cell> currentCells
    ) {
        Set<Cell> cells = normalizedCells(currentCells);
        List<BoundarySegment> result = new ArrayList<>();
        for (Cell cell : RoomClusterCells.sortedCells(cells)) {
            addMissingCellBoundaries(result, cluster, cells, cell);
        }
        return List.copyOf(result);
    }

    private static void addMissingCellBoundaries(
            List<BoundarySegment> result,
            RoomCluster cluster,
            Set<Cell> cells,
            Cell cell
    ) {
        for (Direction direction : Direction.values()) {
            if (!cells.contains(direction.neighborOf(cell))) {
                addBoundary(result, cluster, cells, cell, direction);
            }
        }
    }

    private static void addBoundary(
            List<BoundarySegment> result,
            RoomCluster cluster,
            Set<Cell> cells,
            Cell cell,
            Direction direction
    ) {
        result.add(BoundarySegment.fromEdge(
                Edge.sideOf(cell, direction),
                BoundaryKind.WALL,
                features.dungeon.domain.core.graph.DungeonTopologyRef.empty()));
    }

    private static Set<Cell> normalizedCells(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, List<BoundarySegment>> safeBoundaries(
            Map<Integer, List<BoundarySegment>> boundariesByLevel
    ) {
        return boundariesByLevel == null ? Map.of() : boundariesByLevel;
    }
}
