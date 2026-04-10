package features.campaignstate.state;

import features.campaignstate.input.UpsertSessionInput;

@SuppressWarnings("unused")
public record CampaignStateState(
        long campaignId,
        Long mapId,
        Long partyTileId,
        Long calendarId,
        long currentEpochDay,
        Long currentPhaseId,
        String currentWeather,
        String notes,
        Long dungeonMapId,
        Integer dungeonLevelZ,
        Integer dungeonCellX,
        Integer dungeonCellY,
        String dungeonHeading
) {

    public static CampaignStateState upsertSession(UpsertSessionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new CampaignStateState(
                input.campaignId(),
                input.mapId(),
                input.partyTileId(),
                input.calendarId(),
                input.currentEpochDay(),
                input.currentPhaseId(),
                input.currentWeather(),
                input.notes(),
                input.dungeonMapId(),
                input.dungeonLevelZ(),
                input.dungeonCellX(),
                input.dungeonCellY(),
                input.dungeonHeading());
    }
}
