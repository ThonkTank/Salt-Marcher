package src.domain.party.roster.value;

import src.domain.party.roster.policy.PartyLevelProgressionPolicy;

public record PartyCharacterProgress(
        int level,
        int currentXp,
        int xpSinceLongRest,
        int xpSinceShortRest,
        int shortRestsTakenSinceLongRest
) {
    public PartyCharacterProgress {
        level = PartyLevelProgressionPolicy.clampLevel(level);
        currentXp = Math.max(0, currentXp);
        xpSinceLongRest = Math.max(0, xpSinceLongRest);
        xpSinceShortRest = Math.max(0, xpSinceShortRest);
        shortRestsTakenSinceLongRest = Math.max(0, Math.min(2, shortRestsTakenSinceLongRest));
    }

    public PartyCharacterProgress withLevel(int nextLevel) {
        return new PartyCharacterProgress(
                nextLevel,
                PartyLevelProgressionPolicy.normalizeCurrentXpForLevel(nextLevel, currentXp),
                xpSinceLongRest,
                xpSinceShortRest,
                shortRestsTakenSinceLongRest);
    }

    public PartyCharacterProgress awardXp(int xpAmount) {
        int safeXp = Math.max(0, xpAmount);
        return adjustXp(safeXp);
    }

    public PartyCharacterProgress adjustXp(int xpDelta) {
        int minimumXp = PartyLevelProgressionPolicy.minimumXpForLevel(level);
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
}
