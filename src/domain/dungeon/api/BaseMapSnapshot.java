package src.domain.dungeon.api;

import src.domain.mapcore.api.MapRenderPayload;

/**
 * View-facing dungeon map snapshot for the shared canvas surface.
 */
public record BaseMapSnapshot(
        DungeonMapId mapId,
        String mapName,
        long revision,
        int currentFloor,
        OnionConfig onionConfig,
        Viewport viewport,
        MapRenderPayload renderPayload,
        boolean topologyEmpty
) {

    public BaseMapSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
        currentFloor = Math.max(0, currentFloor);
        onionConfig = onionConfig == null ? OnionConfig.defaults() : onionConfig;
        viewport = viewport == null ? Viewport.defaultViewport() : viewport;
        renderPayload = renderPayload == null ? MapRenderPayload.empty() : renderPayload;
    }
}
