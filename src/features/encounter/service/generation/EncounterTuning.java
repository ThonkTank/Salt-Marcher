package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import features.encounter.service.rules.EncounterRules;
import features.encounter.service.rules.XpCalculator;

public class EncounterTuning {
    private EncounterTuning() {}

    public static final int MAX_CREATURES_PER_SLOT = EncounterRules.MAX_CREATURES_PER_SLOT;
    public static final int MAX_TURNS_PER_ROUND = EncounterRules.MAX_TURNS_PER_ROUND;
    static final int START_TOLERANCE_PCT = 5;

    public record SlotBounds(int minSlots, int maxSlots) {}

    /**
     * Computes the XP ceiling for candidate pre-fetching.
     * Auto mode uses the global maximum (125% Deadly).
     */
    public static int computeXpCeiling(int avgLevel, double difficultyValue, int partySize) {
        int easy = XpCalculator.getXpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
        int deadly125 = deadly125Budget(avgLevel, partySize);
        if (difficultyValue < 0) return deadly125;
        int target = mapDifficultyToBudget(avgLevel, partySize, difficultyValue);
        return Math.max(easy, Math.max(target, (int) Math.ceil(target * 1.25)));
    }

    /** UI helper: maps difficulty [0..1] to the exact target XP budget for party+level. */
    public static int targetBudgetForDifficulty(int avgLevel, int partySize, double difficultyValue) {
        return mapDifficultyToBudget(
                Math.max(1, Math.min(20, avgLevel)),
                Math.max(1, partySize),
                Math.max(0.0, Math.min(1.0, difficultyValue)));
    }

    /** UI helper: minimum feasible monster initiative slots for the current party context. */
    public static int minMonsterSlotsForParty(int partySize) {
        return computeMonsterSlotBounds(Math.max(1, partySize)).minSlots();
    }

    /** UI helper: maximum feasible monster initiative slots for the current party context. */
    public static int maxMonsterSlotsForParty(int partySize) {
        return computeMonsterSlotBounds(Math.max(1, partySize)).maxSlots();
    }

    /** UI helper: maps groups level [1..5] to exact target monster initiative slots. */
    public static int targetMonsterSlotsForLevel(int partySize, int groupsLevel) {
        SlotBounds bounds = computeMonsterSlotBounds(Math.max(1, partySize));
        return targetSlotsForLevel(bounds, Math.max(1, Math.min(5, groupsLevel)));
    }

    public static int targetCreaturesForAmount(double amountValue, int partySize) {
        amountValue = Math.max(1.0, Math.min(5.0, amountValue));
        int p = Math.max(1, partySize);
        double v;
        if (amountValue >= 5.0) return Integer.MAX_VALUE;
        if (amountValue <= 3.0) {
            // 1 -> always 1 creature, 2 -> x2 party size, 3 -> x4 party size
            if (amountValue <= 2.0) {
                v = 1.0 + (amountValue - 1.0) * (p * 2.0 - 1.0);
            } else {
                v = p * 2.0 + (amountValue - 2.0) * (p * 2.0);
            }
        } else {
            // smooth growth beyond x4, unrestricted only at exactly 5
            double mult = 4.0 + ((amountValue - 3.0) / 2.0) * 8.0;
            v = p * mult;
        }
        return Math.max(1, (int) Math.ceil(v));
    }

    /**
     * Mob slot partitioning:
     * 1-3 creatures: individual slots (size 1)
     * 4-10 creatures: one slot
     * >10 creatures: split into multiple mob-sized slots (4..10)
     */
    public static List<Integer> splitForMobSlots(int count) {
        if (count <= 0) return List.of();
        if (count <= 3) {
            List<Integer> singles = new ArrayList<>();
            for (int i = 0; i < count; i++) singles.add(1);
            return singles;
        }
        if (count <= MAX_CREATURES_PER_SLOT) return List.of(count);

        int k = (int) Math.ceil(count / (double) MAX_CREATURES_PER_SLOT);
        while (count < EncounterRules.MOB_MIN_SIZE * k) k++;

        int base = count / k;
        int rem = count % k;
        List<Integer> parts = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            int n = base + (i < rem ? 1 : 0);
            parts.add(n);
        }
        return parts;
    }

    public static SlotBounds computeMonsterSlotBounds(int partySize) {
        int minSlots = Math.max(1, (int) Math.ceil(partySize * 0.25));
        int maxByParty = (int) Math.floor(partySize * 1.25);
        int maxByTime = EncounterRules.MAX_TOTAL_INIT_SLOTS - partySize;
        int maxSlots = Math.min(maxByParty, maxByTime);
        if (maxSlots < minSlots) maxSlots = minSlots;
        return new SlotBounds(minSlots, maxSlots);
    }

    public static int targetSlotsForLevel(SlotBounds bounds, int level) {
        double t = (level - 1) / 4.0;
        int out = (int) Math.round(bounds.minSlots() + t * (bounds.maxSlots() - bounds.minSlots()));
        return Math.max(bounds.minSlots(), Math.min(bounds.maxSlots(), out));
    }

    public static int resolveLevel(int level) {
        if (level < 1) return ThreadLocalRandom.current().nextInt(1, 6);
        return Math.max(1, Math.min(5, level));
    }

    public static double resolveAmountValue(double amountValue) {
        if (amountValue >= 1.0) return Math.max(1.0, Math.min(5.0, amountValue));
        // Auto: continuous curve with a stronger low-count bias.
        // Compared to the old [1,4] mode=2 setup this makes high target counts much rarer.
        double a = 1.0, b = 3.6, c = 1.5;
        double u = ThreadLocalRandom.current().nextDouble();
        double fc = (c - a) / (b - a);
        if (u < fc) {
            return a + Math.sqrt(u * (b - a) * (c - a));
        }
        return b - Math.sqrt((1.0 - u) * (b - a) * (b - c));
    }

    public static double resolveDifficulty(double difficultyValue) {
        if (difficultyValue < 0) return ThreadLocalRandom.current().nextDouble();
        return Math.max(0.0, Math.min(1.0, difficultyValue));
    }

    public static int deadly125Budget(int avgLevel, int partySize) {
        int deadly = XpCalculator.getXpThreshold(avgLevel, XpCalculator.Difficulty.DEADLY) * Math.max(1, partySize);
        return (int) Math.round(deadly * 1.25);
    }

    public static int mapDifficultyToBudget(int avgLevel, int partySize, double difficultyValue) {
        int easy = XpCalculator.getXpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
        int max = deadly125Budget(avgLevel, partySize);
        double t = Math.max(0.0, Math.min(1.0, difficultyValue));
        return (int) Math.round(easy + (max - easy) * t);
    }
}
