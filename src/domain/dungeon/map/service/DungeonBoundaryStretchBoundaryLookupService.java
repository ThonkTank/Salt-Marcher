package src.domain.dungeon.map.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.BoundaryVertex;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchOrientation;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchSelection;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;

final class DungeonBoundaryStretchBoundaryLookupService {

    boolean innerStretchCanMove(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            StretchSelection stretch
    ) {
        List<BoundaryVertex> vertices = stretch.vertices();
        for (int index = 1; index < vertices.size() - 1; index++) {
            if (hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), vertices.get(index), stretch.orientation())) {
                return false;
            }
        }
        return true;
    }

    boolean hasPerpendicularBoundary(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            BoundaryVertex vertex,
            StretchOrientation sourceOrientation
    ) {
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaries.entrySet()) {
            if (sourceKeys.contains(entry.getKey())) {
                continue;
            }
            if (sourceOrientation.perpendicularTo(StretchOrientation.from(entry.getKey()))
                    && touches(entry.getKey(), vertex)) {
                return true;
            }
        }
        return false;
    }

    boolean touchesOuterBoundary(Set<DungeonCell> clusterCells, BoundaryVertex vertex) {
        for (DungeonCell cell : clusterCells) {
            for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                DungeonCell neighbor = direction.neighborOf(cell);
                if (clusterCells.contains(neighbor)) {
                    continue;
                }
                if (touches(DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)), vertex)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean touches(DungeonBoundaryKey key, BoundaryVertex vertex) {
        return sameVertex(key.lower(), vertex) || sameVertex(key.upper(), vertex);
    }

    private boolean sameVertex(DungeonCell cell, BoundaryVertex vertex) {
        return cell != null
                && vertex != null
                && cell.q() == vertex.q()
                && cell.r() == vertex.r()
                && cell.level() == vertex.level();
    }
}
