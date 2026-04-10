package features.world.hexmap.service.adapter;

import features.campaignstate.CampaignstateObject;
import features.campaignstate.input.ClearPartyTileOutsideRadiusInput;
import features.campaignstate.input.LoadPartyTileInput;
import features.campaignstate.input.UpdatePartyTileInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

/**
 * Hexmap-scoped adapter around global campaign state persistence.
 * Keeps world/hexmap features decoupled from the full campaign-state API surface.
 */
@SuppressWarnings("unused")
public final class HexMapCampaignStateAdapter {

    private static final CampaignstateObject CAMPAIGNSTATE_OBJECT = new CampaignstateObject();

    private HexMapCampaignStateAdapter() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getPartyTileId(Connection conn) throws SQLException {
        LoadPartyTileInput.LoadedPartyTileInput loaded = CAMPAIGNSTATE_OBJECT.loadPartyTile(new LoadPartyTileInput(conn));
        return loaded.present() ? Optional.ofNullable(loaded.tileId()) : Optional.empty();
    }

    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        CAMPAIGNSTATE_OBJECT.updatePartyTile(new UpdatePartyTileInput(conn, tileId));
    }

    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int radius) throws SQLException {
        CAMPAIGNSTATE_OBJECT.clearPartyTileOutsideRadius(new ClearPartyTileOutsideRadiusInput(conn, mapId, radius));
    }
}
