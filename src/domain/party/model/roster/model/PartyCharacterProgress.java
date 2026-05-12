package src.domain.party.model.roster.model;

public record PartyCharacterProgress(
        int level,
        int currentXp,
        int xpSinceLongRest,
        int xpSinceShortRest,
        int shortRestsTakenSinceLongRest
) {
    public PartyCharacterProgress {
        level = clampLevel(level);
        currentXp = Math.max(0, currentXp);
        xpSinceLongRest = Math.max(0, xpSinceLongRest);
        xpSinceShortRest = Math.max(0, xpSinceShortRest);
        shortRestsTakenSinceLongRest = Math.max(0, Math.min(2, shortRestsTakenSinceLongRest));
    }

    public PartyCharacterProgress withLevel(int nextLevel) {
        return new PartyCharacterProgress(
                nextLevel,
                normalizeCurrentXpForLevel(nextLevel, currentXp),
                xpSinceLongRest,
                xpSinceShortRest,
                shortRestsTakenSinceLongRest);
    }

    public PartyCharacterProgress awardXp(int xpAmount) {
        int safeXp = Math.max(0, xpAmount);
        return adjustXp(safeXp);
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

    private static int clampLevel(int value) {
        return Math.max(1, Math.min(20, value));
    }

    private static int normalizeCurrentXpForLevel(int level, int currentXp) {
        int minimumXp = minimumXpForLevel(level);
        int nextLevelXp = nextLevelXp(level);
        return Math.max(minimumXp, Math.min(nextLevelXp - 1, currentXp));
    }

    private static int minimumXpForLevel(int level) {
        int safeLevel = clampLevel(level);
        int result = 0;
        for (int currentLevel = 1; currentLevel < safeLevel; currentLevel++) {
            result += currentLevel * currentLevel * 100;
        }
        return result;
    }

    private static int nextLevelXp(int level) {
        if (level >= 20) {
            return minimumXpForLevel(20);
        }
        return minimumXpForLevel(level + 1);
    }
}
