package features.calendar.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadCalendarInput(Connection connection, long calendarId) {

    public record LoadedCalendarInput(
            boolean present,
            Long calendarId,
            String name,
            String daysPerMonth,
            String monthNames,
            String specialDays,
            int yearBase
    ) {
    }
}
