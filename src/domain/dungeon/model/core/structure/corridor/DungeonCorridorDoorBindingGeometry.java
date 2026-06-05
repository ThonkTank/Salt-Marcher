package src.domain.dungeon.model.core.structure.corridor;

import java.util.LinkedHashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.worldspace.DungeonCorridorDoorBinding;

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

    public static Cell absoluteRoomCell(
            DungeonCorridorDoorBinding binding,
            @Nullable Cell clusterCenter
    ) {
        Cell relativeCell = binding.relativeCell();
        Cell center = clusterCenter == null ? new Cell(0, 0, relativeCell.level()) : clusterCenter;
        return new Cell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                center.level());
    }

    public static Cell absoluteCorridorCell(
            DungeonCorridorDoorBinding binding,
            @Nullable Cell clusterCenter
    ) {
        return binding.direction().neighborOf(absoluteRoomCell(binding, clusterCenter));
    }

    public static Edge absoluteDoorEdge(
            DungeonCorridorDoorBinding binding,
            @Nullable Cell clusterCenter
    ) {
        return Edge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }
}
