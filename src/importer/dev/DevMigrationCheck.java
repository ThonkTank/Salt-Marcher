package importer.dev;

import database.DatabaseManager;
import repositories.CalendarRepository;
import repositories.CampaignStateRepository;
import repositories.FactionRepository;
import services.CalendarService;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Manual harness to verify schema setup and basic repository calls.
 *
 * Run after compiling with the standard javac command:
 *   java -cp "out:lib/sqlite-jdbc.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" \
 *        importer.dev.DevMigrationCheck
 *
 * Expected output: all tables present, epoch 0 = Hammer 1, 1 DR.
 */
public class DevMigrationCheck {

    public static void main(String[] args) throws Exception {
        DatabaseManager.setupDatabase();

        try (Connection conn = DatabaseManager.getConnection();
             Statement stmt = conn.createStatement()) {

            // Tables
            try (ResultSet rs = stmt.executeQuery("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")) {
                System.out.print("tables: ");
                while (rs.next()) System.out.print(rs.getString(1) + "  ");
                System.out.println();
            }

            // Time phases
            try (ResultSet rs = stmt.executeQuery("SELECT phase_name, display_order, is_dark FROM time_of_day_phases ORDER BY display_order")) {
                System.out.println("time_of_day_phases:");
                while (rs.next()) {
                    System.out.printf("  %d. %-20s dark=%d%n", rs.getInt(2), rs.getString(1), rs.getInt(3));
                }
            }

            // Calendar
            CalendarRepository.getDefault(conn).ifPresentOrElse(
                c -> System.out.printf("calendar: %s (base year %d)%n", c.Name, c.YearBase),
                () -> System.out.println("calendar: MISSING"));

            // Campaign state
            CampaignStateRepository.get(conn).ifPresentOrElse(
                s -> System.out.printf("campaign_state: epoch=%d phase=%s weather=%s%n",
                    s.CurrentEpochDay, s.CurrentPhaseId, s.CurrentWeather),
                () -> System.out.println("campaign_state: MISSING"));

            // Factions
            System.out.println("factions: " + FactionRepository.findAll(conn).size() + " rows");

            // CalendarService
            CalendarRepository.getDefault(conn).ifPresent(cfg -> {
                var cal = CalendarService.ParsedCalendar.from(cfg);
                var day = CalendarService.fromEpochDay(cal, 0);
                System.out.printf("epoch 0 = %s (season: %s)%n", day.format(), day.Season);
                day = CalendarService.fromEpochDay(cal, 91);
                System.out.printf("epoch 91 = %s (special: %b, name: %s)%n",
                    day.format(), day.IsSpecialDay, day.SpecialDayName);
                day = CalendarService.fromEpochDay(cal, 365);
                System.out.printf("epoch 365 = %s (season: %s)%n", day.format(), day.Season);
            });
        }
    }
}
