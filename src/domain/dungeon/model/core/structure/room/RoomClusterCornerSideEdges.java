package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

final class RoomClusterCornerSideEdges {
    private static final int SINGLE_ADJACENT_EDGE = 1;

    private RoomClusterCornerSideEdges() {
    }

    static List<Edge> adjacentWallRunEdges(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Cell corner,
            boolean vertical
    ) {
        Map<EdgeKey, Edge> wallEdges = wallEdgesByKey(boundaries, corner.level(), vertical);
        List<Edge> adjacent = adjacentEdges(wallEdges, corner);
        if (adjacent.size() != SINGLE_ADJACENT_EDGE) {
            return List.of();
        }
        Optional<Cell> next = otherEndpoint(adjacent.getFirst(), corner);
        if (next.isEmpty()) {
            return List.of();
        }
        int step = vertical
                ? Integer.compare(next.orElseThrow().r(), corner.r())
                : Integer.compare(next.orElseThrow().q(), corner.q());
        return step == 0 ? List.of() : contiguousEdges(wallEdges, corner, vertical, step);
    }

    private static Map<EdgeKey, Edge> wallEdgesByKey(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            int level,
            boolean vertical
    ) {
        Map<EdgeKey, Edge> result = new LinkedHashMap<>();
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry
                : (boundaries == null ? Map.<DungeonBoundaryKey, DungeonClusterBoundary>of() : boundaries).entrySet()) {
            DungeonBoundaryKey key = entry.getKey();
            DungeonClusterBoundary boundary = entry.getValue();
            if (wallEdgeAtLevel(key, boundary, level, vertical)) {
                result.put(new EdgeKey(key.lower(), key.upper()), new Edge(key.lower(), key.upper()));
            }
        }
        return Map.copyOf(result);
    }

    private static boolean wallEdgeAtLevel(
            DungeonBoundaryKey key,
            DungeonClusterBoundary boundary,
            int level,
            boolean vertical
    ) {
        return key != null
                && boundary != null
                && boundary.kind() == BoundaryKind.WALL
                && key.lower().level() == level
                && key.upper().level() == level
                && vertical == (key.lower().q() == key.upper().q());
    }

    private static List<Edge> adjacentEdges(Map<EdgeKey, Edge> wallEdges, Cell corner) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : wallEdges.values()) {
            if (edge.from().equals(corner) || edge.to().equals(corner)) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static List<Edge> contiguousEdges(
            Map<EdgeKey, Edge> wallEdges,
            Cell corner,
            boolean vertical,
            int step
    ) {
        List<Edge> result = new ArrayList<>();
        Cell start = corner;
        while (true) {
            Cell end = nextCell(corner, start, vertical, step);
            Edge edge = wallEdges.get(new EdgeKey(start, end));
            if (edge == null) {
                break;
            }
            result.add(edge);
            start = end;
        }
        return List.copyOf(result);
    }

    private static Cell nextCell(Cell corner, Cell start, boolean vertical, int step) {
        return vertical
                ? new Cell(corner.q(), start.r() + step, corner.level())
                : new Cell(start.q() + step, corner.r(), corner.level());
    }

    private static Optional<Cell> otherEndpoint(Edge edge, Cell corner) {
        if (edge.from().equals(corner)) {
            return Optional.of(edge.to());
        }
        if (edge.to().equals(corner)) {
            return Optional.of(edge.from());
        }
        return Optional.empty();
    }
}
