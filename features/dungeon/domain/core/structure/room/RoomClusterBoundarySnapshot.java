package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class RoomClusterBoundarySnapshot {
    private final BoundaryMap boundaries;

    RoomClusterBoundarySnapshot(BoundaryMap boundaries) {
        this.boundaries = boundaries == null ? new BoundaryMap(List.of()) : boundaries;
    }

    Map<DungeonBoundaryKey, BoundarySegment> boundaryMap() {
        Map<DungeonBoundaryKey, BoundarySegment> result = new LinkedHashMap<>();
        for (BoundarySegment boundary : boundaries.segments()) {
            result.putIfAbsent(DungeonBoundaryKey.from(boundary.edge()), boundary);
        }
        return Collections.unmodifiableMap(result);
    }

    List<BoundarySegment> orderedBoundaries() {
        return boundaries.segments();
    }

    Set<Integer> boundaryLevels() {
        Set<Integer> levels = new LinkedHashSet<>();
        boundaries.segments().forEach(boundary -> levels.add(boundary.level()));
        return Collections.unmodifiableSet(levels);
    }

    Map<Integer, List<Edge>> closedBoundaryEdgesByLevel() {
        Map<Integer, List<Edge>> mutable = new LinkedHashMap<>();
        for (BoundarySegment boundary : boundaries.segments()) {
            if (!boundary.isOpen()) {
                mutable.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary.edge());
            }
        }
        Map<Integer, List<Edge>> result = new LinkedHashMap<>();
        mutable.forEach((level, edges) -> result.put(level, List.copyOf(edges)));
        return Map.copyOf(result);
    }

    List<Cell> authoredBoundaryVertices(int level) {
        return RoomClusterBoundaryVertices.authored(boundaries, level);
    }

    List<RoomClusterWallRun> authoredWallRuns(int level, Iterable<Cell> memberCells) {
        return RoomClusterWallRuns.authoredWallRuns(boundaries, memberCells, level);
    }
}
