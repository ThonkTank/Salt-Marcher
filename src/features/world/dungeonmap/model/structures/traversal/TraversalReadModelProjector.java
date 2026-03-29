package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class TraversalReadModelProjector {

    private TraversalReadModelProjector() {
        throw new AssertionError("No instances");
    }

    public static List<Corridor> projectCorridors(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId
    ) {
        return project(mapId, traversals, planningInput, Map.of(), segmentIdsByTraversalId, null).corridors();
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId
    ) {
        return project(mapId, traversals, planningInput, traversalPlansByTraversalId, segmentIdsByTraversalId, null);
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId,
            DungeonLayout previousLayout
    ) {
        ArrayList<Corridor> corridors = new ArrayList<>();
        ArrayList<DungeonStair> stairs = new ArrayList<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null) {
                continue;
            }
            TraversalPlan traversalPlan = preserveSegmentIds(
                    traversal,
                    traversalPlan(traversal, planningInput, traversalPlansByTraversalId),
                    traversal == null || traversal.traversalId() == null
                            ? TraversalSegmentIds.empty()
                            : segmentIdsByTraversalId.getOrDefault(traversal.traversalId(), TraversalSegmentIds.empty()),
                    previousLayout);
            for (CorridorTraversalSlice corridorSlice : traversalPlan.corridorSlices()) {
                corridors.add(Corridor.resolved(
                        corridorSlice.segmentKey(),
                        corridorSlice.corridorId(),
                        traversal.traversalId(),
                        mapId,
                        traversal.roomIds(),
                        corridorSlice.path(),
                        corridorSlice.connections()));
            }
            for (TraversalStairSlice stairSlice : traversalPlan.stairSlices()) {
                DungeonStair stair = materializeStair(
                        stairSlice,
                        traversal.traversalId(),
                        mapId);
                if (stair != null) {
                    stairs.add(stair);
                }
            }
        }
        return new TraversalReadModelProjection(List.copyOf(corridors), List.copyOf(stairs));
    }

    public static TraversalPlan preserveSegmentIds(
            Traversal traversal,
            TraversalPlan traversalPlan,
            TraversalSegmentIds segmentIds,
            DungeonLayout previousLayout
    ) {
        if (traversal == null || traversalPlan == null) {
            return TraversalPlan.empty();
        }
        TraversalSegmentIds existingIds = segmentIds == null ? TraversalSegmentIds.empty() : segmentIds;
        LinkedHashMap<String, Long> corridorIdsBySegmentKey = new LinkedHashMap<>(existingIds.corridorIdsBySegmentKey());
        LinkedHashMap<String, Long> stairIdsBySegmentKey = new LinkedHashMap<>(existingIds.stairIdsBySegmentKey());
        if (previousLayout == null || traversal.traversalId() == null) {
            return traversalPlan
                    .withCorridorIds(corridorIdsBySegmentKey)
                    .withStairIds(stairIdsBySegmentKey);
        }
        matchCorridorIds(traversal, traversalPlan, previousLayout, corridorIdsBySegmentKey);
        matchStairIds(traversal, traversalPlan, previousLayout, stairIdsBySegmentKey);
        return traversalPlan
                .withCorridorIds(corridorIdsBySegmentKey)
                .withStairIds(stairIdsBySegmentKey);
    }

    private static TraversalPlan traversalPlan(
            Traversal traversal,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId
    ) {
        if (traversal != null
                && traversal.traversalId() != null
                && traversalPlansByTraversalId != null
                && traversalPlansByTraversalId.containsKey(traversal.traversalId())) {
            return traversalPlansByTraversalId.get(traversal.traversalId());
        }
        if (planningInput == null) {
            return TraversalPlan.empty();
        }
        return features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine.plan(traversal, planningInput);
    }

    private static DungeonStair materializeStair(
            TraversalStairSlice stairSlice,
            Long traversalId,
            long mapId
    ) {
        if (stairSlice == null || stairSlice.placement() == null) {
            return null;
        }
        return stairSlice.placement().materialize(
                stairSlice.stairId(),
                traversalId,
                stairSlice.segmentKey(),
                mapId);
    }

    private static void matchCorridorIds(
            Traversal traversal,
            TraversalPlan traversalPlan,
            DungeonLayout previousLayout,
            Map<String, Long> corridorIdsBySegmentKey
    ) {
        if (traversalPlan.corridorSlices().isEmpty()) {
            return;
        }
        Map<Long, Corridor> unmatchedExistingById = new LinkedHashMap<>();
        for (Corridor corridor : previousLayout.corridors()) {
            if (corridor == null
                    || corridor.corridorId() == null
                    || !Objects.equals(corridor.traversalId(), traversal.traversalId())) {
                continue;
            }
            unmatchedExistingById.put(corridor.corridorId(), corridor);
        }
        unmatchedExistingById.keySet().removeAll(corridorIdsBySegmentKey.values());
        for (CorridorTraversalSlice corridorSlice : traversalPlan.corridorSlices()) {
            if (corridorSlice == null || corridorIdsBySegmentKey.containsKey(corridorSlice.segmentKey())) {
                continue;
            }
            Corridor matched = bestCorridorMatch(corridorSlice, unmatchedExistingById.values());
            if (matched == null || matched.corridorId() == null) {
                continue;
            }
            corridorIdsBySegmentKey.put(corridorSlice.segmentKey(), matched.corridorId());
            unmatchedExistingById.remove(matched.corridorId());
        }
    }

    private static Corridor bestCorridorMatch(
            CorridorTraversalSlice desired,
            java.util.Collection<Corridor> candidates
    ) {
        Corridor desiredCorridor = Corridor.resolved(
                desired.segmentKey(),
                desired.corridorId(),
                null,
                desired.connections().isEmpty() ? 0L : desired.connections().getFirst().mapId(),
                List.of(),
                desired.path(),
                desired.connections());
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
            Traversal traversal,
            TraversalPlan traversalPlan,
            DungeonLayout previousLayout,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        if (traversalPlan.stairSlices().isEmpty()) {
            return;
        }
        Map<Long, DungeonStair> unmatchedExistingById = new LinkedHashMap<>();
        for (DungeonStair stair : previousLayout.stairs()) {
            if (stair == null
                    || stair.stairId() == null
                    || !Objects.equals(stair.traversalId(), traversal.traversalId())) {
                continue;
            }
            unmatchedExistingById.put(stair.stairId(), stair);
        }
        unmatchedExistingById.keySet().removeAll(stairIdsBySegmentKey.values());
        for (TraversalStairSlice stairSlice : traversalPlan.stairSlices()) {
            if (stairSlice == null
                    || stairSlice.placement() == null
                    || stairIdsBySegmentKey.containsKey(stairSlice.segmentKey())) {
                continue;
            }
            DungeonStair matched = bestStairMatch(stairSlice, unmatchedExistingById.values());
            if (matched == null || matched.stairId() == null) {
                continue;
            }
            stairIdsBySegmentKey.put(stairSlice.segmentKey(), matched.stairId());
            unmatchedExistingById.remove(matched.stairId());
        }
    }

    private static DungeonStair bestStairMatch(
            TraversalStairSlice desired,
            java.util.Collection<DungeonStair> candidates
    ) {
        StairSignature desiredSignature = stairSignature(desired.placement());
        ArrayList<StairCandidateScore> matches = new ArrayList<>();
        for (DungeonStair candidate : candidates == null ? List.<DungeonStair>of() : candidates) {
            StairSignature candidateSignature = stairSignature(candidate);
            if (candidateSignature == null
                    || !desiredSignature.exitLevels().equals(candidateSignature.exitLevels())) {
                continue;
            }
            matches.add(new StairCandidateScore(
                    candidate,
                    overlapCount(desiredSignature.exitPositions(), candidateSignature.exitPositions()),
                    overlapCount(desiredSignature.footprint(), candidateSignature.footprint()),
                    desiredSignature.anchor(),
                    candidateSignature.anchor()));
        }
        if (matches.isEmpty()) {
            return null;
        }
        matches.sort(StairCandidateScore.ORDER);
        if (matches.size() > 1 && matches.getFirst().compareIdentity(matches.get(1)) == 0) {
            return null;
        }
        return matches.getFirst().stair();
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

    private static StairSignature stairSignature(TraversalStairPlacement placement) {
        if (placement == null) {
            return null;
        }
        try {
            var geometry = placement.geometry();
            LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
            for (var exit : geometry.exits()) {
                if (exit != null && exit.position() != null) {
                    exitPositions.add(exit.position());
                }
            }
            return new StairSignature(
                    List.copyOf(placement.exitLevels()),
                    placement.anchor() == null ? null : CubePoint.at(placement.anchor(), placement.exitLevels().isEmpty() ? 0 : placement.exitLevels().getFirst()),
                    Set.copyOf(geometry.occupiedPositions()),
                    Set.copyOf(exitPositions));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static StairSignature stairSignature(DungeonStair stair) {
        if (stair == null) {
            return null;
        }
        LinkedHashSet<Integer> exitLevels = new LinkedHashSet<>();
        LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
        for (var exit : stair.exits()) {
            if (exit == null || exit.position() == null) {
                continue;
            }
            exitLevels.add(exit.position().z());
            exitPositions.add(exit.position());
        }
        return new StairSignature(
                List.copyOf(exitLevels),
                anchorOf(stair.occupiedPositions()),
                stair.occupiedPositions(),
                Set.copyOf(exitPositions));
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

    private record StairSignature(
            List<Integer> exitLevels,
            CubePoint anchor,
            Set<CubePoint> footprint,
            Set<CubePoint> exitPositions
    ) {
    }

    private record StairCandidateScore(
            DungeonStair stair,
            int exitOverlap,
            int footprintOverlap,
            CubePoint desiredAnchor,
            CubePoint candidateAnchor
    ) {
        private static final Comparator<StairCandidateScore> ORDER = Comparator
                .comparingInt(StairCandidateScore::exitOverlap).reversed()
                .thenComparingInt(StairCandidateScore::footprintOverlap).reversed()
                .thenComparingInt(score -> anchorDistance(score.desiredAnchor(), score.candidateAnchor()))
                .thenComparing(score -> score.stair().stairId(), Comparator.nullsLast(Long::compareTo));

        private int compareIdentity(StairCandidateScore other) {
            int exitCompare = Integer.compare(other.exitOverlap(), exitOverlap);
            if (exitCompare != 0) {
                return exitCompare;
            }
            int footprintCompare = Integer.compare(other.footprintOverlap(), footprintOverlap);
            if (footprintCompare != 0) {
                return footprintCompare;
            }
            return Integer.compare(
                    anchorDistance(desiredAnchor(), candidateAnchor()),
                    anchorDistance(other.desiredAnchor(), other.candidateAnchor()));
        }
    }

    private static int anchorDistance(CubePoint left, CubePoint right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.x() - right.x())
                + Math.abs(left.y() - right.y())
                + Math.abs(left.z() - right.z());
    }
}
