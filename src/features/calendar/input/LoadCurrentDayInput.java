package features.calendar.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadCurrentDayInput(Connection connection) {

    public record LoadedCurrentDayInput(
            boolean present,
            Long calendarId,
            long epochDay,
            Long phaseId,
            int year,
            int month,
            int dayOfMonth,
            String monthName,
            String season,
            String specialDayName,
            boolean specialDay,
            String formattedDay
    ) {
    }
}
