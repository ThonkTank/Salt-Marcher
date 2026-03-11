package features.campaignstate.api;

import features.campaignstate.model.CampaignState;
import features.campaignstate.model.DungeonPositionSnapshot;
import features.campaignstate.repository.CampaignStateRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

public final class CampaignStateApi {

    public record DungeonPosition(Long mapId, Long endpointId) {}

    private CampaignStateApi() {
        throw new AssertionError("No instances");
    }

    public static Optional<CampaignState> get(Connection conn) throws SQLException {
        return CampaignStateRepository.get(conn);
    }

    public static void upsert(Connection conn, CampaignState state) throws SQLException {
        CampaignStateRepository.upsert(conn, state);
    }

    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        CampaignStateRepository.updatePartyTile(conn, tileId);
    }

    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int radius) throws SQLException {
        CampaignStateRepository.clearPartyTileOutsideRadius(conn, mapId, radius);
    }

    public static Optional<DungeonPosition> getDungeonPosition(Connection conn) throws SQLException {
        return CampaignStateRepository.getDungeonPosition(conn)
                .map(position -> new DungeonPosition(position.mapId(), position.endpointId()));
    }

    public static void updateDungeonPosition(Connection conn, Long mapId, Long endpointId) throws SQLException {
        CampaignStateRepository.updateDungeonPosition(conn, mapId, endpointId);
    }

    public static void clearDungeonPosition(Connection conn) throws SQLException {
        CampaignStateRepository.clearDungeonPosition(conn);
    }

    public static void advanceDay(Connection conn, int days) throws SQLException {
        CampaignStateRepository.advanceDay(conn, days);
    }

    public static void advancePhase(Connection conn) throws SQLException {
        CampaignStateRepository.advancePhase(conn);
    }
}
