package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterBoundaryEditRequest(
        long mapId,
        long clusterId,
        int levelZ,
        features.world.dungeon.geometry.GridBoundary segments,
        Target target,
        Mode mode
) {
    public enum Target {
        WALL,
        INTERIOR_DOOR,
        EXTERIOR_DOOR
    }

    public enum Mode {
        CREATE,
        DELETE
    }
}
