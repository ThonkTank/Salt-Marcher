package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;

final class DungeonCorridorBindingLookupLogic {

    boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            Cell clusterCenter,
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
            Cell clusterCenter,
            long clusterId,
            int level,
            List<Edge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        for (Edge edge : path) {
            if (bindingKeys.contains(DungeonBoundaryKey.from(edge))) {
                return true;
            }
        }
        return false;
    }

    private Set<DungeonBoundaryKey> corridorBindingKeys(
            DungeonMap dungeonMap,
            Cell clusterCenter,
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
            Cell clusterCenter,
            long clusterId
    ) {
        return dungeonMap == null || clusterCenter == null || clusterId <= 0L;
    }

    private Edge absoluteDoorEdge(DungeonCorridorDoorBinding binding, Cell clusterCenter) {
        return Edge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }

    private Cell absoluteRoomCell(DungeonCorridorDoorBinding binding, Cell clusterCenter) {
        Cell relativeCell = binding.relativeCell();
        return new Cell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                relativeCell.level());
    }
}
