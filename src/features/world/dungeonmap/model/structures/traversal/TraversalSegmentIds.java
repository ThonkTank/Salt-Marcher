package features.world.dungeonmap.model.structures.traversal;

import java.util.LinkedHashMap;
import java.util.Map;
public record TraversalSegmentIds(
        Map<String, Long> corridorIdsBySegmentKey,
        Map<String, Long> stairIdsBySegmentKey
) {
    public TraversalSegmentIds {
        corridorIdsBySegmentKey = normalize(corridorIdsBySegmentKey);
        stairIdsBySegmentKey = normalize(stairIdsBySegmentKey);
    }

    public static TraversalSegmentIds empty() {
        return new TraversalSegmentIds(Map.of(), Map.of());
    }

    public Long corridorId(String segmentKey) {
        return segmentKey == null ? null : corridorIdsBySegmentKey.get(segmentKey);
    }

    public Long stairId(String segmentKey) {
        return segmentKey == null ? null : stairIdsBySegmentKey.get(segmentKey);
    }

    private static Map<String, Long> normalize(Map<String, Long> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, Long> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : raw.entrySet()) {
            String segmentKey = entry.getKey();
            if (segmentKey == null) {
                continue;
            }
            String trimmed = segmentKey.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            normalized.put(trimmed, entry.getValue());
        }
        return normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
    }
}
