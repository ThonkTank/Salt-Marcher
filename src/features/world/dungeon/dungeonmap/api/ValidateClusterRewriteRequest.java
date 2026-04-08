package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.Objects;

public record ValidateClusterRewriteRequest(
        DungeonMap map,
        ClusterRewriteRequest rewriteRequest
) {
    public ValidateClusterRewriteRequest {
        map = Objects.requireNonNull(map, "map");
        rewriteRequest = Objects.requireNonNull(rewriteRequest, "rewriteRequest");
    }
}
