package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class DungeonCorridorBindingReanchorService {

    public Map<Long, Corridor> reanchorBindings(
            DungeonLayout currentLayout,
            DungeonLayout rewrittenLayout,
            Map<Long, Corridor> corridorsById,
            Set<Long> affectedRoomIds,
            Set<Long> affectedClusterIds,
            Set<Long> deletedClusterIds
    ) {
        if (currentLayout == null || rewrittenLayout == null || corridorsById == null || corridorsById.isEmpty()) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Set<Long> selectedCorridorIds = new LinkedHashSet<>(currentLayout.corridorIdsDependingOnRooms(affectedRoomIds));
        selectedCorridorIds.addAll(currentLayout.corridorIdsDependingOnClusters(affectedClusterIds));
        if (selectedCorridorIds.isEmpty()) {
            return Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        for (Long corridorId : selectedCorridorIds) {
            Corridor corridor = result.get(corridorId);
            if (corridor == null) {
                continue;
            }
            result.put(corridorId, corridor.withRoomClusterReassignment(
                    currentLayout.corridorPlanningInput(),
                    rewrittenLayout.roomClusterIds(),
                    rewrittenLayout.clusterCentersById(),
                    deletedClusterIds));
        }
        return Map.copyOf(result);
    }
}
