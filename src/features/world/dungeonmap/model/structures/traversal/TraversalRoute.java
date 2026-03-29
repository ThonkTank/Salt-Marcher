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

    static TraversalRoute fromPlan(Traversal traversal, TraversalPlan plan) {
        if (traversal == null || plan == null) {
            return empty();
        }
        ArrayList<CorridorSegment> corridorSegments = new ArrayList<>();
        for (CorridorTraversalSlice corridorSlice : plan.corridorSlices()) {
            if (corridorSlice == null) {
                continue;
            }
            corridorSegments.add(new CorridorSegment(
                    corridorSlice.segmentKey(),
                    Corridor.resolved(
                            corridorSlice.corridorId(),
                            traversal.mapId(),
                            traversal.roomIds(),
                            corridorSlice.path(),
                            corridorSlice.connections())));
        }
        ArrayList<StairSegment> stairSegments = new ArrayList<>();
        for (TraversalStairSlice stairSlice : plan.stairSlices()) {
            if (stairSlice == null || stairSlice.stair() == null) {
                continue;
            }
            stairSegments.add(new StairSegment(
                    stairSlice.segmentKey(),
                    DungeonStair.materialized(
                            stairSlice.stair(),
                            stairSlice.stairId(),
                            traversal.mapId())));
        }
        return new TraversalRoute(List.copyOf(corridorSegments), List.copyOf(stairSegments));
    }

    public boolean isEmpty() {
        return corridorSegments.isEmpty() && stairSegments.isEmpty();
    }

    public TraversalRoute withCorridorIds(Map<String, Long> corridorIdsBySegmentKey) {
        if (corridorSegments.isEmpty() || corridorIdsBySegmentKey == null || corridorIdsBySegmentKey.isEmpty()) {
            return this;
        }
        ArrayList<CorridorSegment> updated = new ArrayList<>();
        for (CorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment == null || corridorSegment.corridor() == null) {
                continue;
            }
            Long corridorId = corridorIdsBySegmentKey.getOrDefault(
                    corridorSegment.segmentKey(),
                    corridorSegment.corridor().corridorId());
            updated.add(corridorSegment.withCorridor(corridorSegment.corridor().withIdentity(
                    corridorId,
                    corridorSegment.corridor().mapId())));
        }
        return new TraversalRoute(List.copyOf(updated), stairSegments);
    }

    public TraversalRoute withStairIds(Map<String, Long> stairIdsBySegmentKey) {
        if (stairSegments.isEmpty() || stairIdsBySegmentKey == null || stairIdsBySegmentKey.isEmpty()) {
            return this;
        }
        ArrayList<StairSegment> updated = new ArrayList<>();
        for (StairSegment stairSegment : stairSegments) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            Long stairId = stairIdsBySegmentKey.getOrDefault(
                    stairSegment.segmentKey(),
                    stairSegment.stair().stairId());
            updated.add(stairSegment.withStair(stairSegment.stair().withIdentity(
                    stairId,
                    stairSegment.stair().mapId())));
        }
        return new TraversalRoute(corridorSegments, List.copyOf(updated));
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

    public record CorridorSegment(
            String segmentKey,
            Corridor corridor
    ) {
        public CorridorSegment {
            segmentKey = normalizeSegmentKey(segmentKey);
            corridor = Objects.requireNonNull(corridor, "corridor");
        }

        public CorridorSegment withCorridor(Corridor corridor) {
            return new CorridorSegment(segmentKey, corridor);
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

        public StairSegment withStair(DungeonStair stair) {
            return new StairSegment(segmentKey, stair);
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
