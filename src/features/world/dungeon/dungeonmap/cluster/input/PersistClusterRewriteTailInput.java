package features.world.dungeon.dungeonmap.cluster.input;

@SuppressWarnings("unused")
public record PersistClusterRewriteTailInput(
        java.sql.Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
        java.util.List<Long> persistedClusterIds
) {
    public PersistClusterRewriteTailInput {
        persistedClusterIds = persistedClusterIds == null ? java.util.List.of() : java.util.List.copyOf(persistedClusterIds);
    }
}
