package features.world.dungeonmap.model;

import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.Map;
import java.util.Objects;

public record DungeonClusterTranslation(
        DungeonLayout layout,
        RoomCluster translatedCluster,
        Map<Long, Corridor> affectedCorridors
) {

    public DungeonClusterTranslation {
        layout = Objects.requireNonNull(layout, "layout");
        affectedCorridors = affectedCorridors == null ? Map.of() : Map.copyOf(affectedCorridors);
    }
}
