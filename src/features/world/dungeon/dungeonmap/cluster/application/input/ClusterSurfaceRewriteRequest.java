package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterSurfaceRewriteRequest(
        long mapId,
        int levelZ,
        features.world.dungeon.geometry.GridArea cells,
        Mode mode
) {
    public enum Mode {
        PAINT,
        DELETE
    }
}
