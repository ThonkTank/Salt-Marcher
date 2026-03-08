package features.gamerules.service;

/**
 * Calculates combat loot in gp based on XP progress and wealth-by-level targets.
 */
public final class LootCalculator {

    private static final int MAX_LEVEL = 20;
    private static final int LEVEL_20_PLUS_INDEX = 21;
    private static final int MAX_INT = Integer.MAX_VALUE;

    // XP needed to be at level N (index is level).
    private static final int[] XP_AT_LEVEL = {
            0,
            0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
            85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
    };

    // Target wealth in gp upon reaching level N (rounded progression values).
    // Level 1 "starting gear" is treated as 0 gp for interpolation.
    // Index 21 stores the 20+ target.
    private static final int[] WEALTH_AT_LEVEL = {
            0,
            0, 100, 200, 400, 700, 3000, 5400, 8600, 12000, 17000,
            21000, 30000, 39000, 57000, 75000, 103000, 130000, 214000, 383000, 552000, 805000
    };

    private LootCalculator() {
        throw new AssertionError("No instances");
    }

    public record GoldSettlement(int perPlayerGold, int totalGold, int avgLevelUsed) {}

    public static GoldSettlement settleGold(int averageLevel, int perPlayerAwardedXp, int partySize) {
        int safeLevel = Math.max(1, Math.min(MAX_LEVEL, averageLevel));
        int safePartySize = Math.max(1, partySize);
        int safePerPlayerXp = Math.max(0, perPlayerAwardedXp);

        int currentXp = XP_AT_LEVEL[safeLevel];
        int nextXp = safeLevel == MAX_LEVEL
                ? currentXp + (XP_AT_LEVEL[MAX_LEVEL] - XP_AT_LEVEL[MAX_LEVEL - 1])
                : XP_AT_LEVEL[safeLevel + 1];

        int currentWealth = WEALTH_AT_LEVEL[safeLevel];
        int nextWealth = safeLevel == MAX_LEVEL
                ? WEALTH_AT_LEVEL[LEVEL_20_PLUS_INDEX]
                : WEALTH_AT_LEVEL[safeLevel + 1];

        int xpDelta = Math.max(1, nextXp - currentXp);
        int wealthDelta = Math.max(0, nextWealth - currentWealth);
        double goldPerXp = wealthDelta / (double) xpDelta;

        int perPlayerGold = toNonNegativeIntSaturated(Math.round(safePerPlayerXp * goldPerXp));
        int totalGold = saturatingMultiply(perPlayerGold, safePartySize);
        return new GoldSettlement(perPlayerGold, totalGold, safeLevel);
    }

    private static int toNonNegativeIntSaturated(long value) {
        if (value <= 0L) {
            return 0;
        }
        if (value >= MAX_INT) {
            return MAX_INT;
        }
        return (int) value;
    }

    private static int saturatingMultiply(int left, int right) {
        long result = (long) left * (long) right;
        if (result <= 0L) {
            return 0;
        }
        return result >= MAX_INT ? MAX_INT : (int) result;
    }
}
