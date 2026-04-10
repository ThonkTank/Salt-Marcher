package features.calendar.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadDefaultCalendarInput(Connection connection) {

    public record LoadedDefaultCalendarInput(
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
