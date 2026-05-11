package src.domain.dungeon.model.map.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonBoundaryKey;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.map.model.DungeonEdge;

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
        return keys.stream().anyMatch(bindingKeys::contains);
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
        return path.stream()
                .map(DungeonBoundaryKey::from)
                .anyMatch(bindingKeys::contains);
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
