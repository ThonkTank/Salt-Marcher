package features.world.dungeonmap.model.structures.traversal;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record TraversalMaterialization(
        List<TraversalCorridorSegment> corridorSegments,
        List<TraversalStairSegment> stairSegments
) {
    public TraversalMaterialization {
        corridorSegments = normalizeCorridorSegments(corridorSegments);
        stairSegments = normalizeStairSegments(stairSegments);
    }

    public static TraversalMaterialization empty() {
        return new TraversalMaterialization(List.of(), List.of());
    }

    public static TraversalMaterialization singleCorridor(Long corridorId) {
        if (corridorId == null) {
            return empty();
        }
        return new TraversalMaterialization(
                List.of(new TraversalCorridorSegment("legacy-corridor", corridorId)),
                List.of());
    }

    public TraversalMaterialization withCorridorSegments(List<TraversalCorridorSegment> corridorSegments) {
        return new TraversalMaterialization(corridorSegments, stairSegments);
    }

    public TraversalMaterialization withStairSegments(List<TraversalStairSegment> stairSegments) {
        return new TraversalMaterialization(corridorSegments, stairSegments);
    }

    public TraversalCorridorSegment corridorSegmentById(Long corridorId) {
        if (corridorId == null) {
            return null;
        }
        for (TraversalCorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment != null && Objects.equals(corridorSegment.corridorId(), corridorId)) {
                return corridorSegment;
            }
        }
        return null;
    }

    public TraversalStairSegment stairSegmentById(Long stairId) {
        if (stairId == null) {
            return null;
        }
        for (TraversalStairSegment stairSegment : stairSegments) {
            if (stairSegment != null && Objects.equals(stairSegment.stairId(), stairId)) {
                return stairSegment;
            }
        }
        return null;
    }

    public Map<String, Long> corridorIdsBySegmentKey() {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        for (TraversalCorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment != null) {
                result.put(corridorSegment.segmentKey(), corridorSegment.corridorId());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public Map<String, Long> stairIdsBySegmentKey() {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        for (TraversalStairSegment stairSegment : stairSegments) {
            if (stairSegment != null) {
                result.put(stairSegment.segmentKey(), stairSegment.stairId());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<TraversalCorridorSegment> normalizeCorridorSegments(List<TraversalCorridorSegment> corridorSegments) {
        if (corridorSegments == null || corridorSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, TraversalCorridorSegment> unique = new LinkedHashMap<>();
        for (TraversalCorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment != null) {
                unique.putIfAbsent(corridorSegment.segmentKey(), corridorSegment);
            }
        }
        if (unique.isEmpty()) {
            return List.of();
        }
        return List.copyOf(new ArrayList<>(unique.values()));
    }

    private static List<TraversalStairSegment> normalizeStairSegments(List<TraversalStairSegment> stairSegments) {
        if (stairSegments == null || stairSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, TraversalStairSegment> unique = new LinkedHashMap<>();
        for (TraversalStairSegment stairSegment : stairSegments) {
            if (stairSegment != null) {
                unique.putIfAbsent(stairSegment.segmentKey(), stairSegment);
            }
        }
        if (unique.isEmpty()) {
            return List.of();
        }
        return List.copyOf(new ArrayList<>(unique.values()));
    }
}
