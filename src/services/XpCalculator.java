package services;

import java.util.List;
import java.util.Map;

public class XpCalculator {

    // ---- CR-to-XP mapping (standard 5e SRD) ----
    private static final Map<String, Integer> CR_TO_XP = Map.ofEntries(
        Map.entry("0",   10),    Map.entry("1/8",  25),
        Map.entry("1/4", 50),    Map.entry("1/2",  100),
        Map.entry("1",   200),   Map.entry("2",    450),
        Map.entry("3",   700),   Map.entry("4",    1100),
        Map.entry("5",   1800),  Map.entry("6",    2300),
        Map.entry("7",   2900),  Map.entry("8",    3900),
        Map.entry("9",   5000),  Map.entry("10",   5900),
        Map.entry("11",  7200),  Map.entry("12",   8400),
        Map.entry("13",  10000), Map.entry("14",   11500),
        Map.entry("15",  13000), Map.entry("16",   15000),
        Map.entry("17",  18000), Map.entry("18",   20000),
        Map.entry("19",  22000), Map.entry("20",   25000),
        Map.entry("21",  33000), Map.entry("22",   41000),
        Map.entry("23",  50000), Map.entry("24",   62000),
        Map.entry("25",  75000), Map.entry("26",   90000),
        Map.entry("27",  105000), Map.entry("28",  120000),
        Map.entry("29",  135000), Map.entry("30",  155000)
    );

    // Ordered CR values for display (CRs do not sort lexicographically).
    private static final List<String> CR_ORDER = List.of(
        "0", "1/8", "1/4", "1/2",
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
        "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"
    );

    public static List<String> getCrValues() {
        return CR_ORDER;
    }

    public static Integer xpForCr(String cr) {
        return CR_TO_XP.get(cr);
    }

    // Source: D&D 5e Dungeon Master's Guide (2014), p.82, Table: XP Thresholds by Character Level.
    // Rows: Level 1-20 (Index 0-19), Columns: Easy, Medium, Hard, Deadly
    private static final int[][] THRESHOLDS = {
    //   Easy   Medium   Hard  Deadly
        {  25,     50,    75,   100},  // Level  1
        {  50,    100,   150,   200},  // Level  2
        {  75,    150,   225,   400},  // Level  3
        { 125,    250,   375,   500},  // Level  4
        { 250,    500,   750,  1100},  // Level  5
        { 300,    600,   900,  1400},  // Level  6
        { 350,    750,  1100,  1700},  // Level  7
        { 450,    900,  1400,  2100},  // Level  8
        { 550,   1100,  1600,  2400},  // Level  9
        { 600,   1200,  1900,  2800},  // Level 10
        { 800,   1600,  2400,  3600},  // Level 11
        {1000,   2000,  3000,  4500},  // Level 12
        {1100,   2200,  3400,  5100},  // Level 13
        {1250,   2500,  3800,  5700},  // Level 14
        {1400,   2800,  4300,  6400},  // Level 15
        {1600,   3200,  4800,  7200},  // Level 16
        {2000,   3900,  5900,  8800},  // Level 17
        {2100,   4200,  6300,  9500},  // Level 18
        {2400,   4900,  7300, 10900},  // Level 19
        {2800,   5700,  8500, 12700},  // Level 20
    };

    private static final int EASY = 0, MEDIUM = 1, HARD = 2, DEADLY = 3;

    public static int getXpThreshold(int avgLevel, String difficulty) {
        if (avgLevel < 1 || avgLevel > 20) {
            throw new IllegalArgumentException("Invalid level: " + avgLevel);
        }
        int col = switch (difficulty) {
            case "Easy"   -> EASY;
            case "Medium" -> MEDIUM;
            case "Hard"   -> HARD;
            case "Deadly" -> DEADLY;
            default -> throw new IllegalArgumentException("Invalid difficulty: " + difficulty);
        };
        return THRESHOLDS[avgLevel - 1][col];
    }

    /**
     * Interpolates the XP threshold for a continuous difficulty value.
     * @param t continuous difficulty: 0.0 = Easy, 0.333 = Medium, 0.667 = Hard, 1.0 = Deadly
     *          (midpoints of the four columns in the DMG XP threshold table)
     */
    public static int interpolateThreshold(int avgLevel, double t) {
        avgLevel = Math.max(1, Math.min(20, avgLevel));
        int[] row = THRESHOLDS[avgLevel - 1];

        // Map [0,1] to [0,3]: 3 intervals cover 4 boundary columns (Easy/Medium/Hard/Deadly).
        // t=0.0→col0 (Easy), t≈0.333→col1 (Medium), t≈0.667→col2 (Hard), t=1.0→col3 (Deadly).
        double scaled = t * 3.0; // [0.0, 3.0]
        int lower = Math.min((int) scaled, 2);       // 0, 1, or 2
        int upper = lower + 1;                        // 1, 2, or 3
        double frac = scaled - lower;                 // 0.0-1.0 within the segment

        return (int) (row[lower] + (row[upper] - row[lower]) * frac);
    }

    /**
     * Maps a continuous difficulty value to the nearest difficulty label.
     * Boundaries are set at the midpoints between the column indices used by
     * {@link #interpolateThreshold} (0.0, 0.333, 0.667, 1.0):
     * <pre>
     *   [0.0,   0.167) → Easy   (centre: 0.0)
     *   [0.167, 0.50)  → Medium (centre: 0.333)
     *   [0.50,  0.833) → Hard   (centre: 0.667)
     *   [0.833, 1.0]   → Deadly (centre: 1.0)
     * </pre>
     */
    public static String classifyDifficulty(double t) {
        if (t < 0.167) return "Easy";
        if (t < 0.50)  return "Medium";
        if (t < 0.833) return "Hard";
        return "Deadly";
    }

    // ---- DifficultyStats: shared between EncounterRosterPane and CombatTrackerPane ----

    public record DifficultyStats(int adjXp, String difficulty,
                                  int easyTh, int mediumTh, int hardTh, int deadlyTh) {}

    public static DifficultyStats computeStats(int adjXp, int partySize, int avgLevel) {
        int partySz = Math.max(1, partySize);
        int easyTh   = getXpThreshold(avgLevel, "Easy")   * partySz;
        int mediumTh = getXpThreshold(avgLevel, "Medium") * partySz;
        int hardTh   = getXpThreshold(avgLevel, "Hard")   * partySz;
        int deadlyTh = getXpThreshold(avgLevel, "Deadly") * partySz;
        String diff = adjXp == 0 ? "" :
                classifyDifficultyByXp(adjXp, easyTh, mediumTh, hardTh, deadlyTh);
        return new DifficultyStats(adjXp, diff, easyTh, mediumTh, hardTh, deadlyTh);
    }

    /** Compute difficulty stats from a roster of encounter slots. */
    public static DifficultyStats computeStatsFromSlots(
            List<EncounterSlot> slots, int partySize, int avgLevel) {
        return computeStats(EncounterGenerator.adjustedXp(slots), partySize, avgLevel);
    }

    /** Categorizes by XP thresholds (for encounter summary display). */
    public static String classifyDifficultyByXp(int adjustedXp, int easyTh, int mediumTh,
                                                int hardTh, int deadlyTh) {
        if (adjustedXp >= deadlyTh)  return "Deadly";
        if (adjustedXp >= hardTh)    return "Hard";
        if (adjustedXp >= mediumTh)  return "Medium";
        if (adjustedXp >= easyTh)    return "Easy";
        return "Trivial";
    }
}
