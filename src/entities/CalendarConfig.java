package entities;

/**
 * Calendar definition. Stores month structure in CSV form (as saved to DB).
 * Pure data container — all parsing is done in CalendarService.
 */
public class CalendarConfig {
    public Long CalendarId;
    public String Name;
    /** Comma-separated days per month, e.g. "30,30,30,30,30,30,30,30,30,30,30,30" */
    public String DaysPerMonth;
    /** Comma-separated month names, e.g. "Hammer,Alturiak,..." */
    public String MonthNames;
    /**
     * Special intercalary days: 1-based day-of-year position → name, comma-separated.
     * Each entry occupies a day-of-year slot NOT belonging to any month (intercalary).
     * Do NOT add named holidays that fall on regular month days — that inflates the year
     * length and corrupts all date arithmetic.
     * Example: "31=Midwinter,92=Greengrass,183=Midsummer,274=Highharvestide,335=Feast of the Moon"
     * See CalendarService.fromEpochDay() for usage.
     */
    public String SpecialDays;
    /** Year offset so epoch day 0 = year YearBase, month 1, day 1. */
    public int YearBase;
}
