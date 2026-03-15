package features.party.service;

import features.party.model.PlayerCharacter;
import shared.rules.service.XpCalculator;

import java.util.List;

public final class PartyProgressionRules {

    private static final int MAX_LEVEL = 20;

    private PartyProgressionRules() {
        throw new AssertionError("No instances");
    }

    public record AdventuringDayStatus(
            int remainingToShortRest,
            int remainingToLongRest
    ) {}

    public static int startingXpForLevel(int level) {
        int safeLevel = clampLevel(level);
        return XpCalculator.xpAtLevel(safeLevel);
    }

    public static int minimumXpForLevel(int level) {
        return startingXpForLevel(level);
    }

    public static int nextLevelXp(int level) {
        int safeLevel = clampLevel(level);
        return safeLevel >= MAX_LEVEL
                ? XpCalculator.xpAtLevel(MAX_LEVEL)
                : XpCalculator.xpAtLevel(safeLevel + 1);
    }

    public static int xpToNextLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        if (safeLevel >= MAX_LEVEL) {
            return 0;
        }
        return Math.max(0, nextLevelXp(safeLevel) - Math.max(0, currentXp));
    }

    public static boolean isLevelUpReady(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        return safeLevel < MAX_LEVEL && Math.max(0, currentXp) >= nextLevelXp(safeLevel);
    }

    public static int normalizeCurrentXpForLevel(int level, int currentXp) {
        int safeLevel = clampLevel(level);
        int minXp = minimumXpForLevel(safeLevel);
        int safeXp = Math.max(minXp, currentXp);
        if (safeLevel >= MAX_LEVEL) {
            return safeXp;
        }
        int maxXpWithinLevel = nextLevelXp(safeLevel) - 1;
        // Intentional: manual level edits keep XP inside the selected level band so the edited level
        // remains the source of truth until the GM levels the character again.
        return Math.min(safeXp, maxXpWithinLevel);
    }

    public static AdventuringDayStatus computeAdventuringDayStatus(List<PlayerCharacter> members) {
        if (members == null || members.isEmpty()) {
            return new AdventuringDayStatus(0, 0);
        }

        double totalRemainingToShortRest = 0.0;
        double totalRemainingToLongRest = 0.0;
        int partySize = 0;
        for (PlayerCharacter member : members) {
            if (member == null) {
                continue;
            }
            int safeLevel = clampLevel(member.Level);
            int totalBudget = XpCalculator.adventuringDayXpPerCharacter(safeLevel);
            int perThirdBudget = Math.max(0, (int) Math.round(totalBudget / 3.0));
            totalRemainingToLongRest += Math.max(0, totalBudget - Math.max(0, member.XpSinceLongRest));
            totalRemainingToShortRest += Math.max(0, perThirdBudget - Math.max(0, member.XpSinceShortRest));
            partySize++;
        }

        if (partySize == 0) {
            return new AdventuringDayStatus(0, 0);
        }

        return new AdventuringDayStatus(
                (int) Math.round(totalRemainingToShortRest / partySize),
                (int) Math.round(totalRemainingToLongRest / partySize));
    }

    private static int clampLevel(int level) {
        return Math.max(1, Math.min(MAX_LEVEL, level));
    }
}
