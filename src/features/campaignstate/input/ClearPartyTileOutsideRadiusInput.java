package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record ClearPartyTileOutsideRadiusInput(Connection connection, long mapId, int radius) {
}
