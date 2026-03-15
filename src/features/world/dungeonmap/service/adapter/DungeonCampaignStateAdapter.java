package features.world.dungeonmap.service.adapter;

import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionSummary;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

public final class DungeonCampaignStateAdapter {

    private DungeonCampaignStateAdapter() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getStoredMapId(Connection conn) throws SQLException {
        return CampaignStateReadApi.getDungeonMapId(conn);
    }

    public static Long getStoredActiveRoomId(Connection conn, long mapId) throws SQLException {
        return CampaignStateReadApi.getDungeonPosition(conn)
                .filter(position -> position.mapId() != null && position.mapId() == mapId)
                .map(position -> position.roomId())
                .orElse(null);
    }

    public static void clearActiveRoom(Connection conn) throws SQLException {
        CampaignStateApi.clearDungeonPosition(conn);
    }

    public static void updateActiveRoom(Connection conn, long mapId, Long roomId) throws SQLException {
        CampaignStateApi.setDungeonPosition(conn, mapId, roomId);
    }
}
