package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import java.util.Objects;

public record DungeonClusterMoveProjection(
        DungeonLayout layout,
        RoomCluster translatedCluster
) {
    public DungeonClusterMoveProjection {
        layout = Objects.requireNonNull(layout, "layout");
    }
}
