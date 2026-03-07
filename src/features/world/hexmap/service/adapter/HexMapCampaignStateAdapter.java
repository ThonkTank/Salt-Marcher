package features.world.hexmap.service.adapter;

import features.campaignstate.repository.CampaignStateRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Hexmap-scoped adapter around global campaign state persistence.
 * Keeps world/hexmap features decoupled from the full campaign-state API surface.
 */
public final class HexMapCampaignStateAdapter {

    private HexMapCampaignStateAdapter() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        return CampaignStateRepository.get(conn).map(s -> s.PartyTileId);
    }

    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        CampaignStateRepository.updatePartyTile(conn, tileId);
    }

    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int radius) throws SQLException {
        CampaignStateRepository.clearPartyTileOutsideRadius(conn, mapId, radius);
    }
}
