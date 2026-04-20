package src.domain.party.roster.value;

import src.domain.party.roster.policy.PartyLevelProgression;

public record PartyCharacterProgress(
        int level,
        int currentXp,
        int xpSinceLongRest,
        int xpSinceShortRest,
        int shortRestsTakenSinceLongRest
) {
    public PartyCharacterProgress {
        level = PartyLevelProgression.clampLevel(level);
        currentXp = Math.max(0, currentXp);
        xpSinceLongRest = Math.max(0, xpSinceLongRest);
        xpSinceShortRest = Math.max(0, xpSinceShortRest);
        shortRestsTakenSinceLongRest = Math.max(0, Math.min(2, shortRestsTakenSinceLongRest));
    }

    public PartyCharacterProgress withLevel(int nextLevel) {
        return new PartyCharacterProgress(
                nextLevel,
                PartyLevelProgression.normalizeCurrentXpForLevel(nextLevel, currentXp),
                xpSinceLongRest,
                xpSinceShortRest,
                shortRestsTakenSinceLongRest);
    }

    public PartyCharacterProgress awardXp(int xpAmount) {
        int safeXp = Math.max(0, xpAmount);
        return new PartyCharacterProgress(
                level,
                currentXp + safeXp,
                xpSinceLongRest + safeXp,
                xpSinceShortRest + safeXp,
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
