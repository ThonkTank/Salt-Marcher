package src.domain.dungeon.api;

/**
 * Query for loading a viewport-scoped map snapshot.
 */
public record LoadMapSnapshotQuery(
        DungeonMapId mapId,
        int targetFloor,
        OnionConfig onionConfig,
        Viewport viewport
) {

    public LoadMapSnapshotQuery {
        targetFloor = Math.max(0, targetFloor);
        onionConfig = onionConfig == null ? OnionConfig.defaults() : onionConfig;
        viewport = viewport == null ? Viewport.defaultViewport() : viewport;
    }
}
