package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadPartyTileInput(Connection connection) {

    public record LoadedPartyTileInput(boolean present, Long tileId) {
    }
}
