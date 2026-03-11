package features.world.dungeonmap.service.adapter;

import features.campaignstate.api.CampaignStateApi;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Dungeon-scoped adapter around global campaign state persistence.
 * Keeps world/dungeonmap features decoupled from the full campaign-state API surface.
 */
public final class DungeonCampaignStateAdapter {

    private DungeonCampaignStateAdapter() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getDungeonMapId(Connection conn) throws SQLException {
        return CampaignStateApi.getDungeonMapId(conn);
    }

    public static Optional<Long> getDungeonEndpointId(Connection conn) throws SQLException {
        return CampaignStateApi.getDungeonEndpointId(conn);
    }

    public static void updateDungeonPosition(Connection conn, Long mapId, Long endpointId) throws SQLException {
        CampaignStateApi.updateDungeonPosition(conn, mapId, endpointId);
    }

    public static void clearDungeonPosition(Connection conn) throws SQLException {
        CampaignStateApi.clearDungeonPosition(conn);
    }
}
