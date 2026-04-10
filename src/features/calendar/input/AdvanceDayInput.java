package features.calendar.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record AdvanceDayInput(Connection connection, int days) {
}
