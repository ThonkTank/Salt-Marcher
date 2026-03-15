package features.campaignstate.api;

import features.campaignstate.model.CampaignState;
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

    public static Optional<DungeonPositionSummary> getDungeonPosition(Connection conn) throws SQLException {
        return CampaignStateRepository.getDungeonPosition(conn);
    }

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        return CampaignStateRepository.get(conn)
                .map(state -> state.PartyTileId)
                .filter(partyTileId -> partyTileId != null);
    }

    public static Optional<Long> getDungeonMapId(Connection conn) throws SQLException {
        return getDungeonPosition(conn)
                .map(DungeonPositionSummary::mapId)
                .filter(mapId -> mapId != null);
    }
}
