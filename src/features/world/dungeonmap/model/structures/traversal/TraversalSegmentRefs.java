package features.world.dungeonmap.model.structures.traversal;

import java.util.LinkedHashMap;
import java.util.Map;

public record TraversalSegmentRefs(
        Map<String, Long> corridorIdsBySegmentKey,
        Map<String, Long> stairIdsBySegmentKey
) {
    public TraversalSegmentRefs {
        corridorIdsBySegmentKey = normalizeIds(corridorIdsBySegmentKey);
        stairIdsBySegmentKey = normalizeIds(stairIdsBySegmentKey);
    }

    public static TraversalSegmentRefs empty() {
        return new TraversalSegmentRefs(Map.of(), Map.of());
    }

    public boolean isEmpty() {
        return corridorIdsBySegmentKey.isEmpty() && stairIdsBySegmentKey.isEmpty();
    }

    public TraversalSegmentRefs withMerged(TraversalSegmentRefs other) {
        if (other == null || other.isEmpty()) {
            return this;
        }
        if (isEmpty()) {
            return other;
        }
        LinkedHashMap<String, Long> mergedCorridorIds = new LinkedHashMap<>(corridorIdsBySegmentKey);
        for (Map.Entry<String, Long> entry : other.corridorIdsBySegmentKey().entrySet()) {
            mergedCorridorIds.putIfAbsent(entry.getKey(), entry.getValue());
        }
        LinkedHashMap<String, Long> mergedStairIds = new LinkedHashMap<>(stairIdsBySegmentKey);
        for (Map.Entry<String, Long> entry : other.stairIdsBySegmentKey().entrySet()) {
            mergedStairIds.putIfAbsent(entry.getKey(), entry.getValue());
        }
        return new TraversalSegmentRefs(mergedCorridorIds, mergedStairIds);
    }

    public static TraversalSegmentRefs ofCorridorAndStairIds(
            Map<String, Long> corridorIdsBySegmentKey,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        return new TraversalSegmentRefs(corridorIdsBySegmentKey, stairIdsBySegmentKey);
    }

    private static Map<String, Long> normalizeIds(Map<String, Long> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, Long> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : raw.entrySet()) {
            String segmentKey = normalizeSegmentKey(entry.getKey());
            Long structureId = entry.getValue();
            if (segmentKey == null || structureId == null) {
                continue;
            }
            normalized.put(segmentKey, structureId);
        }
        return normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
    }

    private static String normalizeSegmentKey(String segmentKey) {
        if (segmentKey == null) {
            return null;
        }
        String trimmed = segmentKey.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
