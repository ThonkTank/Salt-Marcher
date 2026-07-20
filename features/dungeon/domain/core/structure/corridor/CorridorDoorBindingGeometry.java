package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

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

    public static Cell roomCell(CorridorDoorBinding binding) {
        return binding.roomCell();
    }

    public static Cell corridorCell(CorridorDoorBinding binding) {
        return binding.direction().neighborOf(binding.roomCell());
    }

    public static Edge doorEdge(CorridorDoorBinding binding) {
        return Edge.sideOf(binding.roomCell(), binding.direction());
    }

    public static boolean touchesDoorBindingKeys(
            Iterable<Corridor> corridors,
            long clusterId,
            int level,
            Set<DungeonBoundaryKey> keys
    ) {
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = doorBindingKeys(corridors, clusterId, level);
        return keys.stream().anyMatch(bindingKeys::contains);
    }

    public static boolean touchesDoorBindingPath(
            Iterable<Corridor> corridors,
            long clusterId,
            int level,
            List<Edge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = doorBindingKeys(corridors, clusterId, level);
        return path.stream().map(DungeonBoundaryKey::from).anyMatch(bindingKeys::contains);
    }

    private static Set<DungeonBoundaryKey> doorBindingKeys(
            Iterable<Corridor> corridors,
            long clusterId,
            int level
    ) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        if (corridors == null || clusterId <= 0L) {
            return Set.of();
        }
        for (Corridor corridor : corridors) {
            for (CorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                if (binding.clusterId() == clusterId && binding.roomCell().level() == level) {
                    result.add(DungeonBoundaryKey.from(doorEdge(binding)));
                }
            }
        }
        return Set.copyOf(result);
    }
}
