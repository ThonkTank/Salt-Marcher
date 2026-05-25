package src.domain.dungeon.model.worldspace.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonCorridorBindingLookupLogic {

    boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            Set<DungeonBoundaryKey> keys
    ) {
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        for (DungeonBoundaryKey key : keys) {
            if (bindingKeys.contains(key)) {
                return true;
            }
        }
        return false;
    }

    boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            List<DungeonEdge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        for (DungeonEdge edge : path) {
            if (bindingKeys.contains(DungeonBoundaryKey.from(edge))) {
                return true;
            }
        }
        return false;
    }

    private Set<DungeonBoundaryKey> corridorBindingKeys(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level
    ) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        if (invalidClusterBindingLookup(dungeonMap, clusterCenter, clusterId)) {
            return result;
        }
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                if (binding.clusterId() != clusterId || binding.relativeCell().level() != level) {
                    continue;
                }
                result.add(DungeonBoundaryKey.from(absoluteDoorEdge(binding, clusterCenter)));
            }
        }
        return Set.copyOf(result);
    }

    private boolean invalidClusterBindingLookup(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId
    ) {
        return dungeonMap == null || clusterCenter == null || clusterId <= 0L;
    }

    private DungeonEdge absoluteDoorEdge(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }

    private DungeonCell absoluteRoomCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        DungeonCell relativeCell = binding.relativeCell();
        return new DungeonCell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                relativeCell.level());
    }
}
