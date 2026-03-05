package entities;

/**
 * A computed value object representing a single day in the campaign calendar.
 * Not stored in the database — derived from CalendarConfig + epoch day integer.
 */
public class CalendarDay {
    public int Year;
    public int Month;           // 1-based
    public int DayOfMonth;      // 1-based
    public String MonthName;
    public String Season;       // Winter, Spring, Summer, Autumn
    /** Name of this intercalary festival day (e.g. "Midwinter"); null on regular days. */
    public String SpecialDayName;
    public boolean IsSpecialDay;

    public String format() {
        if (IsSpecialDay) {  // SpecialDayName is always non-null on special days
            return SpecialDayName + " " + Year;
        }
        return MonthName + " " + DayOfMonth + ", " + Year;
    }
}
