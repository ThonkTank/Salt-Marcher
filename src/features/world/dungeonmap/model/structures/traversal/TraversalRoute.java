package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.LinkedHashMap;
import java.util.List;
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
