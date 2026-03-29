package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;

import java.util.Map;
import java.util.Objects;

public record DungeonClusterMoveProjection(
        DungeonLayout layout,
        RoomCluster translatedCluster,
        Map<Long, Traversal> traversalsById,
        Map<Long, TraversalRoute> traversalRoutesByTraversalId
) {
    public DungeonClusterMoveProjection {
        layout = Objects.requireNonNull(layout, "layout");
        traversalsById = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        traversalRoutesByTraversalId = traversalRoutesByTraversalId == null
                ? Map.of()
                : Map.copyOf(traversalRoutesByTraversalId);
    }
}
