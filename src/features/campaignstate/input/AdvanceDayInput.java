package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record AdvanceDayInput(Connection connection, int days) {
}
