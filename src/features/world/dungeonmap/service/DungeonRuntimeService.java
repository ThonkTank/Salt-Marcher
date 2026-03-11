package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;

import java.sql.Connection;
import java.util.List;
import java.util.Optional;

public final class DungeonRuntimeService {

    public enum MoveStatus {
        MOVED,
        NOT_CONNECTED,
        NO_CURRENT_POSITION
    }

    public record MoveResult(MoveStatus status, Long endpointId) {}

    private DungeonRuntimeService() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeState loadRuntimeState(Long requestedMapId) throws Exception {
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

    public static MoveResult movePartyToEndpoint(long mapId, long targetEndpointId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> targetEndpoint = DungeonEndpointRepository.findEndpoint(conn, targetEndpointId);
            if (targetEndpoint.isEmpty() || targetEndpoint.get().mapId() != mapId) {
                return new MoveResult(MoveStatus.NOT_CONNECTED, DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null));
            }
            Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
            Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
            if (currentEndpointId == null || currentMapId == null || currentMapId != mapId) {
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, targetEndpointId);
                return new MoveResult(MoveStatus.NO_CURRENT_POSITION, targetEndpointId);
            }
            if (!DungeonLinkRepository.areEndpointsLinked(conn, mapId, currentEndpointId, targetEndpointId)) {
                return new MoveResult(MoveStatus.NOT_CONNECTED, currentEndpointId);
            }
            DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, targetEndpointId);
            return new MoveResult(MoveStatus.MOVED, targetEndpointId);
        }
    }

    private static Long resolveActiveEndpointId(Connection conn, long mapId) throws Exception {
        Long campaignMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (campaignMapId != null && campaignMapId.equals(mapId)) {
            Long campaignEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
            if (campaignEndpointId != null) {
                Optional<DungeonEndpoint> storedEndpoint = DungeonEndpointRepository.findEndpoint(conn, campaignEndpointId);
                if (storedEndpoint.isPresent() && storedEndpoint.get().mapId() == mapId) {
                    return campaignEndpointId;
                }
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
            }
        }

        Optional<DungeonEndpoint> defaultEntry = DungeonEndpointRepository.findDefaultEntry(conn, mapId);
        if (defaultEntry.isPresent()) {
            DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, defaultEntry.get().endpointId());
            return defaultEntry.get().endpointId();
        }

        if (campaignMapId == null || campaignMapId != mapId) {
            DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
        }
        return null;
    }
}
