package src.domain.dungeon.api;

/**
 * Query for loading one map snapshot together with the caller's current viewport.
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
