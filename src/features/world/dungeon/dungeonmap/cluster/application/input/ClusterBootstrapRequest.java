package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterBootstrapRequest(
        long mapId,
        int levelZ,
        features.world.dungeon.geometry.GridArea cells,
        String roomName
) {
    public ClusterBootstrapRequest(long mapId) {
        this(mapId, 0, features.world.dungeon.geometry.GridPoint.cell(0, 0, 0).cellFootprint(), "Raum 1");
    }
}
