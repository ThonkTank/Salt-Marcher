package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadSessionInput(Connection connection) {

    public record LoadedSessionInput(
            boolean present,
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
    }
}
