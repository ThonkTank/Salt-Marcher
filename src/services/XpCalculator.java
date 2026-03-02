package services;

public class XpCalculator {

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
            throw new IllegalArgumentException("Ungültiges Level: " + avgLevel);
        }
        int col = switch (difficulty) {
            case "Easy"   -> EASY;
            case "Medium" -> MEDIUM;
            case "Hard"   -> HARD;
            case "Deadly" -> DEADLY;
            default -> throw new IllegalArgumentException("Ungültige Schwierigkeit: " + difficulty);
        };
        return THRESHOLDS[avgLevel - 1][col];
    }

    /**
     * Interpoliert den XP-Threshold für einen kontinuierlichen Schwierigkeitswert.
     * @param t 0.0 = Easy, 0.333 = Medium, 0.667 = Hard, 1.0 = Deadly
     */
    public static int interpolateThreshold(int avgLevel, double t) {
        avgLevel = Math.max(1, Math.min(20, avgLevel));
        int[] row = THRESHOLDS[avgLevel - 1];

        // t auf den 4-Punkte-Bereich mappen: 0.0→col0, 0.333→col1, 0.667→col2, 1.0→col3
        double scaled = t * 3.0; // 0.0-3.0
        int lower = Math.min((int) scaled, 2);       // 0, 1, oder 2
        int upper = lower + 1;                        // 1, 2, oder 3
        double frac = scaled - lower;                 // 0.0-1.0 innerhalb des Segments

        return (int) (row[lower] + (row[upper] - row[lower]) * frac);
    }

    /** Kategorisiert einen kontinuierlichen Wert in den nächsten Difficulty-String. */
    public static String classifyDifficulty(double t) {
        if (t < 0.167) return "Easy";
        if (t < 0.50)  return "Medium";
        if (t < 0.833) return "Hard";
        return "Deadly";
    }

    /** Kategorisiert anhand von XP-Schwellenwerten (für Encounter-Zusammenfassung). */
    public static String classifyDifficultyByXp(int adjustedXp, int easyTh, int mediumTh,
                                                int hardTh, int deadlyTh) {
        if (adjustedXp >= deadlyTh)  return "Deadly";
        if (adjustedXp >= hardTh)    return "Hard";
        if (adjustedXp >= mediumTh)  return "Medium";
        if (adjustedXp >= easyTh)    return "Easy";
        return "Trivial";
    }
}
