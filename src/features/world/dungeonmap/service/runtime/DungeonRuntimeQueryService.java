package features.world.dungeonmap.service.runtime;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.service.DungeonMapQueryService;

import java.sql.Connection;
import java.util.List;

public final class DungeonRuntimeQueryService {

    public DungeonRuntimeState loadRuntimeState(Long requestedMapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Long mapId = requestedMapId;
            if (mapId == null) {
                mapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
            }
            if (mapId == null) {
                List<DungeonMap> maps = DungeonMapRepository.getAllMaps(conn);
                if (maps.isEmpty()) {
                    return new DungeonRuntimeState(null, null);
                }
                mapId = maps.get(0).mapId();
            }
            DungeonMapState state = DungeonMapQueryService.loadMapState(conn, mapId);
            Long activeEndpointId = resolveActiveEndpointId(conn, mapId);
            return new DungeonRuntimeState(state, activeEndpointId);
        }
    }

    private Long resolveActiveEndpointId(Connection conn, long mapId) throws Exception {
        Long campaignMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (campaignMapId != null && campaignMapId.equals(mapId)) {
            Long campaignEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
            if (campaignEndpointId != null) {
                var storedEndpoint = DungeonEndpointRepository.findEndpoint(conn, campaignEndpointId);
                if (storedEndpoint.isPresent() && storedEndpoint.get().mapId() == mapId) {
                    return campaignEndpointId;
                }
            }
        }

        return DungeonEndpointRepository.findDefaultEntry(conn, mapId)
                .map(endpoint -> endpoint.endpointId())
                .orElse(null);
    }
}
