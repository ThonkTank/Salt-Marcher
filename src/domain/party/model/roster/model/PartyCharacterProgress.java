package src.domain.party.model.roster.model;

public record PartyCharacterProgress(
        int level,
        int currentXp,
        int xpSinceLongRest,
        int xpSinceShortRest,
        int shortRestsTakenSinceLongRest
) {
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

    public PartyCharacterProgress {
        level = clampLevel(level);
        currentXp = Math.max(0, currentXp);
        xpSinceLongRest = Math.max(0, xpSinceLongRest);
        xpSinceShortRest = Math.max(0, xpSinceShortRest);
        shortRestsTakenSinceLongRest = Math.max(0, Math.min(2, shortRestsTakenSinceLongRest));
    }

    public static PartyCharacterProgress startingAtLevel(int level) {
        int safeLevel = clampLevel(level);
        return new PartyCharacterProgress(safeLevel, minimumXpForLevel(safeLevel), 0, 0, 0);
    }

    public PartyCharacterProgress withLevel(int nextLevel) {
        return new PartyCharacterProgress(
                nextLevel,
                normalizeCurrentXpForLevel(nextLevel, currentXp),
                xpSinceLongRest,
                xpSinceShortRest,
                shortRestsTakenSinceLongRest);
    }

    public PartyCharacterProgress adjustXp(int xpDelta) {
        int minimumXp = minimumXpForLevel(level);
        int lowerBound = xpDelta < 0 ? Math.min(currentXp, minimumXp) : 0;
        int nextCurrentXp = Math.max(lowerBound, currentXp + xpDelta);
        int appliedDelta = nextCurrentXp - currentXp;
        return new PartyCharacterProgress(
                level,
                nextCurrentXp,
                Math.max(0, xpSinceLongRest + appliedDelta),
                Math.max(0, xpSinceShortRest + appliedDelta),
                shortRestsTakenSinceLongRest);
    }

    public PartyCharacterProgress afterRest(PartyRestType restType) {
        if (restType.isShortRest()) {
            return new PartyCharacterProgress(
                    level,
                    currentXp,
                    xpSinceLongRest,
                    0,
                    Math.min(2, shortRestsTakenSinceLongRest + 1));
        }
        return new PartyCharacterProgress(level, currentXp, 0, 0, 0);
    }

    public static int clampLevel(int value) {
        return Math.max(1, Math.min(MAX_LEVEL, value));
    }

    public static int normalizeCurrentXpForLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        int minimumXp = minimumXpForLevel(safeLevel);
        int normalizedXp = Math.max(minimumXp, currentXp);
        if (safeLevel >= MAX_LEVEL) {
            return normalizedXp;
        }
        return Math.min(normalizedXp, nextLevelXp(safeLevel) - 1);
    }

    public static int minimumXpForLevel(int level) {
        return XP_THRESHOLDS[clampLevel(level)];
    }

    public static int nextLevelXp(int level) {
        int safeLevel = clampLevel(level);
        return safeLevel >= MAX_LEVEL ? XP_THRESHOLDS[MAX_LEVEL] : XP_THRESHOLDS[safeLevel + 1];
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
}
