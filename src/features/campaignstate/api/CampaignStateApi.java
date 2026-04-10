package features.campaignstate.api;

import features.campaignstate.CampaignstateObject;
import features.campaignstate.input.AdvanceDayInput;
import features.campaignstate.input.AdvancePhaseInput;
import features.campaignstate.input.ClearDungeonPositionInput;
import features.campaignstate.input.ClearPartyTileOutsideRadiusInput;
import features.campaignstate.input.LoadSessionInput;
import features.campaignstate.input.SetDungeonTilePositionInput;
import features.campaignstate.input.UpdatePartyTileInput;
import features.campaignstate.input.UpsertSessionInput;
import features.campaignstate.model.CampaignState;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

@SuppressWarnings("unused")
public final class CampaignStateApi {

    private static final CampaignstateObject CAMPAIGNSTATE_OBJECT = new CampaignstateObject();

    private CampaignStateApi() {
        throw new AssertionError("No instances");
    }

    public static Optional<CampaignState> get(Connection conn) throws SQLException {
        LoadSessionInput.LoadedSessionInput loaded =
                CAMPAIGNSTATE_OBJECT.loadSession(new LoadSessionInput(conn));
        if (!loaded.present()) {
            return Optional.empty();
        }
        CampaignState state = new CampaignState();
        state.CampaignId = loaded.campaignId();
        state.MapId = loaded.mapId();
        state.PartyTileId = loaded.partyTileId();
        state.CalendarId = loaded.calendarId();
        state.CurrentEpochDay = loaded.currentEpochDay();
        state.CurrentPhaseId = loaded.currentPhaseId();
        state.CurrentWeather = loaded.currentWeather();
        state.Notes = loaded.notes();
        state.DungeonMapId = loaded.dungeonMapId();
        state.DungeonLevelZ = loaded.dungeonLevelZ();
        state.DungeonCellX = loaded.dungeonCellX();
        state.DungeonCellY = loaded.dungeonCellY();
        state.DungeonHeading = loaded.dungeonHeading();
        return Optional.of(state);
    }

    public static void upsert(Connection conn, CampaignState state) throws SQLException {
        CAMPAIGNSTATE_OBJECT.upsertSession(new UpsertSessionInput(
                conn,
                state.CampaignId,
                state.MapId,
                state.PartyTileId,
                state.CalendarId,
                state.CurrentEpochDay,
                state.CurrentPhaseId,
                state.CurrentWeather,
                state.Notes,
                state.DungeonMapId,
                state.DungeonLevelZ,
                state.DungeonCellX,
                state.DungeonCellY,
                state.DungeonHeading));
    }

    public static void updatePartyTile(Connection conn, long tileId) throws SQLException {
        CAMPAIGNSTATE_OBJECT.updatePartyTile(new UpdatePartyTileInput(conn, tileId));
    }

    public static void clearPartyTileOutsideRadius(Connection conn, long mapId, int radius) throws SQLException {
        CAMPAIGNSTATE_OBJECT.clearPartyTileOutsideRadius(new ClearPartyTileOutsideRadiusInput(conn, mapId, radius));
    }

    public static void setDungeonTilePosition(Connection conn, DungeonTilePosition position) throws SQLException {
        CAMPAIGNSTATE_OBJECT.setDungeonTilePosition(new SetDungeonTilePositionInput(
                conn,
                position == null ? null : position.mapId(),
                position == null ? null : position.levelZ(),
                position == null ? null : position.cellX(),
                position == null ? null : position.cellY(),
                position == null ? null : position.heading()));
    }

    public static void clearDungeonPosition(Connection conn) throws SQLException {
        CAMPAIGNSTATE_OBJECT.clearDungeonPosition(new ClearDungeonPositionInput(conn));
    }

    public static void advanceDay(Connection conn, int days) throws SQLException {
        CAMPAIGNSTATE_OBJECT.advanceDay(new AdvanceDayInput(conn, days));
    }

    public static void advancePhase(Connection conn) throws SQLException {
        CAMPAIGNSTATE_OBJECT.advancePhase(new AdvancePhaseInput(conn));
    }
}
