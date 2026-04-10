package features.campaignstate.api;

import features.campaignstate.CampaignstateObject;
import features.campaignstate.input.LoadDungeonTilePositionInput;
import features.campaignstate.input.LoadPartyTileInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Public cross-feature read facade for focused campaign-state reads.
 */
@SuppressWarnings("unused")
public final class CampaignStateReadApi {

    private static final CampaignstateObject CAMPAIGNSTATE_OBJECT = new CampaignstateObject();

    private CampaignStateReadApi() {
        throw new AssertionError("No instances");
    }

    public static Optional<DungeonTilePosition> getDungeonTilePosition(Connection conn) throws SQLException {
        LoadDungeonTilePositionInput.LoadedDungeonTilePositionInput loaded =
                CAMPAIGNSTATE_OBJECT.loadDungeonTilePosition(new LoadDungeonTilePositionInput(conn));
        if (!loaded.present()) {
            return Optional.empty();
        }
        return Optional.of(new DungeonTilePosition(
                loaded.mapId(),
                loaded.levelZ(),
                loaded.cellX(),
                loaded.cellY(),
                loaded.heading()));
    }

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        LoadPartyTileInput.LoadedPartyTileInput loaded = CAMPAIGNSTATE_OBJECT.loadPartyTile(new LoadPartyTileInput(conn));
        return loaded.present() ? Optional.ofNullable(loaded.tileId()) : Optional.empty();
    }
}
