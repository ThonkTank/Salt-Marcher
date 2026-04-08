package features.world.dungeon.dungeonmap.input;

public record PersistClusterRewriteReboundsInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
        java.util.List<Long> persistedClusterIds
) {
}
