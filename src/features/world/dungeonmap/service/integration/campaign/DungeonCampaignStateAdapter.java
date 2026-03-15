package features.world.dungeonmap.service.integration.campaign;

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
        return CampaignStateApi.getDungeonPosition(conn).map(CampaignStateApi.DungeonPosition::mapId);
    }

    public static Optional<Long> getDungeonSquareId(Connection conn) throws SQLException {
        return CampaignStateApi.getDungeonPosition(conn).map(CampaignStateApi.DungeonPosition::squareId);
    }

    public static void setDungeonPosition(Connection conn, Long mapId, Long squareId) throws SQLException {
        CampaignStateApi.setDungeonPosition(conn, mapId, squareId);
    }

    public static void clearDungeonPosition(Connection conn) throws SQLException {
        CampaignStateApi.clearDungeonPosition(conn);
    }
}
