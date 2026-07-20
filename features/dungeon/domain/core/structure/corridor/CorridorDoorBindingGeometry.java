package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;

public final class CorridorDoorBindingGeometry {

    private CorridorDoorBindingGeometry() {
    }

    public static Map<Long, CorridorDoorBinding> bindingsByRoom(Iterable<CorridorDoorBinding> bindings) {
        Map<Long, CorridorDoorBinding> result = new LinkedHashMap<>();
        for (CorridorDoorBinding binding : bindings) {
            result.putIfAbsent(binding.roomId(), binding);
        }
        return result;
    }

    public static Cell absoluteRoomCell(
            CorridorDoorBinding binding,
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
            CorridorDoorBinding binding,
            @Nullable Cell clusterCenter
    ) {
        return binding.direction().neighborOf(absoluteRoomCell(binding, clusterCenter));
    }

    public static Edge absoluteDoorEdge(
            CorridorDoorBinding binding,
            @Nullable Cell clusterCenter
    ) {
        return Edge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }

    public static boolean touchesDoorBindingKeys(
            Iterable<Corridor> corridors,
            @Nullable Cell clusterCenter,
            long clusterId,
            int level,
            Set<DungeonBoundaryKey> keys
    ) {
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = doorBindingKeys(corridors, clusterCenter, clusterId, level);
        for (DungeonBoundaryKey key : keys) {
            if (bindingKeys.contains(key)) {
                return true;
            }
        }
        return false;
    }

    public static boolean touchesDoorBindingPath(
            Iterable<Corridor> corridors,
            @Nullable Cell clusterCenter,
            long clusterId,
            int level,
            List<Edge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = doorBindingKeys(corridors, clusterCenter, clusterId, level);
        for (Edge edge : path) {
            if (bindingKeys.contains(DungeonBoundaryKey.from(edge))) {
                return true;
            }
        }
        return false;
    }

    private static Set<DungeonBoundaryKey> doorBindingKeys(
            Iterable<Corridor> corridors,
            @Nullable Cell clusterCenter,
            long clusterId,
            int level
    ) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        if (invalidBindingLookup(corridors, clusterCenter, clusterId)) {
            return result;
        }
        for (Corridor corridor : corridors) {
            for (CorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                if (binding.clusterId() == clusterId && binding.relativeCell().level() == level) {
                    result.add(DungeonBoundaryKey.from(absoluteDoorEdgeAtBindingLevel(binding, clusterCenter)));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Edge absoluteDoorEdgeAtBindingLevel(
            CorridorDoorBinding binding,
            Cell clusterCenter
    ) {
        Cell relativeCell = binding.relativeCell();
        Cell roomCell = new Cell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                relativeCell.level());
        return Edge.sideOf(roomCell, binding.direction());
    }

    private static boolean invalidBindingLookup(
            Iterable<Corridor> corridors,
            @Nullable Cell clusterCenter,
            long clusterId
    ) {
        return corridors == null || clusterCenter == null || clusterId <= 0L;
    }
}
