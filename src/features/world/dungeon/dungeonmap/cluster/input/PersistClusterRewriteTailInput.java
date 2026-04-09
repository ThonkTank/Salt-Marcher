package features.world.dungeon.dungeonmap.cluster.input;

@SuppressWarnings("unused")
public record PersistClusterRewriteTailInput(
        long mapId,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest
) {
}
