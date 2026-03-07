package features.calendar.service;

import features.calendar.model.CalendarConfig;
import features.calendar.model.CalendarDay;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Pure calendar computation — no DB access. All methods are stateless.
 *
 * The Forgotten Realms calendar (Calendar of Harptos) has 12 months of 30 days
 * each, plus 5 intercalary festival days scattered throughout the year (6 in
 * leap years). These are stored in CalendarConfig.SpecialDays as day-of-year
 * → name mappings (day-of-year is 1-based).
 */
public final class CalendarService {

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

        public ParsedCalendar {
            Objects.requireNonNull(daysPerMonth, "daysPerMonth");
            Objects.requireNonNull(monthNames, "monthNames");
            Objects.requireNonNull(specialDays, "specialDays");

            if (daysPerMonth.length == 0) {
                throw new IllegalArgumentException("daysPerMonth must contain at least one month");
            }
            if (monthNames.length != daysPerMonth.length) {
                throw new IllegalArgumentException(
                        "monthNames length (" + monthNames.length
                                + ") must match daysPerMonth length (" + daysPerMonth.length + ")");
            }
            for (int i = 0; i < monthNames.length; i++) {
                String name = monthNames[i];
                if (name == null || name.isBlank()) {
                    throw new IllegalArgumentException("monthNames[" + i + "] must be non-blank");
                }
            }
            if (daysPerYear <= 0) {
                throw new IllegalArgumentException("daysPerYear must be positive: " + daysPerYear);
            }

            daysPerMonth = Arrays.copyOf(daysPerMonth, daysPerMonth.length);
            monthNames = Arrays.copyOf(monthNames, monthNames.length);
            specialDays = Map.copyOf(specialDays);

            for (Integer position : specialDays.keySet()) {
                if (position == null || position < 1 || position > daysPerYear) {
                    throw new IllegalArgumentException(
                            "specialDays position out of range 1.." + daysPerYear + ": " + position);
                }
            }
            int computedDaysPerYear = Arrays.stream(daysPerMonth).sum() + specialDays.size();
            if (computedDaysPerYear != daysPerYear) {
                throw new IllegalArgumentException(
                        "daysPerYear mismatch: expected " + computedDaysPerYear + " but got " + daysPerYear);
            }
        }

        @Override
        public int[] daysPerMonth() {
            return Arrays.copyOf(daysPerMonth, daysPerMonth.length);
        }

        @Override
        public String[] monthNames() {
            return Arrays.copyOf(monthNames, monthNames.length);
        }

        public static ParsedCalendar from(CalendarConfig config) {
            Objects.requireNonNull(config, "config");
            int[] dpm = parseDaysPerMonth(config);
            String[] names = parseMonthNames(config);
            Map<Integer, String> sd = parseSpecialDays(config);
            int daysPerYear = Arrays.stream(dpm).sum() + sd.size();
            return new ParsedCalendar(dpm, names, sd, daysPerYear, config.YearBase);
        }
    }

    private CalendarService() {
        throw new AssertionError("No instances");
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
        Objects.requireNonNull(cal, "cal");
        int[] daysPerMonth = cal.daysPerMonth;
        String[] monthNames = cal.monthNames;
        Map<Integer, String> specialDays = cal.specialDays;
        int daysPerYear = cal.daysPerYear;

        int year = cal.yearBase() + Math.toIntExact(Math.floorDiv(epochDay, daysPerYear));
        int dayOfYear = Math.floorMod(epochDay, daysPerYear) + 1; // 1-based within year

        // Is this day a special intercalary day?
        String specialName = specialDays.get(dayOfYear);
        if (specialName != null) {
            // Season: same as the month whose regular days precede this special day
            long regularBefore = dayOfYear - 1
                    - specialDays.keySet().stream().filter(sd -> sd < dayOfYear).count();
            return CalendarDay.special(year, specialName, seasonForRegularPosition((int) regularBefore, daysPerMonth));
        }

        // Regular day: subtract special days that fall before this position
        long specialsBefore = specialDays.keySet().stream().filter(sd -> sd < dayOfYear).count();
        int adjustedPos = (int) (dayOfYear - specialsBefore); // 1-based within 360-day grid

        int accumulated = 0;
        for (int m = 0; m < daysPerMonth.length; m++) {
            if (adjustedPos <= accumulated + daysPerMonth[m]) {
                return CalendarDay.regular(
                        year,
                        m + 1,
                        adjustedPos - accumulated,
                        monthNames[m],
                        seasonForMonth(m));
            }
            accumulated += daysPerMonth[m];
        }

        // Unreachable if DaysPerMonth sums correctly — fail loud if config is inconsistent.
        throw new IllegalStateException(
            "fromEpochDay: adjustedPos=" + adjustedPos
            + " overflows the month grid (total days=" + accumulated
            + "). Check CalendarConfig.DaysPerMonth.");
    }

    /** Finds season by elapsed regular (non-special) day count before the target day. */
    private static String seasonForRegularPosition(int regularPos, int[] daysPerMonth) {
        if (regularPos <= 0) return seasonForMonth(0);
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
        if (config.DaysPerMonth == null || config.DaysPerMonth.isBlank()) {
            throw new IllegalArgumentException("DaysPerMonth must be non-blank");
        }
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
        if (config.MonthNames == null || config.MonthNames.isBlank()) {
            throw new IllegalArgumentException("MonthNames must be non-blank");
        }
        String[] parts = config.MonthNames.split(",");
        for (int i = 0; i < parts.length; i++) {
            parts[i] = parts[i].trim();
            if (parts[i].isEmpty()) {
                throw new IllegalArgumentException("MonthNames contains an empty entry at index " + i);
            }
        }
        return parts;
    }

    private static Map<Integer, String> parseSpecialDays(CalendarConfig config) {
        Map<Integer, String> result = new HashMap<>();
        if (config.SpecialDays == null || config.SpecialDays.isBlank()) return result;
        for (String entry : config.SpecialDays.split(",")) {
            String trimmed = entry.trim();
            if (trimmed.isEmpty()) {
                throw new IllegalArgumentException("SpecialDays contains an empty entry");
            }
            String[] kv = trimmed.split("=", 2);
            if (kv.length != 2) {
                throw new IllegalArgumentException("Invalid SpecialDays entry: " + trimmed);
            }
            int dayOfYear;
            try {
                dayOfYear = Integer.parseInt(kv[0].trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid SpecialDays day-of-year: " + kv[0].trim(), e);
            }
            String name = kv[1].trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("SpecialDays name must be non-blank for day " + dayOfYear);
            }
            String previous = result.put(dayOfYear, name);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate SpecialDays day-of-year: " + dayOfYear);
            }
        }
        return result;
    }
}
