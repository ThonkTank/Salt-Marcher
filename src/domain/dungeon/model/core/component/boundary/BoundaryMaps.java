package src.domain.dungeon.model.core.component.boundary;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class BoundaryMaps {
    private BoundaryMaps() {
    }

    static List<BoundarySegment> sortedSegments(Iterable<BoundarySegment> segments) {
        List<BoundarySegment> result = new ArrayList<>();
        for (BoundarySegment segment : segments == null ? List.<BoundarySegment>of() : segments) {
            if (segment != null) {
                result.add(segment);
            }
        }
        result.sort(BoundaryMap::compareSegments);
        return List.copyOf(result);
    }

    static Map<EdgeKey, BoundarySegment> copySegmentsByKey(Map<EdgeKey, BoundarySegment> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<EdgeKey, BoundarySegment> result = new LinkedHashMap<>();
        for (Map.Entry<EdgeKey, BoundarySegment> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return Collections.unmodifiableMap(result);
    }
}
