package features.calendar.model;

/**
 * A computed value object representing a single day in the campaign calendar.
 * Not stored in the database — derived from CalendarConfig + epoch day integer.
 */
public final class CalendarDay {
    public final int Year;
    public final int Month;           // 1-based, 0 for special days
    public final int DayOfMonth;      // 1-based, 0 for special days
    public final String MonthName;
    public final String Season;       // Winter, Spring, Summer, Autumn
    /** Name of this intercalary festival day (e.g. "Midwinter"); null on regular days. */
    public final String SpecialDayName;
    public final boolean IsSpecialDay;

    private CalendarDay(
            int year,
            int month,
            int dayOfMonth,
            String monthName,
            String season,
            String specialDayName,
            boolean isSpecialDay) {
        Year = year;
        Month = month;
        DayOfMonth = dayOfMonth;
        MonthName = monthName;
        Season = season;
        SpecialDayName = specialDayName;
        IsSpecialDay = isSpecialDay;

        if (Season == null || Season.isBlank()) {
            throw new IllegalArgumentException("season must be non-blank");
        }
        if (IsSpecialDay) {
            if (SpecialDayName == null || SpecialDayName.isBlank()) {
                throw new IllegalArgumentException("specialDayName must be non-blank on special days");
            }
            if (Month != 0 || DayOfMonth != 0) {
                throw new IllegalArgumentException("special days must not set month/dayOfMonth");
            }
            if (MonthName == null) {
                throw new IllegalArgumentException("monthName must be non-null");
            }
            return;
        }

        if (Month < 1) {
            throw new IllegalArgumentException("month must be >= 1 on regular days");
        }
        if (DayOfMonth < 1) {
            throw new IllegalArgumentException("dayOfMonth must be >= 1 on regular days");
        }
        if (MonthName == null || MonthName.isBlank()) {
            throw new IllegalArgumentException("monthName must be non-blank on regular days");
        }
        if (SpecialDayName != null) {
            throw new IllegalArgumentException("specialDayName must be null on regular days");
        }
    }

    public static CalendarDay regular(
            int year,
            int month,
            int dayOfMonth,
            String monthName,
            String season) {
        return new CalendarDay(year, month, dayOfMonth, monthName, season, null, false);
    }

    public static CalendarDay special(
            int year,
            String specialDayName,
            String season) {
        return new CalendarDay(year, 0, 0, "", season, specialDayName, true);
    }

    public String format() {
        if (IsSpecialDay) {  // SpecialDayName is always non-null on special days
            return SpecialDayName + " " + Year;
        }
        return MonthName + " " + DayOfMonth + ", " + Year;
    }
}
