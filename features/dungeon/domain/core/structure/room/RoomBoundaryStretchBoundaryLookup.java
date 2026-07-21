package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.BoundaryVertex;

final class RoomBoundaryStretchBoundaryLookup {

    boolean hasPerpendicularBoundary(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            BoundaryVertex vertex,
            BoundaryStretchOrientation sourceOrientation
    ) {
        return hasPerpendicularBoundaryIgnoring(boundaries, sourceKeys, Set.of(), vertex, sourceOrientation);
    }

    boolean hasPerpendicularBoundaryOutsidePath(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            Set<DungeonBoundaryKey> pathKeys,
            BoundaryVertex vertex,
            BoundaryStretchOrientation sourceOrientation
    ) {
        return hasPerpendicularBoundaryIgnoring(boundaries, sourceKeys, pathKeys, vertex, sourceOrientation);
    }

    private boolean hasPerpendicularBoundaryIgnoring(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            Set<DungeonBoundaryKey> ignoredKeys,
            BoundaryVertex vertex,
            BoundaryStretchOrientation sourceOrientation
    ) {
        Set<DungeonBoundaryKey> safeIgnoredKeys = ignoredKeys == null ? Set.of() : ignoredKeys;
        for (Map.Entry<DungeonBoundaryKey, BoundarySegment> entry : boundaries.entrySet()) {
            if (sourceKeys.contains(entry.getKey()) || safeIgnoredKeys.contains(entry.getKey())) {
                continue;
            }
            if (sourceOrientation.perpendicularTo(RoomBoundaryStretchValues.orientationOf(entry.getKey()))
                    && touches(entry.getKey(), vertex)) {
                return true;
            }
        }
        return false;
    }

    boolean touchesOuterBoundary(Set<Cell> clusterCells, BoundaryVertex vertex) {
        for (Cell cell : clusterCells) {
            for (Direction direction : Direction.values()) {
                Cell neighbor = direction.neighborOf(cell);
                if (clusterCells.contains(neighbor)) {
                    continue;
                }
                if (touches(DungeonBoundaryKey.from(Edge.sideOf(cell, direction)), vertex)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean touches(DungeonBoundaryKey key, BoundaryVertex vertex) {
        return sameVertex(key.lower(), vertex) || sameVertex(key.upper(), vertex);
    }

    private boolean sameVertex(Cell cell, BoundaryVertex vertex) {
        return cell != null
                && vertex != null
                && cell.q() == vertex.q()
                && cell.r() == vertex.r()
                && cell.level() == vertex.level();
    }
}
