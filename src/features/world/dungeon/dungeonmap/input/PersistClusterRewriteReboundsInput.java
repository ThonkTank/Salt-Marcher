package features.world.dungeon.dungeonmap.input;

public record PersistClusterRewriteReboundsInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest
) {
    public static PersistClusterRewriteReboundsInput clusterRewriteRebounds(
            java.sql.Connection connection,
            features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest
    ) {
        return new PersistClusterRewriteReboundsInput(connection, originalMap, rewriteRequest);
    }

    public boolean isEmpty() {
        return connection == null
                || originalMap == null
                || rewriteRequest == null
                || !rewriteRequest.hasChanges();
    }
}
