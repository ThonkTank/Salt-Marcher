package features.world.dungeonmap.model.structures.traversal;

import java.util.LinkedHashMap;
import java.util.Map;

public record TraversalSegmentRefs(
        Map<String, TraversalSegmentRef> refsBySegmentKey
) {
    public TraversalSegmentRefs {
        refsBySegmentKey = normalize(refsBySegmentKey);
    }

    public static TraversalSegmentRefs empty() {
        return new TraversalSegmentRefs(Map.of());
    }

    public TraversalSegmentRef ref(String segmentKey) {
        return segmentKey == null ? null : refsBySegmentKey.get(segmentKey);
    }

    public Long corridorId(String segmentKey) {
        TraversalSegmentRef ref = ref(segmentKey);
        return ref instanceof TraversalSegmentRef.CorridorSegment corridorSegment ? corridorSegment.corridorId() : null;
    }

    public Long stairId(String segmentKey) {
        TraversalSegmentRef ref = ref(segmentKey);
        return ref instanceof TraversalSegmentRef.StairSegment stairSegment ? stairSegment.stairId() : null;
    }

    public Map<String, Long> corridorIdsBySegmentKey() {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        for (Map.Entry<String, TraversalSegmentRef> entry : refsBySegmentKey.entrySet()) {
            if (entry.getValue() instanceof TraversalSegmentRef.CorridorSegment corridorSegment
                    && corridorSegment.corridorId() != null) {
                result.put(entry.getKey(), corridorSegment.corridorId());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public Map<String, Long> stairIdsBySegmentKey() {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        for (Map.Entry<String, TraversalSegmentRef> entry : refsBySegmentKey.entrySet()) {
            if (entry.getValue() instanceof TraversalSegmentRef.StairSegment stairSegment
                    && stairSegment.stairId() != null) {
                result.put(entry.getKey(), stairSegment.stairId());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public TraversalSegmentRefs withMerged(TraversalSegmentRefs other) {
        if (other == null || other.refsBySegmentKey().isEmpty()) {
            return this;
        }
        if (refsBySegmentKey.isEmpty()) {
            return other;
        }
        LinkedHashMap<String, TraversalSegmentRef> merged = new LinkedHashMap<>(refsBySegmentKey);
        for (Map.Entry<String, TraversalSegmentRef> entry : other.refsBySegmentKey().entrySet()) {
            merged.putIfAbsent(entry.getKey(), entry.getValue());
        }
        return new TraversalSegmentRefs(merged);
    }

    public static TraversalSegmentRefs ofCorridorAndStairIds(
            Map<String, Long> corridorIdsBySegmentKey,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        LinkedHashMap<String, TraversalSegmentRef> refs = new LinkedHashMap<>();
        appendTypedRefs(refs, corridorIdsBySegmentKey, true);
        appendTypedRefs(refs, stairIdsBySegmentKey, false);
        return refs.isEmpty() ? empty() : new TraversalSegmentRefs(refs);
    }

    private static void appendTypedRefs(
            Map<String, TraversalSegmentRef> refs,
            Map<String, Long> idsBySegmentKey,
            boolean corridor
    ) {
        for (Map.Entry<String, Long> entry : normalizeIds(idsBySegmentKey).entrySet()) {
            refs.put(entry.getKey(), corridor
                    ? new TraversalSegmentRef.CorridorSegment(entry.getValue())
                    : new TraversalSegmentRef.StairSegment(entry.getValue()));
        }
    }

    private static Map<String, TraversalSegmentRef> normalize(Map<String, TraversalSegmentRef> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, TraversalSegmentRef> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, TraversalSegmentRef> entry : raw.entrySet()) {
            String segmentKey = normalizeSegmentKey(entry.getKey());
            TraversalSegmentRef ref = entry.getValue();
            if (segmentKey == null || ref == null || ref.structureId() == null) {
                continue;
            }
            normalized.put(segmentKey, ref);
        }
        return normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
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
