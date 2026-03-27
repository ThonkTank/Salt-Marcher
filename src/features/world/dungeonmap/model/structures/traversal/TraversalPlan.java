package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record TraversalPlan(
        List<CorridorTraversalSlice> corridorSlices,
        List<StairPlacement> stairPlacements
) {
    public TraversalPlan {
        corridorSlices = normalizeSlices(corridorSlices);
        stairPlacements = stairPlacements == null ? List.of() : List.copyOf(stairPlacements);
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
}
