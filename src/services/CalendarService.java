package services;

import entities.CalendarConfig;
import entities.CalendarDay;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Pure calendar computation — no DB access. All methods are stateless.
 *
 * The Forgotten Realms calendar (Calendar of Harptos) has 12 months of 30 days
 * each, plus 5 intercalary festival days scattered throughout the year (6 in
 * leap years). These are stored in CalendarConfig.SpecialDays as day-of-year
 * → name mappings (day-of-year is 1-based).
 */
public class CalendarService {

    private static final String[] SEASONS = {
        "Winter", "Winter",   // Hammer, Alturiak
        "Spring", "Spring", "Spring", // Ches, Tarsakh, Mirtul
        "Summer", "Summer", "Summer", // Kythorn, Flamerule, Eleasias
        "Autumn", "Autumn", "Autumn", // Eleint, Marpenoth, Uktar
        "Winter"                       // Nightal
    };

    /**
     * Pre-parsed calendar configuration. Compute once per config load via {@link #from(CalendarConfig)},
     * then pass to {@link CalendarService#fromEpochDay(ParsedCalendar, long)} for repeated date conversions.
     */
    public record ParsedCalendar(
            int[] daysPerMonth,
            String[] monthNames,
            Map<Integer, String> specialDays,
            int daysPerYear,
            int yearBase) {

        public static ParsedCalendar from(CalendarConfig config) {
            int[] dpm = parseDaysPerMonth(config);
            Map<Integer, String> sd = parseSpecialDays(config);
            return new ParsedCalendar(dpm, parseMonthNames(config), sd,
                    Arrays.stream(dpm).sum() + sd.size(), config.YearBase);
        }
    }

    /**
     * Converts an epoch day (0-based integer) to a CalendarDay.
     *
     * Algorithm: special intercalary days occupy specific 1-based day-of-year
     * positions (e.g. Midwinter = 31 in a 365-day Forgotten Realms year).
     * Regular month days fill the remaining positions in order. To find the month
     * and day-of-month for a regular day, we subtract the count of special days
     * that occur before it, giving an adjusted position within the 360-day month grid.
     *
     * @param cal      pre-parsed calendar configuration, obtained via {@link ParsedCalendar#from(CalendarConfig)}
     * @param epochDay 0-based day count from the calendar epoch
     */
    public static CalendarDay fromEpochDay(ParsedCalendar cal, long epochDay) {
        int[] daysPerMonth = cal.daysPerMonth();
        String[] monthNames = cal.monthNames();
        Map<Integer, String> specialDays = cal.specialDays();
        int daysPerYear = cal.daysPerYear();

        int year = cal.yearBase() + (int) (epochDay / daysPerYear);
        int dayOfYear = (int) (epochDay % daysPerYear) + 1; // 1-based within year

        CalendarDay day = new CalendarDay();
        day.Year = year;

        // Is this day a special intercalary day?
        String specialName = specialDays.get(dayOfYear);
        if (specialName != null) {
            day.IsSpecialDay = true;
            day.SpecialDayName = specialName;
            day.DayOfMonth = 0;
            // Season: same as the month whose regular days precede this special day
            long regularBefore = dayOfYear - 1
                    - specialDays.keySet().stream().filter(sd -> sd < dayOfYear).count();
            day.Season = seasonForRegularPosition((int) regularBefore, daysPerMonth);
            day.MonthName = "";
            return day;
        }

        // Regular day: subtract special days that fall before this position
        long specialsBefore = specialDays.keySet().stream().filter(sd -> sd < dayOfYear).count();
        int adjustedPos = (int) (dayOfYear - specialsBefore); // 1-based within 360-day grid

        int accumulated = 0;
        for (int m = 0; m < daysPerMonth.length; m++) {
            if (adjustedPos <= accumulated + daysPerMonth[m]) {
                day.Month = m + 1;
                day.MonthName = monthNames[m];
                day.Season = seasonForMonth(m);
                day.DayOfMonth = adjustedPos - accumulated;
                return day;
            }
            accumulated += daysPerMonth[m];
        }

        // Unreachable if DaysPerMonth sums correctly — fail loud if config is inconsistent.
        throw new IllegalStateException(
            "fromEpochDay: adjustedPos=" + adjustedPos
            + " overflows the month grid (total days=" + accumulated
            + "). Check CalendarConfig.DaysPerMonth.");
    }

    /** Finds the season for a 1-based position within the regular (non-special) day grid. */
    private static String seasonForRegularPosition(int regularPos, int[] daysPerMonth) {
        int acc = 0;
        for (int m = 0; m < daysPerMonth.length; m++) {
            acc += daysPerMonth[m];
            if (regularPos <= acc) return seasonForMonth(m);
        }
        return SEASONS[SEASONS.length - 1];
    }

    public static String seasonForMonth(int zeroBasedMonth) {
        if (zeroBasedMonth < 0 || zeroBasedMonth >= SEASONS.length) return "Unknown";
        return SEASONS[zeroBasedMonth];
    }

    private static int[] parseDaysPerMonth(CalendarConfig config) {
        String[] parts = config.DaysPerMonth.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Integer.parseInt(parts[i].trim());
            if (result[i] <= 0) throw new IllegalArgumentException(
                    "days_per_month entries must be positive: " + parts[i].trim());
        }
        return result;
    }

    private static String[] parseMonthNames(CalendarConfig config) {
        String[] parts = config.MonthNames.split(",");
        for (int i = 0; i < parts.length; i++) parts[i] = parts[i].trim();
        return parts;
    }

    private static Map<Integer, String> parseSpecialDays(CalendarConfig config) {
        Map<Integer, String> result = new HashMap<>();
        if (config.SpecialDays == null || config.SpecialDays.isBlank()) return result;
        for (String entry : config.SpecialDays.split(",")) {
            String[] kv = entry.trim().split("=", 2);
            if (kv.length == 2) {
                try { result.put(Integer.parseInt(kv[0].trim()), kv[1].trim()); }
                catch (NumberFormatException ignored) {}
            }
        }
        return result;
    }
}
