package features.world.dungeonmap.service.runtime;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.service.runtime.DungeonMoveResult;
import features.world.dungeonmap.service.runtime.DungeonMoveStatus;

import java.sql.Connection;
import java.util.Optional;

public final class DungeonRuntimeCommandService {

    public DungeonMoveResult movePartyToEndpoint(long mapId, long targetEndpointId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> targetEndpoint = DungeonEndpointRepository.findEndpoint(conn, targetEndpointId);
            if (targetEndpoint.isEmpty() || targetEndpoint.get().mapId() != mapId) {
                return new DungeonMoveResult(DungeonMoveStatus.NOT_CONNECTED, DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null));
            }
            Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
            Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
            if (currentEndpointId == null || currentMapId == null || currentMapId != mapId) {
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, targetEndpointId);
                return new DungeonMoveResult(DungeonMoveStatus.NO_CURRENT_POSITION, targetEndpointId);
            }
            if (!DungeonLinkRepository.areAnchorsLinked(
                    conn,
                    mapId,
                    DungeonLinkAnchor.endpoint(currentEndpointId),
                    DungeonLinkAnchor.endpoint(targetEndpointId))) {
                return new DungeonMoveResult(DungeonMoveStatus.NOT_CONNECTED, currentEndpointId);
            }
            DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, targetEndpointId);
            return new DungeonMoveResult(DungeonMoveStatus.MOVED, targetEndpointId);
        }
    }
}
