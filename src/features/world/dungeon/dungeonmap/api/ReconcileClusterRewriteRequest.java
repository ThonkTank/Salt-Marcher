package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record ReconcileClusterRewriteRequest(
        DungeonMap originalMap,
        DungeonMap persistedRoomMap,
        ClusterRewriteRequest rewriteRequest
) {
    public ReconcileClusterRewriteRequest {
        originalMap = Objects.requireNonNull(originalMap, "originalMap");
        persistedRoomMap = Objects.requireNonNull(persistedRoomMap, "persistedRoomMap");
        rewriteRequest = Objects.requireNonNull(rewriteRequest, "rewriteRequest");
    }
}
