package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterMoveRequest(
        long mapId,
        long clusterId,
        features.world.dungeon.geometry.GridTranslation translation
) {
}
