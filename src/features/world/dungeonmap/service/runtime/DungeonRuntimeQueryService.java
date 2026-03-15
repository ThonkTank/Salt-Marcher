package features.world.dungeonmap.service.runtime;

import database.DatabaseManager;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.DungeonRuntimeState;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.projection.DungeonMapStateLoader;

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
                    return new DungeonRuntimeState(null, null, false);
                }
                mapId = maps.get(0).mapId();
            }
            DungeonMapState state = DungeonMapStateLoader.load(conn, mapId);
            PositionResolution resolution = resolvePosition(conn, state);
            return new DungeonRuntimeState(
                    state,
                    resolution.activeSquareId(),
                    resolution.requiresInitialPosition());
        }
    }

    private PositionResolution resolvePosition(Connection conn, DungeonMapState state) throws Exception {
        if (state == null || state.map() == null) {
            return PositionResolution.missing();
        }

        Long campaignMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        // The runner must not silently jump to a default entry when this dungeon has no stored party position.
        if (campaignMapId == null || !campaignMapId.equals(state.map().mapId())) {
            return PositionResolution.missing();
        }

        Long storedSquareId = DungeonCampaignStateAdapter.getDungeonSquareId(conn).orElse(null);
        DungeonSquare storedSquare = state.index().findSquare(storedSquareId);
        if (storedSquare != null) {
            return new PositionResolution(storedSquare.squareId(), false);
        }
        return PositionResolution.missing();
    }

    private record PositionResolution(Long activeSquareId, boolean requiresInitialPosition) {
        static PositionResolution missing() {
            return new PositionResolution(null, true);
        }
    }
}
