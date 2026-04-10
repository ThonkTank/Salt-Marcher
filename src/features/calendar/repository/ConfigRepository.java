package features.calendar.repository;

import features.calendar.state.CalendarConfigState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

@SuppressWarnings("unused")
public final class ConfigRepository {

    private ConfigRepository() {
        throw new AssertionError("No instances");
    }

    public static Optional<CalendarConfigState> loadCalendar(Connection conn, long calendarId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM calendar_config WHERE calendar_id=?")) {
            ps.setLong(1, calendarId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public static Optional<CalendarConfigState> loadDefaultCalendar(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM calendar_config ORDER BY calendar_id ASC LIMIT 1")) {
            if (rs.next()) {
                return Optional.of(mapRow(rs));
            }
        }
        return Optional.empty();
    }

    private static CalendarConfigState mapRow(ResultSet rs) throws SQLException {
        return new CalendarConfigState(
                rs.getLong("calendar_id"),
                rs.getString("name"),
                rs.getString("days_per_month"),
                rs.getString("month_names"),
                rs.getString("special_days"),
                rs.getInt("year_base"));
    }
}
