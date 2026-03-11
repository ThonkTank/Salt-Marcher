package features.encounter.generation.service;

import features.encounter.rules.EncounterRules;
import shared.rules.service.XpCalculator;

public final class EncounterTuning {
    private EncounterTuning() {
        throw new AssertionError("No instances");
    }

    public static final int MAX_TURNS_PER_ROUND = EncounterRules.MAX_TURNS_PER_ROUND;
    static final int START_TOLERANCE_PCT = 5;
    private static final double AUTO_AMOUNT_CORE_WEIGHT = 0.88;
    private static final double AUTO_AMOUNT_CORE_MEAN = 3.0;
    private static final double AUTO_AMOUNT_CORE_SIGMA = 0.70;
    private static final double AUTO_AMOUNT_TAIL_MEAN = 3.0;
    private static final double AUTO_AMOUNT_TAIL_SIGMA = 1.20;
    private static final double AUTO_DIVERSITY_CORE_WEIGHT = 0.90;
    private static final double AUTO_DIVERSITY_CORE_MEAN = 2.55;
    private static final double AUTO_DIVERSITY_CORE_SIGMA = 0.65;
    private static final double AUTO_DIVERSITY_TAIL_MEAN = 2.45;
    private static final double AUTO_DIVERSITY_TAIL_SIGMA = 0.95;
    /**
     * Fallback party size used only by legacy overloads that do not receive an explicit party size.
     * Prefer {@link #resolveAmountValue(double, int, GenerationContext)} at new call sites.
     */
    public static final int DEFAULT_PARTY_SIZE_FOR_AUTO_AMOUNT = 4;

    public record SlotBounds(int minSlots, int maxSlots) {}
    public record DifficultyBandBudgetRange(int lowerAdjustedXp, int upperAdjustedXp) {}
    public record CompositionTargets(
            double bossPreference,
            double regularPreference,
            double minionPreference,
            int targetCreatureCount,
            int creatureCountTolerance
    ) {}

    /**
     * Computes the XP ceiling for candidate pre-fetching.
     * Auto mode uses the global maximum (125% Deadly).
     */
    public static int computeXpCeiling(int avgLevel, EncounterDifficultyBand difficultyBand, int partySize) {
        return difficultyBand == null
                ? deadly125Budget(avgLevel, partySize)
                : difficultyBandBudgetRange(avgLevel, partySize, difficultyBand).upperAdjustedXp();
    }

    /** UI helper: returns the adjusted XP range for the selected difficulty band. */
    public static DifficultyBandBudgetRange difficultyBandBudgetRange(
            int avgLevel,
            int partySize,
            EncounterDifficultyBand difficultyBand) {
        int level = Math.max(1, Math.min(20, avgLevel));
        int size = Math.max(1, partySize);
        EncounterDifficultyBand band = difficultyBand != null ? difficultyBand : EncounterDifficultyBand.MEDIUM;

        int easy = XpCalculator.xpThreshold(level, XpCalculator.Difficulty.EASY) * size;
        int medium = XpCalculator.xpThreshold(level, XpCalculator.Difficulty.MEDIUM) * size;
        int hard = XpCalculator.xpThreshold(level, XpCalculator.Difficulty.HARD) * size;
        int deadly = XpCalculator.xpThreshold(level, XpCalculator.Difficulty.DEADLY) * size;
        int deadly125 = deadly125Budget(level, size);

        return switch (band) {
            case EASY -> new DifficultyBandBudgetRange(easy, Math.max(easy, medium - 1));
            case MEDIUM -> new DifficultyBandBudgetRange(medium, Math.max(medium, hard - 1));
            case HARD -> new DifficultyBandBudgetRange(hard, Math.max(hard, deadly - 1));
            case DEADLY -> new DifficultyBandBudgetRange(deadly, Math.max(deadly, deadly125));
        };
    }

    /** UI helper: minimum feasible monster initiative slots for the current party context. */
    public static int minMonsterSlotsForParty(int partySize) {
        return computeMonsterSlotBounds(Math.max(1, partySize)).minSlots();
    }

    /** UI helper: maximum feasible monster initiative slots for the current party context. */
    public static int maxMonsterSlotsForParty(int partySize) {
        return computeMonsterSlotBounds(Math.max(1, partySize)).maxSlots();
    }

    public static int targetCreaturesForAmount(double amountValue, int partySize) {
        return compositionTargetsForAmount(amountValue, partySize, 2).targetCreatureCount();
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
        GenerationContext ctx = contextOrDefault(context);
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
        GenerationContext ctx = contextOrDefault(context);
        if (amountValue >= 1.0) return Math.max(1.0, Math.min(5.0, amountValue));
        return sampleCurvedSliderValue(
                1,
                5,
                AUTO_AMOUNT_CORE_WEIGHT,
                AUTO_AMOUNT_CORE_MEAN,
                AUTO_AMOUNT_CORE_SIGMA,
                AUTO_AMOUNT_TAIL_MEAN,
                AUTO_AMOUNT_TAIL_SIGMA,
                ctx);
    }

    public static int resolveDiversityLevel(int diversityLevel, GenerationContext context) {
        GenerationContext ctx = contextOrDefault(context);
        if (diversityLevel >= 1) return Math.max(1, Math.min(4, diversityLevel));
        return (int) Math.round(sampleCurvedSliderValue(
                1,
                4,
                AUTO_DIVERSITY_CORE_WEIGHT,
                AUTO_DIVERSITY_CORE_MEAN,
                AUTO_DIVERSITY_CORE_SIGMA,
                AUTO_DIVERSITY_TAIL_MEAN,
                AUTO_DIVERSITY_TAIL_SIGMA,
                ctx));
    }

    /**
     * Amount controls roster size through composition preference.
     *
     * <p>Low values prefer boss-heavy encounters because they naturally use fewer creatures.
     * High values prefer minion-heavy encounters because they naturally create larger rosters.
     * The diversity target is folded in so a "many minions" request still leaves room for the
     * requested number of distinct statblocks.
     */
    public static CompositionTargets compositionTargetsForAmount(
            double amountValue,
            int partySize,
            int distinctCreatureTarget) {
        double normalized = (Math.max(1.0, Math.min(5.0, amountValue)) - 1.0) / 4.0;
        double bossPreference = 1.20 - normalized * 0.95;
        double minionPreference = 0.25 + normalized * 1.20;
        double regularPreference = 1.05 - Math.abs(normalized - 0.5) * 0.30;

        int p = Math.max(1, partySize);
        int diversity = Math.max(1, distinctCreatureTarget);
        double baseTarget = switch ((int) Math.round(Math.max(1.0, Math.min(5.0, amountValue)))) {
            case 1 -> 1.0 + Math.max(0, diversity - 1) * 0.35;
            case 2 -> 2.0 + diversity * 0.55;
            case 3 -> Math.max(3.0, p * 0.90 + diversity * 0.75);
            case 4 -> p * 1.35 + diversity * 1.10;
            default -> p * 1.85 + diversity * 1.45;
        };
        int targetCreatureCount = Math.max(diversity, (int) Math.ceil(baseTarget));
        int tolerance = Math.max(1, (int) Math.ceil(Math.max(2, targetCreatureCount) * 0.30));
        return new CompositionTargets(
                bossPreference,
                regularPreference,
                minionPreference,
                targetCreatureCount,
                tolerance);
    }

    private static double sampleCurvedSliderValue(
            int min,
            int max,
            double coreWeight,
            double coreMean,
            double coreSigma,
            double tailMean,
            double tailSigma,
            GenerationContext context) {
        int count = max - min + 1;
        double[] cdf = new double[count];
        double total = 0.0;
        for (int i = 0; i < count; i++) {
            double value = min + i;
            double core = gaussian(value, coreMean, coreSigma);
            double tail = gaussian(value, tailMean, tailSigma);
            total += coreWeight * core + (1.0 - coreWeight) * tail;
            cdf[i] = total;
        }
        if (total <= 0.0) return min;
        double pick = context.nextDouble() * total;
        for (int i = 0; i < count; i++) {
            if (pick <= cdf[i]) return min + i;
        }
        return max;
    }

    private static double gaussian(double x, double mean, double sigma) {
        if (sigma <= 0.0) return x == mean ? 1.0 : 0.0;
        double z = (x - mean) / sigma;
        return Math.exp(-0.5 * z * z);
    }

    public static String describeAmountValue(double amountValue) {
        int rounded = Math.max(1, Math.min(5, (int) Math.round(amountValue)));
        return switch (rounded) {
            case 1 -> "Boss++";
            case 2 -> "Boss+";
            case 3 -> "Ausgeglichen";
            case 4 -> "Minions+";
            default -> "Minions++";
        };
    }

    public static String describeBalanceLevel(int balanceLevel) {
        int clamped = Math.max(1, Math.min(5, balanceLevel));
        return switch (clamped) {
            case 1 -> "Extreme++";
            case 2 -> "Extreme+";
            case 3 -> "Neutral";
            case 4 -> "Durchschnitt+";
            default -> "Durchschnitt++";
        };
    }

    public static String describeDiversityLevel(int diversityLevel) {
        int clamped = Math.max(1, Math.min(4, diversityLevel));
        return switch (clamped) {
            case 1 -> "1 Typ";
            case 2 -> "2 Typen";
            case 3 -> "3 Typen";
            default -> "4 Typen";
        };
    }

    public static EncounterDifficultyBand resolveDifficultyBand(
            EncounterDifficultyBand difficultyBand,
            GenerationContext context) {
        GenerationContext ctx = contextOrDefault(context);
        if (difficultyBand != null) {
            return difficultyBand;
        }
        EncounterDifficultyBand[] bands = EncounterDifficultyBand.values();
        return bands[ctx.nextInt(0, bands.length)];
    }

    public static int deadly125Budget(int avgLevel, int partySize) {
        int deadly = XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.DEADLY) * Math.max(1, partySize);
        return (int) Math.round(deadly * 1.25);
    }

    private static GenerationContext contextOrDefault(GenerationContext context) {
        return context != null ? context : GenerationContext.defaultContext();
    }
}
