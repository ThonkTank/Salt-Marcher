package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.List;

import features.encounter.service.rules.EncounterRules;
import features.gamerules.service.XpCalculator;

public final class EncounterTuning {
    private EncounterTuning() {
        throw new AssertionError("No instances");
    }

    public static final int MAX_CREATURES_PER_SLOT = EncounterRules.MAX_CREATURES_PER_SLOT;
    public static final int MAX_TURNS_PER_ROUND = EncounterRules.MAX_TURNS_PER_ROUND;
    static final int START_TOLERANCE_PCT = 5;
    private static final int AUTO_AMOUNT_HIGH_TAIL_MAX_MULTIPLIER = 8;
    private static final double AUTO_AMOUNT_CURVE_CORE_WEIGHT = 0.86;
    private static final double AUTO_AMOUNT_CURVE_CORE_MODE_MULTIPLIER = 1.30;
    private static final double AUTO_AMOUNT_CURVE_CORE_SIGMA = 0.75;
    private static final double AUTO_AMOUNT_CURVE_TAIL_MODE_MULTIPLIER = 4.20;
    private static final double AUTO_AMOUNT_CURVE_TAIL_SIGMA = 1.00;
    /**
     * Fallback party size used only by legacy overloads that do not receive an explicit party size.
     * Prefer {@link #resolveAmountValue(double, int, GenerationContext)} at new call sites.
     */
    public static final int DEFAULT_PARTY_SIZE_FOR_AUTO_AMOUNT = 4;

    public record SlotBounds(int minSlots, int maxSlots) {}
    record AutoAmountAnchorProfile(List<Double> coreAnchors, List<Double> outliers) {}

    /**
     * Computes the XP ceiling for candidate pre-fetching.
     * Auto mode uses the global maximum (125% Deadly).
     */
    public static int computeXpCeiling(int avgLevel, double difficultyValue, int partySize) {
        int easy = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
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
        return resolveLevel(level, null);
    }

    public static int resolveLevel(int level, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (level < 1) return ctx.nextInt(1, 6);
        return Math.max(1, Math.min(5, level));
    }

    public static double resolveAmountValue(double amountValue) {
        return resolveAmountValue(amountValue, null);
    }

    /**
     * Legacy fallback overload that applies {@link #DEFAULT_PARTY_SIZE_FOR_AUTO_AMOUNT} when
     * auto amount is requested ({@code amountValue < 1.0}).
     * Prefer {@link #resolveAmountValue(double, int, GenerationContext)} at call sites where party size is known.
     */
    public static double resolveAmountValue(double amountValue, GenerationContext context) {
        return resolveAmountValue(amountValue, DEFAULT_PARTY_SIZE_FOR_AUTO_AMOUNT, context);
    }

    public static double resolveAmountValue(double amountValue, int partySize, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (amountValue >= 1.0) return Math.max(1.0, Math.min(5.0, amountValue));
        int targetCreatures = resolveAutoTargetCreatures(partySize, ctx);
        return amountValueForTargetCreatures(targetCreatures, partySize);
    }

    private static int resolveAutoTargetCreatures(int partySize, GenerationContext context) {
        int p = Math.max(1, partySize);
        int min = 1;
        int max = p * AUTO_AMOUNT_HIGH_TAIL_MAX_MULTIPLIER;
        return sampleCurvedAmountTarget(min, max, p, context);
    }

    private static int sampleCurvedAmountTarget(int min, int max, int partySize, GenerationContext context) {
        if (max <= min) return min;
        int count = max - min + 1;
        double[] cdf = new double[count];
        double total = 0.0;
        for (int i = 0; i < count; i++) {
            int creatures = min + i;
            total += curvedAmountWeight(creatures, partySize);
            cdf[i] = total;
        }
        if (total <= 0.0) return min;
        double pick = context.nextDouble() * total;
        for (int i = 0; i < count; i++) {
            if (pick <= cdf[i]) return min + i;
        }
        return max;
    }

    private static double curvedAmountWeight(int creatures, int partySize) {
        double multiplier = creatures / (double) Math.max(1, partySize);
        double core = gaussian(multiplier, AUTO_AMOUNT_CURVE_CORE_MODE_MULTIPLIER, AUTO_AMOUNT_CURVE_CORE_SIGMA);
        double tail = gaussian(multiplier, AUTO_AMOUNT_CURVE_TAIL_MODE_MULTIPLIER, AUTO_AMOUNT_CURVE_TAIL_SIGMA);
        return AUTO_AMOUNT_CURVE_CORE_WEIGHT * core + (1.0 - AUTO_AMOUNT_CURVE_CORE_WEIGHT) * tail;
    }

    private static double gaussian(double x, double mean, double sigma) {
        if (sigma <= 0.0) return x == mean ? 1.0 : 0.0;
        double z = (x - mean) / sigma;
        return Math.exp(-0.5 * z * z);
    }

    static double amountValueForTargetCreatures(int targetCreatures, int partySize) {
        int p = Math.max(1, partySize);
        int target = Math.max(1, targetCreatures);
        if (target <= 1) return 1.0;
        double twoP = p * 2.0;
        if (target <= twoP) {
            double amount = 1.0 + (target - 1.0) / (twoP - 1.0);
            return Math.max(1.0, Math.min(5.0, amount));
        }
        double fourP = p * 4.0;
        if (target <= fourP) {
            double amount = 2.0 + (target - twoP) / (2.0 * p);
            return Math.max(1.0, Math.min(5.0, amount));
        }
        double mult = target / (double) p;
        double amount = 3.0 + (mult - 4.0) / 4.0;
        return Math.max(1.0, Math.min(5.0, amount));
    }

    static AutoAmountAnchorProfile autoAmountAnchorProfile(int partySize) {
        int p = Math.max(1, partySize);
        List<Double> coreAnchors = new ArrayList<>();
        coreAnchors.add(amountValueForTargetCreatures((int) Math.ceil(p * 0.5), p));
        coreAnchors.add(amountValueForTargetCreatures((int) Math.ceil(p * 0.75), p));
        coreAnchors.add(amountValueForTargetCreatures(p, p));
        coreAnchors.add(amountValueForTargetCreatures((int) Math.ceil(p * 1.25), p));
        coreAnchors.add(amountValueForTargetCreatures((int) Math.ceil(p * 1.5), p));
        coreAnchors.add(amountValueForTargetCreatures(p * 2, p));

        List<Double> outliers = new ArrayList<>();
        outliers.add(amountValueForTargetCreatures((int) Math.ceil(p * 0.33), p));
        outliers.add(amountValueForTargetCreatures((int) Math.ceil(p * 2.5), p));
        outliers.add(amountValueForTargetCreatures(p * 3, p));
        outliers.add(3.5);
        outliers.add(4.0);
        outliers.add(5.0);
        return new AutoAmountAnchorProfile(coreAnchors, outliers);
    }

    public static double resolveDifficulty(double difficultyValue) {
        return resolveDifficulty(difficultyValue, null);
    }

    public static double resolveDifficulty(double difficultyValue, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (difficultyValue < 0) return ctx.nextDouble();
        return Math.max(0.0, Math.min(1.0, difficultyValue));
    }

    public static int deadly125Budget(int avgLevel, int partySize) {
        int deadly = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.DEADLY) * Math.max(1, partySize);
        return (int) Math.round(deadly * 1.25);
    }

    public static int mapDifficultyToBudget(int avgLevel, int partySize, double difficultyValue) {
        int easy = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize);
        int max = deadly125Budget(avgLevel, partySize);
        double t = Math.max(0.0, Math.min(1.0, difficultyValue));
        return (int) Math.round(easy + (max - easy) * t);
    }
}
