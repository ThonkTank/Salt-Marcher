package src.domain.dungeon.api;

import src.domain.mapcore.api.MapRenderPayload;
import src.domain.mapcore.api.MapSelectionRef;

import java.util.List;

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
        boolean topologyEmpty,
        List<MapSelectionRef> selectableTargets
) {

    public BaseMapSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
        currentFloor = Math.max(0, currentFloor);
        onionConfig = onionConfig == null ? OnionConfig.defaults() : onionConfig;
        viewport = viewport == null ? Viewport.defaultViewport() : viewport;
        renderPayload = renderPayload == null ? MapRenderPayload.empty() : renderPayload;
        selectableTargets = selectableTargets == null ? List.of() : List.copyOf(selectableTargets);
    }
}
