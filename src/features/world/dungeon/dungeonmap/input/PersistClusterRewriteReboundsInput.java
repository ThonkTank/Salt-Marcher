package features.world.dungeon.dungeonmap.input;

public record PersistClusterRewriteReboundsInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
        java.util.List<Long> persistedClusterIds
) {
    public PersistClusterRewriteReboundsInput {
        persistedClusterIds = persistedClusterIds == null ? java.util.List.of() : java.util.List.copyOf(persistedClusterIds);
    }

    public static PersistClusterRewriteReboundsInput clusterRewriteRebounds(
            java.sql.Connection connection,
            features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
            java.util.List<Long> persistedClusterIds
    ) {
        return new PersistClusterRewriteReboundsInput(connection, originalMap, rewriteRequest, persistedClusterIds);
    }

    public boolean isEmpty() {
        return connection == null
                || originalMap == null
                || rewriteRequest == null
                || !rewriteRequest.hasAffectedRooms();
    }
}
