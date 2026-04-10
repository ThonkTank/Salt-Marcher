package features.campaignstate;

import features.campaignstate.input.AdvanceDayInput;
import features.campaignstate.input.AdvancePhaseInput;
import features.campaignstate.input.ClearDungeonPositionInput;
import features.campaignstate.input.ClearPartyTileOutsideRadiusInput;
import features.campaignstate.input.LoadDungeonTilePositionInput;
import features.campaignstate.input.LoadPartyTileInput;
import features.campaignstate.input.LoadSessionInput;
import features.campaignstate.input.SetDungeonTilePositionInput;
import features.campaignstate.input.UpdatePartyTileInput;
import features.campaignstate.input.UpsertSessionInput;
import features.campaignstate.repository.CampaignstateRepository;
import features.campaignstate.state.AdvanceDayState;
import features.campaignstate.state.AdvancePhaseState;
import features.campaignstate.state.CampaignStateState;
import features.campaignstate.state.DungeonTilePositionState;
import features.campaignstate.state.PartyTileRadiusState;
import features.campaignstate.state.PartyTileState;

import java.sql.SQLException;

/**
 * Canonical root seam for the persisted world-session aggregate in
 * {@code campaign_state}.
 */
@SuppressWarnings("unused")
public final class CampaignstateObject {

    public LoadSessionInput.LoadedSessionInput loadSession(LoadSessionInput input) throws SQLException {
        return CampaignstateRepository.loadCampaignState(input.connection())
                .map(state -> new LoadSessionInput.LoadedSessionInput(
                        true,
                        state.campaignId(),
                        state.mapId(),
                        state.partyTileId(),
                        state.calendarId(),
                        state.currentEpochDay(),
                        state.currentPhaseId(),
                        state.currentWeather(),
                        state.notes(),
                        state.dungeonMapId(),
                        state.dungeonLevelZ(),
                        state.dungeonCellX(),
                        state.dungeonCellY(),
                        state.dungeonHeading()))
                .orElse(new LoadSessionInput.LoadedSessionInput(
                        false,
                        1L,
                        null,
                        null,
                        null,
                        0L,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null));
    }

    public LoadPartyTileInput.LoadedPartyTileInput loadPartyTile(LoadPartyTileInput input) throws SQLException {
        return CampaignstateRepository.loadPartyTile(input.connection())
                .map(state -> new LoadPartyTileInput.LoadedPartyTileInput(true, state.tileId()))
                .orElse(new LoadPartyTileInput.LoadedPartyTileInput(false, null));
    }

    public LoadDungeonTilePositionInput.LoadedDungeonTilePositionInput loadDungeonTilePosition(
            LoadDungeonTilePositionInput input
    ) throws SQLException {
        return CampaignstateRepository.loadDungeonTilePosition(input.connection())
                .map(state -> new LoadDungeonTilePositionInput.LoadedDungeonTilePositionInput(
                        true,
                        state.mapId(),
                        state.levelZ(),
                        state.cellX(),
                        state.cellY(),
                        state.heading()))
                .orElse(new LoadDungeonTilePositionInput.LoadedDungeonTilePositionInput(
                        false,
                        null,
                        null,
                        null,
                        null,
                        null));
    }

    public void upsertSession(UpsertSessionInput input) throws SQLException {
        CampaignstateRepository.upsertCampaignState(
                input.connection(),
                CampaignStateState.upsertSession(input));
    }

    public void updatePartyTile(UpdatePartyTileInput input) throws SQLException {
        CampaignstateRepository.updatePartyTile(input.connection(), PartyTileState.updatePartyTile(input));
    }

    public void clearPartyTileOutsideRadius(ClearPartyTileOutsideRadiusInput input) throws SQLException {
        CampaignstateRepository.clearPartyTileOutsideRadius(
                input.connection(),
                PartyTileRadiusState.clearPartyTileOutsideRadius(input));
    }

    public void setDungeonTilePosition(SetDungeonTilePositionInput input) throws SQLException {
        CampaignstateRepository.saveDungeonTilePosition(
                input.connection(),
                DungeonTilePositionState.setDungeonTilePosition(input));
    }

    public void clearDungeonPosition(ClearDungeonPositionInput input) throws SQLException {
        CampaignstateRepository.saveDungeonTilePosition(
                input.connection(),
                DungeonTilePositionState.clearDungeonPosition(input));
    }

    public void advanceDay(AdvanceDayInput input) throws SQLException {
        CampaignstateRepository.advanceDay(input.connection(), AdvanceDayState.advanceDay(input));
    }

    public void advancePhase(AdvancePhaseInput input) throws SQLException {
        CampaignstateRepository.advancePhase(input.connection(), AdvancePhaseState.advancePhase(input));
    }
}
