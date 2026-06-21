package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class RoomClusterWallRunDelete {
    private RoomClusterWallRunDelete() {
    }

    static List<Edge> authoredWallDeleteEdges(
            Map<EdgeKey, Edge> wallsByKey,
            Iterable<Edge> targetEdges
    ) {
        Set<EdgeKey> targetKeys = new LinkedHashSet<>();
        for (Edge target : targetEdges == null ? List.<Edge>of() : targetEdges) {
            EdgeKey targetKey = RoomClusterWallRunEdges.key(target);
            if (targetKey != null && wallsByKey.containsKey(targetKey)) {
                targetKeys.add(targetKey);
            }
        }
        return RoomClusterWallRunEdges.expanded(wallsByKey, targetKeys);
    }

    static RoomClusterWallDeleteTarget authoredWallDeleteTarget(
            Iterable<Cell> clusterCells,
            Map<EdgeKey, Edge> wallsByKey,
            Edge targetEdge
    ) {
        EdgeKey targetKey = RoomClusterWallRunEdges.key(targetEdge);
        if (targetKey == null || !wallsByKey.containsKey(targetKey)) {
            return RoomClusterWallDeleteTarget.none();
        }
        return classifiedTarget(clusterCells, wallsByKey, Set.of(targetKey));
    }

    static RoomClusterWallDeleteTarget authoredWallCornerDeleteTarget(
            Iterable<Cell> clusterCells,
            Map<EdgeKey, Edge> wallsByKey,
            Cell corner
    ) {
        if (corner == null) {
            return RoomClusterWallDeleteTarget.none();
        }
        Set<EdgeKey> touchingTargets = new LinkedHashSet<>();
        for (EdgeKey edgeKey : wallsByKey.keySet()) {
            if (edgeKey.lower().equals(corner) || edgeKey.upper().equals(corner)) {
                touchingTargets.add(edgeKey);
            }
        }
        if (touchingTargets.isEmpty()) {
            return RoomClusterWallDeleteTarget.none();
        }
        return classifiedTarget(clusterCells, wallsByKey, touchingTargets);
    }

    static RoomClusterWallDeleteTarget authoredWallCellDeleteTarget(
            Iterable<Cell> clusterCells,
            Map<EdgeKey, Edge> wallsByKey,
            Cell cell
    ) {
        if (cell == null) {
            return RoomClusterWallDeleteTarget.none();
        }
        for (Direction direction : Direction.values()) {
            EdgeKey targetKey = EdgeKey.from(Edge.sideOf(cell, direction));
            if (wallsByKey.containsKey(targetKey)) {
                return classifiedTarget(clusterCells, wallsByKey, Set.of(targetKey));
            }
        }
        return RoomClusterWallDeleteTarget.none();
    }

    private static RoomClusterWallDeleteTarget classifiedTarget(
            Iterable<Cell> clusterCells,
            Map<EdgeKey, Edge> wallsByKey,
            Set<EdgeKey> targetKeys
    ) {
        Set<Cell> cells = cellSet(clusterCells);
        Set<EdgeKey> interiorTargets = new LinkedHashSet<>();
        boolean exteriorTarget = false;
        for (EdgeKey targetKey : targetKeys) {
            if (interiorWall(targetKey, cells)) {
                interiorTargets.add(targetKey);
            } else {
                exteriorTarget = true;
            }
        }
        if (!interiorTargets.isEmpty()) {
            return RoomClusterWallDeleteTarget.interior(
                    RoomClusterWallRunEdges.expanded(wallsByKey, interiorTargets));
        }
        return exteriorTarget
                ? RoomClusterWallDeleteTarget.protectedExteriorTarget()
                : RoomClusterWallDeleteTarget.none();
    }

    private static Set<Cell> cellSet(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static boolean interiorWall(EdgeKey key, Set<Cell> cells) {
        if (key == null) {
            return false;
        }
        List<Cell> touchingCells = new Edge(key.lower(), key.upper()).touchingCells();
        return touchingCells.size() == 2
                && cells.contains(touchingCells.getFirst())
                && cells.contains(touchingCells.get(1));
    }
}
