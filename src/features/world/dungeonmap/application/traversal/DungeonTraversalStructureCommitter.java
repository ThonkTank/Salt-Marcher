package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalCorridorSegmentWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalStairSegmentWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalStructureCommitter {

    private final DungeonTraversalCorridorSegmentWriteRepository corridorSegmentWriteRepository;
    private final DungeonTraversalStairSegmentWriteRepository stairSegmentWriteRepository;
    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonTraversalStructureCommitter(
            DungeonTraversalCorridorSegmentWriteRepository corridorSegmentWriteRepository,
            DungeonTraversalStairSegmentWriteRepository stairSegmentWriteRepository,
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.corridorSegmentWriteRepository = Objects.requireNonNull(corridorSegmentWriteRepository, "corridorSegmentWriteRepository");
        this.stairSegmentWriteRepository = Objects.requireNonNull(stairSegmentWriteRepository, "stairSegmentWriteRepository");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public TraversalSegmentRefs persistStructures(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return TraversalSegmentRefs.empty();
        }
        TraversalSegmentRefs existingRefs = existingRefs(previousLayout, traversal);
        TraversalRoute resolvedRoute = resolveRoute(traversal, traversalRoute, previousLayout, existingRefs);
        Map<String, Long> corridorIdsBySegmentKey = persistCorridorSegments(conn, traversal, resolvedRoute, existingRefs);
        Map<String, Long> stairIdsBySegmentKey = persistStairSegments(conn, traversal, resolvedRoute, existingRefs);
        return TraversalSegmentRefs.ofCorridorAndStairIds(corridorIdsBySegmentKey, stairIdsBySegmentKey);
    }

    public void deleteStructuresForTraversal(Connection conn, long traversalId) throws SQLException {
        for (Long corridorId : corridorSegmentWriteRepository.deleteTraversalSegments(conn, traversalId)) {
            if (corridorId != null) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
        for (Long stairId : stairSegmentWriteRepository.deleteTraversalSegments(conn, traversalId)) {
            if (stairId != null) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
    }

    private Map<String, Long> persistCorridorSegments(
            Connection conn,
            Traversal traversal,
            TraversalRoute traversalRoute,
            TraversalSegmentRefs existingRefs
    ) throws SQLException {
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        Set<Long> reusableIds = new LinkedHashSet<>(existingRefs.corridorIdsBySegmentKey().values());
        for (TraversalRoute.CorridorSegment corridorSegment : traversalRoute.corridorSegments()) {
            if (corridorSegment == null || corridorSegment.corridor() == null) {
                continue;
            }
            Corridor corridor = corridorSegment.corridor();
            Long corridorId = corridor.corridorId();
            if (corridorId == null || !reusableIds.contains(corridorId)) {
                corridorId = corridorWriteRepository.insertCorridor(conn, traversal.mapId(), corridor);
            } else {
                corridorWriteRepository.updateCorridor(conn, corridorId, corridor);
            }
            corridorWriteRepository.replacePathNodes(conn, corridorId, corridor.path());
            corridorWriteRepository.replaceConnections(conn, corridorId, corridor.connections());
            desiredSegmentRefs.put(corridorSegment.segmentKey(), corridorId);
        }
        List<Long> removedCorridorIds = corridorSegmentWriteRepository.replaceTraversalSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long corridorId : removedCorridorIds) {
            if (corridorId != null) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
        return desiredSegmentRefs.isEmpty() ? Map.of() : Map.copyOf(desiredSegmentRefs);
    }

    private Map<String, Long> persistStairSegments(
            Connection conn,
            Traversal traversal,
            TraversalRoute traversalRoute,
            TraversalSegmentRefs existingRefs
    ) throws SQLException {
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        Set<Long> reusableIds = new LinkedHashSet<>(existingRefs.stairIdsBySegmentKey().values());
        for (TraversalRoute.StairSegment stairSegment : traversalRoute.stairSegments()) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSegment.stair();
            Long stairId = stair.stairId();
            if (stairId == null || !reusableIds.contains(stairId)) {
                stairId = stairWriteRepository.insertStair(conn, traversal.mapId(), stair);
            } else {
                stairWriteRepository.updateStair(conn, stairId, stair);
            }
            stairWriteRepository.replacePathNodes(conn, stairId, stair.path());
            stairWriteRepository.replaceExits(conn, stairId, stair.exits());
            desiredSegmentRefs.put(stairSegment.segmentKey(), stairId);
        }
        List<Long> removedStairIds = stairSegmentWriteRepository.replaceTraversalSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long stairId : removedStairIds) {
            if (stairId != null) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
        return desiredSegmentRefs.isEmpty() ? Map.of() : Map.copyOf(desiredSegmentRefs);
    }

    private static TraversalRoute resolveRoute(
            Traversal traversal,
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout,
            TraversalSegmentRefs existingRefs
    ) {
        TraversalRoute resolvedRoute = traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
        if (traversal == null) {
            return resolvedRoute;
        }
        LinkedHashMap<String, Long> corridorIdsBySegmentKey = new LinkedHashMap<>(existingRefs.corridorIdsBySegmentKey());
        LinkedHashMap<String, Long> stairIdsBySegmentKey = new LinkedHashMap<>(existingRefs.stairIdsBySegmentKey());
        if (previousLayout != null && traversal.traversalId() != null) {
            matchCorridorContinuations(resolvedRoute, previousLayout, existingRefs, corridorIdsBySegmentKey);
            matchStairContinuations(resolvedRoute, previousLayout, existingRefs, stairIdsBySegmentKey);
        }
        return resolvedRoute.withAppliedSegmentIds(
                TraversalSegmentRefs.ofCorridorAndStairIds(corridorIdsBySegmentKey, stairIdsBySegmentKey));
    }

    private static TraversalSegmentRefs existingRefs(DungeonLayout previousLayout, Traversal traversal) {
        if (traversal == null) {
            return TraversalSegmentRefs.empty();
        }
        if (!traversal.segmentRefs().isEmpty()) {
            return traversal.segmentRefs();
        }
        if (previousLayout == null || traversal.traversalId() == null) {
            return TraversalSegmentRefs.empty();
        }
        Traversal previousTraversal = previousLayout.findTraversal(traversal.traversalId());
        return previousTraversal == null ? TraversalSegmentRefs.empty() : previousTraversal.segmentRefs();
    }

    private static void matchCorridorContinuations(
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout,
            TraversalSegmentRefs existingRefs,
            Map<String, Long> corridorIdsBySegmentKey
    ) {
        if (traversalRoute == null || traversalRoute.corridorSegments().isEmpty()) {
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
            Corridor matched = bestCorridorContinuation(corridorSegment.corridor(), unmatchedExistingById.values());
            if (matched == null || matched.corridorId() == null) {
                continue;
            }
            corridorIdsBySegmentKey.put(corridorSegment.segmentKey(), matched.corridorId());
            unmatchedExistingById.remove(matched.corridorId());
        }
    }

    private static Corridor bestCorridorContinuation(
            Corridor desiredCorridor,
            Collection<Corridor> candidates
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

    private static void matchStairContinuations(
            TraversalRoute traversalRoute,
            DungeonLayout previousLayout,
            TraversalSegmentRefs existingRefs,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        if (traversalRoute == null || traversalRoute.stairSegments().isEmpty()) {
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
            DungeonStair matched = bestStairContinuation(stairSegment.stair(), unmatchedExistingById.values());
            if (matched == null || matched.stairId() == null) {
                continue;
            }
            stairIdsBySegmentKey.put(stairSegment.segmentKey(), matched.stairId());
            unmatchedExistingById.remove(matched.stairId());
        }
    }

    private static DungeonStair bestStairContinuation(
            DungeonStair desiredStair,
            Collection<DungeonStair> candidates
    ) {
        StairSignature desiredSignature = stairSignature(desiredStair);
        if (desiredSignature == null) {
            return null;
        }
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

    private static StairSignature stairSignature(DungeonStair stair) {
        if (stair == null) {
            return null;
        }
        LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
        for (DungeonStairExit exit : stair.exits()) {
            if (exit != null && exit.position() != null) {
                exitPositions.add(exit.position());
            }
        }
        CubePoint anchor = stair.anchor() == null || stair.exitLevels().isEmpty()
                ? null
                : CubePoint.at(stair.anchor(), stair.exitLevels().getFirst());
        return new StairSignature(
                List.copyOf(stair.exitLevels()),
                anchor,
                Set.copyOf(stair.occupiedPositions()),
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
}
