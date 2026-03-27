package features.world.dungeonmap.model;

import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public record DungeonClusterTranslation(
        DungeonLayout layout,
        RoomCluster translatedCluster,
        Map<Long, Corridor> affectedCorridors,
        Map<Long, List<StairPlacement>> stairPlacementsByCorridorId
) {

    public DungeonClusterTranslation {
        layout = Objects.requireNonNull(layout, "layout");
        affectedCorridors = affectedCorridors == null ? Map.of() : Map.copyOf(affectedCorridors);
        stairPlacementsByCorridorId = stairPlacementsByCorridorId == null ? Map.of() : Map.copyOf(stairPlacementsByCorridorId);
    }

    public DungeonClusterTranslation(DungeonLayout layout, RoomCluster translatedCluster, Map<Long, Corridor> affectedCorridors) {
        this(layout, translatedCluster, affectedCorridors, Map.of());
    }
}
