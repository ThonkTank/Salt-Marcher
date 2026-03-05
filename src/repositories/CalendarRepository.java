package repositories;

import entities.CalendarConfig;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

public class CalendarRepository {

    public static long insertConfig(Connection conn, CalendarConfig config) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO calendar_config(name, days_per_month, month_names, special_days, year_base) VALUES(?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, config.Name);
                ps.setString(2, config.DaysPerMonth);
                ps.setString(3, config.MonthNames);
                ps.setString(4, config.SpecialDays);
                ps.setInt(5, config.YearBase);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    return keys.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("CalendarRepository.insertConfig(): " + e.getMessage());
            return 0L;
        }
    }

    public static Optional<CalendarConfig> getConfig(Connection conn, long calendarId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM calendar_config WHERE calendar_id=?")) {
                ps.setLong(1, calendarId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("CalendarRepository.getConfig(): " + e.getMessage());
            return Optional.empty();
        }
    }

    /** Returns the first (default) calendar config, or empty if none exists. */
    public static Optional<CalendarConfig> getDefault(Connection conn) {
        try {
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM calendar_config LIMIT 1")) {
                if (rs.next()) return Optional.of(mapRow(rs));
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("CalendarRepository.getDefault(): " + e.getMessage());
            return Optional.empty();
        }
    }

    private static CalendarConfig mapRow(ResultSet rs) throws SQLException {
        CalendarConfig c = new CalendarConfig();
        c.CalendarId = rs.getLong("calendar_id");
        c.Name = rs.getString("name");
        c.DaysPerMonth = rs.getString("days_per_month");
        c.MonthNames = rs.getString("month_names");
        c.SpecialDays = rs.getString("special_days");
        c.YearBase = rs.getInt("year_base");
        return c;
    }
}
