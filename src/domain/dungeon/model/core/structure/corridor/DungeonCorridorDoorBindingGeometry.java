package src.domain.dungeon.model.core.structure.corridor;

import java.util.LinkedHashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.worldspace.DungeonEdge;

public final class DungeonCorridorDoorBindingGeometry {

    private DungeonCorridorDoorBindingGeometry() {
    }

    public static Map<Long, DungeonCorridorDoorBinding> bindingsByRoom(Iterable<DungeonCorridorDoorBinding> bindings) {
        Map<Long, DungeonCorridorDoorBinding> result = new LinkedHashMap<>();
        for (DungeonCorridorDoorBinding binding : bindings) {
            result.putIfAbsent(binding.roomId(), binding);
        }
        return result;
    }

    public static DungeonCell absoluteRoomCell(
            DungeonCorridorDoorBinding binding,
            @Nullable DungeonCell clusterCenter
    ) {
        DungeonCell relativeCell = binding.relativeCell();
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, relativeCell.level()) : clusterCenter;
        return new DungeonCell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                center.level());
    }

    public static DungeonCell absoluteCorridorCell(
            DungeonCorridorDoorBinding binding,
            @Nullable DungeonCell clusterCenter
    ) {
        return binding.direction().neighborOf(absoluteRoomCell(binding, clusterCenter));
    }

    public static DungeonEdge absoluteDoorEdge(
            DungeonCorridorDoorBinding binding,
            @Nullable DungeonCell clusterCenter
    ) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }
}
