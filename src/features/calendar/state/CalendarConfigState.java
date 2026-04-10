package features.calendar.state;

@SuppressWarnings("unused")
public record CalendarConfigState(
        long calendarId,
        String name,
        String daysPerMonth,
        String monthNames,
        String specialDays,
        int yearBase
) {
}
