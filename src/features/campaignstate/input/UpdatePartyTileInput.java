package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record UpdatePartyTileInput(Connection connection, long tileId) {
}
