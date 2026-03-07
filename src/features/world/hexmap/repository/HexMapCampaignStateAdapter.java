package features.world.hexmap.repository;

import features.campaignstate.repository.CampaignStateRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Hexmap-scoped adapter around global campaign state persistence.
 * Keeps world/hexmap features decoupled from the full campaign-state API surface.
 */
public class HexMapCampaignStateAdapter {

    private HexMapCampaignStateAdapter() {}

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        return CampaignStateRepository.get(conn).map(s -> s.PartyTileId);
    }

    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        CampaignStateRepository.updatePartyTile(conn, tileId);
    }
}
