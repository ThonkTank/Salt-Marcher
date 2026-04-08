package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterFloorEditRequest(
        long mapId,
        int levelZ,
        features.world.dungeon.geometry.GridArea cells,
        Mode mode
) {
    public enum Mode {
        ADD,
        REMOVE
    }
}
