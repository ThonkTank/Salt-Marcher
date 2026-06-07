package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class RoomClusterWallRunDelete {
    private RoomClusterWallRunDelete() {
    }

    static List<Edge> authoredWallDeleteEdges(
            Iterable<Edge> authoredWallEdges,
            Iterable<Edge> targetEdges
    ) {
        Map<EdgeKey, Edge> wallsByKey = keyedEdges(authoredWallEdges);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (Edge target : targetEdges == null ? List.<Edge>of() : targetEdges) {
            EdgeKey targetKey = edgeKey(target);
            if (targetKey != null && wallsByKey.containsKey(targetKey)) {
                result.addAll(maximalStraightRun(targetKey, wallsByKey.keySet()));
            }
        }
        List<Edge> edges = new ArrayList<>();
        for (EdgeKey key : result) {
            edges.add(wallsByKey.get(key));
        }
        return List.copyOf(edges);
    }

    private static Map<EdgeKey, Edge> keyedEdges(Iterable<Edge> edges) {
        Map<EdgeKey, Edge> result = new LinkedHashMap<>();
        for (Edge edge : edges == null ? List.<Edge>of() : edges) {
            EdgeKey key = edgeKey(edge);
            if (key != null) {
                result.putIfAbsent(key, edge);
            }
        }
        return result;
    }

    private static @Nullable EdgeKey edgeKey(@Nullable Edge edge) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return EdgeKey.from(edge);
    }

    private static Set<EdgeKey> maximalStraightRun(EdgeKey target, Set<EdgeKey> walls) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        result.add(target);
        boolean changed;
        do {
            changed = false;
            for (EdgeKey candidate : walls) {
                if (!result.contains(candidate)
                        && sameLine(target, candidate)
                        && attachesAcrossNonCorner(result, candidate, walls)) {
                    result.add(candidate);
                    changed = true;
                }
            }
        } while (changed);
        return result;
    }

    private static boolean attachesAcrossNonCorner(
            Set<EdgeKey> run,
            EdgeKey candidate,
            Set<EdgeKey> walls
    ) {
        for (EdgeKey edge : run) {
            Cell shared = sharedVertex(edge, candidate);
            if (shared != null && !cornerAt(shared, edge, walls)) {
                return true;
            }
        }
        return false;
    }

    private static @Nullable Cell sharedVertex(EdgeKey first, EdgeKey second) {
        Cell firstLower = first.lower();
        Cell firstUpper = first.upper();
        if (firstLower.equals(second.lower()) || firstLower.equals(second.upper())) {
            return first.lower();
        }
        if (firstUpper.equals(second.lower()) || firstUpper.equals(second.upper())) {
            return first.upper();
        }
        return null;
    }

    private static boolean cornerAt(Cell vertex, EdgeKey reference, Set<EdgeKey> walls) {
        for (EdgeKey edge : walls) {
            boolean touchesVertex = edge.lower().equals(vertex) || edge.upper().equals(vertex);
            if (!edge.equals(reference) && touchesVertex && !sameLine(reference, edge)) {
                return true;
            }
        }
        return false;
    }

    private static boolean sameLine(EdgeKey first, EdgeKey second) {
        boolean firstHorizontal = first.lower().level() == first.upper().level()
                && first.lower().r() == first.upper().r();
        boolean secondHorizontal = second.lower().level() == second.upper().level()
                && second.lower().r() == second.upper().r();
        boolean firstVertical = first.lower().level() == first.upper().level()
                && first.lower().q() == first.upper().q();
        boolean secondVertical = second.lower().level() == second.upper().level()
                && second.lower().q() == second.upper().q();
        return firstHorizontal && secondHorizontal && first.lower().r() == second.lower().r()
                || firstVertical && secondVertical && first.lower().q() == second.lower().q();
    }
}
