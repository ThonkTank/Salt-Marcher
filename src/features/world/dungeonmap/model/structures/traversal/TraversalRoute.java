package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record TraversalRoute(
        List<CorridorSegment> corridorSegments,
        List<StairSegment> stairSegments
) {
    public TraversalRoute {
        corridorSegments = normalizeCorridorSegments(corridorSegments);
        stairSegments = normalizeStairSegments(stairSegments);
    }

    public static TraversalRoute empty() {
        return new TraversalRoute(List.of(), List.of());
    }

    public boolean isEmpty() {
        return corridorSegments.isEmpty() && stairSegments.isEmpty();
    }

    public TraversalRoute withAppliedSegmentIds(TraversalSegmentRefs segmentRefs) {
        TraversalSegmentRefs resolvedSegmentRefs = segmentRefs == null ? TraversalSegmentRefs.empty() : segmentRefs;
        if (isEmpty() || resolvedSegmentRefs.isEmpty()) {
            return this;
        }
        return new TraversalRoute(
                bindCorridorSegments(corridorSegments, resolvedSegmentRefs.corridorIdsBySegmentKey()),
                bindStairSegments(stairSegments, resolvedSegmentRefs.stairIdsBySegmentKey()));
    }

    private static List<CorridorSegment> normalizeCorridorSegments(List<CorridorSegment> corridorSegments) {
        if (corridorSegments == null || corridorSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, CorridorSegment> result = new LinkedHashMap<>();
        for (CorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment != null && corridorSegment.corridor() != null) {
                result.putIfAbsent(corridorSegment.segmentKey(), corridorSegment);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }

    private static List<StairSegment> normalizeStairSegments(List<StairSegment> stairSegments) {
        if (stairSegments == null || stairSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, StairSegment> result = new LinkedHashMap<>();
        for (StairSegment stairSegment : stairSegments) {
            if (stairSegment != null && stairSegment.stair() != null) {
                result.putIfAbsent(stairSegment.segmentKey(), stairSegment);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }

    private static List<CorridorSegment> bindCorridorSegments(
            List<CorridorSegment> corridorSegments,
            Map<String, Long> corridorIdsBySegmentKey
    ) {
        if (corridorSegments == null || corridorSegments.isEmpty()) {
            return List.of();
        }
        Map<String, Long> resolvedIds = corridorIdsBySegmentKey == null ? Map.of() : corridorIdsBySegmentKey;
        ArrayList<CorridorSegment> rebound = new ArrayList<>();
        for (CorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment == null || corridorSegment.corridor() == null) {
                continue;
            }
            Corridor corridor = corridorSegment.corridor();
            Long corridorId = resolvedIds.get(corridorSegment.segmentKey());
            Corridor resolvedCorridor = corridorId == null ? corridor : corridor.withIdentity(corridorId, corridor.mapId());
            rebound.add(new CorridorSegment(corridorSegment.segmentKey(), resolvedCorridor));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }

    private static List<StairSegment> bindStairSegments(
            List<StairSegment> stairSegments,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        if (stairSegments == null || stairSegments.isEmpty()) {
            return List.of();
        }
        Map<String, Long> resolvedIds = stairIdsBySegmentKey == null ? Map.of() : stairIdsBySegmentKey;
        ArrayList<StairSegment> rebound = new ArrayList<>();
        for (StairSegment stairSegment : stairSegments) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSegment.stair();
            Long stairId = resolvedIds.get(stairSegment.segmentKey());
            DungeonStair resolvedStair = stairId == null ? stair : stair.withIdentity(stairId, stair.mapId());
            rebound.add(new StairSegment(stairSegment.segmentKey(), resolvedStair));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }

    public record CorridorSegment(
            String segmentKey,
            Corridor corridor
    ) {
        public CorridorSegment {
            segmentKey = normalizeSegmentKey(segmentKey);
            corridor = Objects.requireNonNull(corridor, "corridor");
        }
    }

    public record StairSegment(
            String segmentKey,
            DungeonStair stair
    ) {
        public StairSegment {
            segmentKey = normalizeSegmentKey(segmentKey);
            stair = Objects.requireNonNull(stair, "stair");
        }
    }

    private static String normalizeSegmentKey(String segmentKey) {
        String normalized = segmentKey == null ? "" : segmentKey.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
        return normalized;
    }
}
