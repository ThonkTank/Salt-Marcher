package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairIdentityMatcher;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class TraversalSegmentIdentityMatcher {

    private TraversalSegmentIdentityMatcher() {
        throw new AssertionError("No instances");
    }

    public static TraversalRoute preserveSegmentIds(
            Traversal traversal,
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout
    ) {
        if (traversal == null || traversalRoute == null) {
            return TraversalRoute.empty();
        }
        TraversalSegmentRefs existingRefs = existingRefs(traversal, previousLayout);
        LinkedHashMap<String, Long> corridorIdsBySegmentKey = new LinkedHashMap<>(existingRefs.corridorIdsBySegmentKey());
        LinkedHashMap<String, Long> stairIdsBySegmentKey = new LinkedHashMap<>(existingRefs.stairIdsBySegmentKey());
        if (previousLayout == null || traversal.traversalId() == null) {
            return traversalRoute
                    .withCorridorIds(corridorIdsBySegmentKey)
                    .withStairIds(stairIdsBySegmentKey);
        }
        matchCorridorIds(traversalRoute, previousLayout, existingRefs, corridorIdsBySegmentKey);
        matchStairIds(traversalRoute, previousLayout, existingRefs, stairIdsBySegmentKey);
        return traversalRoute
                .withCorridorIds(corridorIdsBySegmentKey)
                .withStairIds(stairIdsBySegmentKey);
    }

    private static TraversalSegmentRefs existingRefs(Traversal traversal, DungeonLayout previousLayout) {
        if (traversal == null) {
            return TraversalSegmentRefs.empty();
        }
        if (!traversal.segmentRefs().refsBySegmentKey().isEmpty()) {
            return traversal.segmentRefs();
        }
        if (previousLayout == null || traversal.traversalId() == null) {
            return TraversalSegmentRefs.empty();
        }
        Traversal previousTraversal = previousLayout.findTraversal(traversal.traversalId());
        LinkedHashMap<String, TraversalSegmentRef> refsBySegmentKey = new LinkedHashMap<>();
        if (previousTraversal != null && !previousTraversal.segmentRefs().refsBySegmentKey().isEmpty()) {
            for (Map.Entry<String, TraversalSegmentRef> entry : previousTraversal.segmentRefs().refsBySegmentKey().entrySet()) {
                if (entry.getValue() != null && entry.getValue().structureId() != null) {
                    refsBySegmentKey.putIfAbsent(entry.getKey(), entry.getValue());
                }
            }
        }
        return refsBySegmentKey.isEmpty() ? TraversalSegmentRefs.empty() : new TraversalSegmentRefs(refsBySegmentKey);
    }

    private static void matchCorridorIds(
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout,
            TraversalSegmentRefs existingRefs,
            Map<String, Long> corridorIdsBySegmentKey
    ) {
        if (traversalRoute.corridorSegments().isEmpty()) {
            return;
        }
        Map<Long, Corridor> unmatchedExistingById = new LinkedHashMap<>();
        for (Long corridorId : existingRefs.corridorIdsBySegmentKey().values()) {
            Corridor corridor = previousLayout.findCorridor(corridorId);
            if (corridor != null && corridor.corridorId() != null) {
                unmatchedExistingById.put(corridor.corridorId(), corridor);
            }
        }
        unmatchedExistingById.keySet().removeAll(corridorIdsBySegmentKey.values());
        for (TraversalRoute.CorridorSegment corridorSegment : traversalRoute.corridorSegments()) {
            if (corridorSegment == null
                    || corridorSegment.corridor() == null
                    || corridorIdsBySegmentKey.containsKey(corridorSegment.segmentKey())) {
                continue;
            }
            Corridor matched = bestCorridorMatch(corridorSegment.corridor(), unmatchedExistingById.values());
            if (matched == null || matched.corridorId() == null) {
                continue;
            }
            corridorIdsBySegmentKey.put(corridorSegment.segmentKey(), matched.corridorId());
            unmatchedExistingById.remove(matched.corridorId());
        }
    }

    private static Corridor bestCorridorMatch(
            Corridor desiredCorridor,
            java.util.Collection<Corridor> candidates
    ) {
        CorridorSignature desiredSignature = corridorSignature(desiredCorridor);
        ArrayList<CorridorCandidateScore> matches = new ArrayList<>();
        for (Corridor candidate : candidates == null ? List.<Corridor>of() : candidates) {
            CorridorSignature candidateSignature = corridorSignature(candidate);
            if (!desiredSignature.endpointKeys().equals(candidateSignature.endpointKeys())
                    || !desiredSignature.levels().equals(candidateSignature.levels())
                    || desiredSignature.connectionCount() != candidateSignature.connectionCount()) {
                continue;
            }
            matches.add(new CorridorCandidateScore(
                    candidate,
                    overlapCount(desiredSignature.cells(), candidateSignature.cells()),
                    desiredSignature.cells().size(),
                    candidateSignature.cells().size(),
                    desiredSignature.anchor(),
                    candidateSignature.anchor()));
        }
        if (matches.isEmpty()) {
            return null;
        }
        matches.sort(CorridorCandidateScore.ORDER);
        if (matches.size() > 1 && matches.getFirst().compareIdentity(matches.get(1)) == 0) {
            return null;
        }
        return matches.getFirst().corridor();
    }

    private static void matchStairIds(
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout,
            TraversalSegmentRefs existingRefs,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        if (traversalRoute.stairSegments().isEmpty()) {
            return;
        }
        Map<Long, DungeonStair> unmatchedExistingById = new LinkedHashMap<>();
        for (Long stairId : existingRefs.stairIdsBySegmentKey().values()) {
            DungeonStair stair = previousLayout.findStair(stairId);
            if (stair != null && stair.stairId() != null) {
                unmatchedExistingById.put(stair.stairId(), stair);
            }
        }
        unmatchedExistingById.keySet().removeAll(stairIdsBySegmentKey.values());
        for (TraversalRoute.StairSegment stairSegment : traversalRoute.stairSegments()) {
            if (stairSegment == null
                    || stairSegment.stair() == null
                    || stairIdsBySegmentKey.containsKey(stairSegment.segmentKey())) {
                continue;
            }
            DungeonStair matched = DungeonStairIdentityMatcher.bestMatch(
                    stairSegment.stair(),
                    unmatchedExistingById.values());
            if (matched == null || matched.stairId() == null) {
                continue;
            }
            stairIdsBySegmentKey.put(stairSegment.segmentKey(), matched.stairId());
            unmatchedExistingById.remove(matched.stairId());
        }
    }

    private static CorridorSignature corridorSignature(Corridor corridor) {
        if (corridor == null) {
            return new CorridorSignature(List.of(), Set.of(), 0, null, Set.of());
        }
        LinkedHashSet<String> endpointKeys = new LinkedHashSet<>();
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (CorridorConnection connection : corridor.connections()) {
            if (connection == null) {
                continue;
            }
            levels.add(connection.levelZ());
            for (ConnectionEndpoint endpoint : connection.endpoints()) {
                if (endpoint == null
                        || endpoint.type() == null
                        || endpoint.type() == ConnectionEndpointType.CORRIDOR
                        || endpoint.id() == null) {
                    continue;
                }
                endpointKeys.add(endpoint.type().name() + ":" + endpoint.id());
            }
        }
        Set<CubePoint> cells = corridor.path() == null ? Set.of() : corridor.path().cells();
        return new CorridorSignature(
                List.copyOf(endpointKeys),
                Set.copyOf(levels),
                corridor.connections().size(),
                anchorOf(cells),
                cells);
    }

    private static int overlapCount(Set<CubePoint> left, Set<CubePoint> right) {
        if (left == null || right == null || left.isEmpty() || right.isEmpty()) {
            return 0;
        }
        int result = 0;
        for (CubePoint point : left) {
            if (right.contains(point)) {
                result++;
            }
        }
        return result;
    }

    private static CubePoint anchorOf(Set<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return null;
        }
        return cells.stream()
                .filter(Objects::nonNull)
                .min(CubePoint.POINT_ORDER)
                .orElse(null);
    }

    private static int anchorDistance(CubePoint left, CubePoint right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.x() - right.x())
                + Math.abs(left.y() - right.y())
                + Math.abs(left.z() - right.z());
    }

    private record CorridorSignature(
            List<String> endpointKeys,
            Set<Integer> levels,
            int connectionCount,
            CubePoint anchor,
            Set<CubePoint> cells
    ) {
    }

    private record CorridorCandidateScore(
            Corridor corridor,
            int pathOverlap,
            int desiredCellCount,
            int candidateCellCount,
            CubePoint desiredAnchor,
            CubePoint candidateAnchor
    ) {
        private static final Comparator<CorridorCandidateScore> ORDER = Comparator
                .comparingInt(CorridorCandidateScore::pathOverlap).reversed()
                .thenComparingInt(score -> Math.abs(score.desiredCellCount() - score.candidateCellCount()))
                .thenComparingInt(score -> anchorDistance(score.desiredAnchor(), score.candidateAnchor()))
                .thenComparing(score -> score.corridor().corridorId(), Comparator.nullsLast(Long::compareTo));

        private int compareIdentity(CorridorCandidateScore other) {
            int pathCompare = Integer.compare(other.pathOverlap(), pathOverlap);
            if (pathCompare != 0) {
                return pathCompare;
            }
            int cellCountCompare = Integer.compare(
                    Math.abs(desiredCellCount() - candidateCellCount()),
                    Math.abs(other.desiredCellCount() - other.candidateCellCount()));
            if (cellCountCompare != 0) {
                return cellCountCompare;
            }
            return Integer.compare(
                    anchorDistance(desiredAnchor(), candidateAnchor()),
                    anchorDistance(other.desiredAnchor(), other.candidateAnchor()));
        }
    }
}
