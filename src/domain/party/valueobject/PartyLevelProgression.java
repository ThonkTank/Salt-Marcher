package src.domain.party.valueobject;

public final class PartyLevelProgression {

    private static final int[] XP_THRESHOLDS = {
            0,
            0,
            300,
            900,
            2_700,
            6_500,
            14_000,
            23_000,
            34_000,
            48_000,
            64_000,
            85_000,
            100_000,
            120_000,
            140_000,
            165_000,
            195_000,
            225_000,
            265_000,
            305_000,
            355_000
    };

    private static final int MAX_LEVEL = 20;

    private PartyLevelProgression() {
    }

    public static int minimumXpForLevel(int level) {
        return XP_THRESHOLDS[clampLevel(level)];
    }

    public static int nextLevelXp(int level) {
        int safeLevel = clampLevel(level);
        return safeLevel >= MAX_LEVEL ? XP_THRESHOLDS[MAX_LEVEL] : XP_THRESHOLDS[safeLevel + 1];
    }

    public static int normalizeCurrentXpForLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        int normalizedXp = Math.max(minimumXpForLevel(safeLevel), currentXp);
        if (safeLevel >= MAX_LEVEL) {
            return normalizedXp;
        }
        return Math.min(normalizedXp, nextLevelXp(safeLevel) - 1);
    }

    public static int xpToNextLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        if (safeLevel >= MAX_LEVEL) {
            return 0;
        }
        return Math.max(0, nextLevelXp(safeLevel) - Math.max(0, currentXp));
    }

    public static boolean readyToLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        return safeLevel < MAX_LEVEL && Math.max(0, currentXp) >= nextLevelXp(safeLevel);
    }

    public static int clampLevel(int level) {
        return Math.max(1, Math.min(MAX_LEVEL, level));
    }
}
