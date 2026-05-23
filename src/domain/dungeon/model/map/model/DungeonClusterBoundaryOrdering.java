package src.domain.dungeon.model.map.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonClusterBoundaryOrdering {

    private DungeonClusterBoundaryOrdering() {
    }

    static Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(DungeonRoomCluster cluster) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
            }
        }
        return result;
    }

    static Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(Iterable<DungeonClusterBoundary> boundaries) {
        Map<Integer, List<DungeonClusterBoundary>> grouped = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            List<DungeonClusterBoundary> levelBoundaries = grouped.get(boundary.level());
            if (levelBoundaries == null) {
                levelBoundaries = new ArrayList<>();
                grouped.put(boundary.level(), levelBoundaries);
            }
            levelBoundaries.add(boundary);
        }
        return sortedBoundariesByLevel(grouped);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> sortedBoundariesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> grouped
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : grouped.entrySet()) {
            List<DungeonClusterBoundary> sorted = new ArrayList<>(entry.getValue());
            sorted.sort(new BoundaryComparator());
            result.put(entry.getKey(), List.copyOf(sorted));
        }
        return Map.copyOf(result);
    }

    private static final class BoundaryComparator implements Comparator<DungeonClusterBoundary>, Serializable {
        @Serial
        private static final long serialVersionUID = 1L;

        @Override
        public int compare(DungeonClusterBoundary left, DungeonClusterBoundary right) {
            int rowComparison = Integer.compare(left.relativeCell().r(), right.relativeCell().r());
            if (rowComparison != 0) {
                return rowComparison;
            }
            int columnComparison = Integer.compare(left.relativeCell().q(), right.relativeCell().q());
            if (columnComparison != 0) {
                return columnComparison;
            }
            return left.direction().name().compareTo(right.direction().name());
        }
    }
}
