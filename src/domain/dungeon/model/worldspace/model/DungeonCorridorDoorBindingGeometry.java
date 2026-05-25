package src.domain.dungeon.model.worldspace.model;


import java.util.LinkedHashMap;
import java.util.Map;

final class DungeonCorridorDoorBindingGeometry {

    private DungeonCorridorDoorBindingGeometry() {
    }

    static Map<Long, DungeonCorridorDoorBinding> bindingsByRoom(Iterable<DungeonCorridorDoorBinding> bindings) {
        Map<Long, DungeonCorridorDoorBinding> result = new LinkedHashMap<>();
        for (DungeonCorridorDoorBinding binding : bindings) {
            result.putIfAbsent(binding.roomId(), binding);
        }
        return result;
    }

    static DungeonCell absoluteRoomCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        DungeonCell relativeCell = binding.relativeCell();
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, relativeCell.level()) : clusterCenter;
        return new DungeonCell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                center.level());
    }

    static DungeonCell absoluteCorridorCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return binding.direction().neighborOf(absoluteRoomCell(binding, clusterCenter));
    }

    static DungeonEdge absoluteDoorEdge(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }
}
