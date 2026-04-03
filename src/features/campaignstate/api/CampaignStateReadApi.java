package features.campaignstate.api;

import features.campaignstate.repository.CampaignStateRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Public cross-feature read facade for focused campaign-state reads.
 */
public final class CampaignStateReadApi {

    private CampaignStateReadApi() {
        throw new AssertionError("No instances");
    }

    public static Optional<DungeonTilePosition> getDungeonTilePosition(Connection conn) throws SQLException {
        return CampaignStateRepository.getDungeonTilePosition(conn);
    }

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        return CampaignStateRepository.get(conn)
                .map(state -> state.PartyTileId)
                .filter(partyTileId -> partyTileId != null);
    }
}
