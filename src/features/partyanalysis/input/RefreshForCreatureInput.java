package features.partyanalysis.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record RefreshForCreatureInput(Connection connection, long creatureId) {

    public record RefreshedForCreatureInput() {
    }
}
