package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record TraversalPlan(
        List<CorridorTraversalSlice> corridorSlices,
        List<TraversalStairSlice> stairSlices
) {
    public TraversalPlan {
        corridorSlices = normalizeSlices(corridorSlices);
        stairSlices = normalizeStairSlices(stairSlices);
    }

    public static TraversalPlan empty() {
        return new TraversalPlan(List.of(), List.of());
    }

    public CorridorTraversalSlice corridorSlice(Long corridorId) {
        if (corridorSlices.isEmpty()) {
            return null;
        }
        if (corridorId == null) {
            return corridorSlices.getFirst();
        }
        for (CorridorTraversalSlice slice : corridorSlices) {
            if (slice != null && Objects.equals(slice.corridorId(), corridorId)) {
                return slice;
            }
        }
        return corridorSlices.size() == 1 ? corridorSlices.getFirst() : null;
    }

    public CorridorTraversalSlice corridorSliceBySegmentKey(String segmentKey) {
        if (segmentKey == null || corridorSlices.isEmpty()) {
            return null;
        }
        for (CorridorTraversalSlice slice : corridorSlices) {
            if (slice != null && Objects.equals(slice.segmentKey(), segmentKey)) {
                return slice;
            }
        }
        return null;
    }

    public List<StairPlacement> stairPlacements() {
        if (stairSlices.isEmpty()) {
            return List.of();
        }
        ArrayList<StairPlacement> result = new ArrayList<>();
        for (TraversalStairSlice stairSlice : stairSlices) {
            if (stairSlice != null && stairSlice.placement() != null) {
                result.add(stairSlice.placement());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public TraversalPlan withCorridorIds(Map<String, Long> corridorIdsBySegmentKey) {
        if (corridorSlices.isEmpty() || corridorIdsBySegmentKey == null || corridorIdsBySegmentKey.isEmpty()) {
            return this;
        }
        ArrayList<CorridorTraversalSlice> updated = new ArrayList<>();
        for (CorridorTraversalSlice corridorSlice : corridorSlices) {
            if (corridorSlice == null) {
                continue;
            }
            updated.add(new CorridorTraversalSlice(
                    corridorSlice.segmentKey(),
                    corridorIdsBySegmentKey.get(corridorSlice.segmentKey()),
                    corridorSlice.path(),
                    corridorSlice.connections()));
        }
        return new TraversalPlan(List.copyOf(updated), stairSlices);
    }

    public TraversalPlan withStairIds(Map<String, Long> stairIdsBySegmentKey) {
        if (stairSlices.isEmpty() || stairIdsBySegmentKey == null || stairIdsBySegmentKey.isEmpty()) {
            return this;
        }
        ArrayList<TraversalStairSlice> updated = new ArrayList<>();
        for (TraversalStairSlice stairSlice : stairSlices) {
            if (stairSlice == null) {
                continue;
            }
            updated.add(new TraversalStairSlice(
                    stairSlice.segmentKey(),
                    stairIdsBySegmentKey.get(stairSlice.segmentKey()),
                    stairSlice.placement()));
        }
        return new TraversalPlan(corridorSlices, List.copyOf(updated));
    }

    private static List<CorridorTraversalSlice> normalizeSlices(List<CorridorTraversalSlice> corridorSlices) {
        if (corridorSlices == null || corridorSlices.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorTraversalSlice> result = new ArrayList<>();
        for (CorridorTraversalSlice corridorSlice : corridorSlices) {
            if (corridorSlice != null) {
                result.add(corridorSlice);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<TraversalStairSlice> normalizeStairSlices(List<TraversalStairSlice> stairSlices) {
        if (stairSlices == null || stairSlices.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, TraversalStairSlice> result = new LinkedHashMap<>();
        for (TraversalStairSlice stairSlice : stairSlices) {
            if (stairSlice != null) {
                result.putIfAbsent(stairSlice.segmentKey(), stairSlice);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }
}
