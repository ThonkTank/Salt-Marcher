package features.encounter.combat.service;

import features.encounter.model.EncounterSlot;
import features.encounter.generation.service.GenerationContext;
import features.encounter.combat.model.PreparedEncounterSlot;
import features.gamerules.model.LootCoins;
import features.gamerules.service.LootCalculator;
import features.gamerules.service.XpCalculator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Assigns encounter loot to concrete creature instances before combat starts.
 */
public final class EncounterLootService {
    private static final double XP_VARIATION_MIN = 0.60;
    private static final double XP_VARIATION_MAX = 1.60;
    private static final double TYPICAL_ENCOUNTER_MULTIPLIER = 2.5;
    private static final int MAX_CP = Integer.MAX_VALUE;

    private static final int IDX_PP = 0;
    private static final int IDX_GP = 1;
    private static final int IDX_SP = 2;
    private static final int IDX_CP = 3;

    private static final int[] DENOM_VALUES = {
            LootCoins.CP_PER_PP,
            LootCoins.CP_PER_GP,
            LootCoins.CP_PER_SP,
            1
    };

    private static final double SMALL_CHANGE_BIAS_STEP = 0.55;

    private EncounterLootService() {
        throw new AssertionError("No instances");
    }

    public static List<PreparedEncounterSlot> assignLootToSlots(
            List<EncounterSlot> slots,
            int averageLevel,
            int partySize) {
        return assignLootToSlots(slots, averageLevel, partySize, GenerationContext.defaultContext());
    }

    public static List<PreparedEncounterSlot> assignLootToSlots(
            List<EncounterSlot> slots,
            int averageLevel,
            int partySize,
            GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (slots == null || slots.isEmpty()) {
            return List.of();
        }

        List<EncounterSlot> assignedSlots = new ArrayList<>(slots.size());
        for (EncounterSlot slot : slots) {
            if (slot == null) continue;
            assignedSlots.add(slot.copy());
        }
        if (assignedSlots.isEmpty()) {
            return List.of();
        }

        long totalMonsterXp = 0L;
        for (EncounterSlot slot : assignedSlots) {
            long xp = Math.max(0, slot.getCreature().getXp());
            long count = Math.max(0, slot.getCount());
            totalMonsterXp += xp * count;
            if (totalMonsterXp < 0L) {
                totalMonsterXp = Long.MAX_VALUE;
                break;
            }
        }

        int safePartySize = Math.max(1, partySize);
        int perPlayerXp = toIntSaturated(totalMonsterXp / safePartySize);
        int totalGold = LootCalculator.settleGold(averageLevel, perPlayerXp, safePartySize).totalGold();
        int totalCp = toIntSaturated(Math.max(0L, (long) totalGold * LootCoins.CP_PER_GP));

        List<Integer> flatXp = new ArrayList<>();
        List<Integer> slotIndices = new ArrayList<>();
        for (int slotIndex = 0; slotIndex < assignedSlots.size(); slotIndex++) {
            EncounterSlot slot = assignedSlots.get(slotIndex);
            int count = Math.max(0, slot.getCount());
            int xp = Math.max(0, slot.getCreature().getXp());
            for (int i = 0; i < count; i++) {
                flatXp.add(xp);
                slotIndices.add(slotIndex);
            }
        }
        if (flatXp.isEmpty()) {
            return List.of();
        }

        List<LootCoins> flatLoot;
        if (totalCp <= 0) {
            flatLoot = new ArrayList<>(Collections.nCopies(flatXp.size(), LootCoins.zero()));
        } else {
            List<Integer> cpPerEnemy = distributeCopperByXp(flatXp, totalCp, ctx);
            double encounterRewardFraction = encounterRewardFraction(totalCp, averageLevel, safePartySize);
            DifficultyGoldRefs refs = difficultyGoldRefsForPartyLevel(averageLevel, safePartySize);
            DenominationRange denomRange = allowedDenominationRange(totalGold, refs);
            int denomMask = chooseEncounterDenominationMask(
                    cpPerEnemy,
                    denomRange.minDenoms(),
                    denomRange.maxDenoms(),
                    ctx,
                    encounterRewardFraction,
                    totalCp);
            flatLoot = new ArrayList<>(cpPerEnemy.size());
            for (Integer cp : cpPerEnemy) {
                int value = Math.max(0, cp == null ? 0 : cp);
                flatLoot.add(convertEnemyCpToSelectedDenoms(
                        value,
                        denomMask,
                        ctx,
                        encounterRewardFraction,
                        totalCp));
            }
        }

        List<List<LootCoins>> perSlotLoot = new ArrayList<>(assignedSlots.size());
        for (int i = 0; i < assignedSlots.size(); i++) {
            perSlotLoot.add(new ArrayList<>());
        }
        for (int i = 0; i < flatLoot.size(); i++) {
            perSlotLoot.get(slotIndices.get(i)).add(flatLoot.get(i));
        }
        return toPreparedSlots(assignedSlots, perSlotLoot);
    }

    private static List<PreparedEncounterSlot> toPreparedSlots(
            List<EncounterSlot> assignedSlots,
            List<List<LootCoins>> perSlotLoot) {
        List<PreparedEncounterSlot> preparedSlots = new ArrayList<>(assignedSlots.size());
        for (int i = 0; i < assignedSlots.size(); i++) {
            EncounterSlot slot = assignedSlots.get(i);
            preparedSlots.add(new PreparedEncounterSlot(slot.getCreature(), slot.getCount(), perSlotLoot.get(i)));
        }
        return List.copyOf(preparedSlots);
    }

    private static DifficultyGoldRefs difficultyGoldRefsForPartyLevel(int averageLevel, int partySize) {
        int safeLevel = Math.max(1, Math.min(20, averageLevel));
        int safePartySize = Math.max(1, partySize);

        int easy = expectedGoldForDifficulty(safeLevel, safePartySize, XpCalculator.Difficulty.EASY);
        int medium = expectedGoldForDifficulty(safeLevel, safePartySize, XpCalculator.Difficulty.MEDIUM);
        int hard = expectedGoldForDifficulty(safeLevel, safePartySize, XpCalculator.Difficulty.HARD);
        int deadly = expectedGoldForDifficulty(safeLevel, safePartySize, XpCalculator.Difficulty.DEADLY);
        return new DifficultyGoldRefs(easy, medium, hard, deadly);
    }

    private static int expectedGoldForDifficulty(int averageLevel, int partySize, XpCalculator.Difficulty difficulty) {
        int adjustedXpBudget = XpCalculator.xpThreshold(averageLevel, difficulty) * partySize;
        int rawXpBudget = Math.max(0, (int) Math.round(adjustedXpBudget / TYPICAL_ENCOUNTER_MULTIPLIER));
        int perPlayerRawXp = Math.max(0, rawXpBudget / Math.max(1, partySize));
        return LootCalculator.settleGold(averageLevel, perPlayerRawXp, partySize).totalGold();
    }

    private static DenominationRange allowedDenominationRange(int totalGold, DifficultyGoldRefs refs) {
        int hardRef = Math.max(1, refs.hardGold());
        int deadlyRef = Math.max(hardRef + 1, refs.deadlyGold());

        if (totalGold < hardRef) {
            return new DenominationRange(2, 2);
        }
        if (totalGold < deadlyRef) {
            return new DenominationRange(2, 3);
        }
        return new DenominationRange(3, 4);
    }

    private static double encounterRewardFraction(int totalCp, int averageLevel, int partySize) {
        if (totalCp <= 0) {
            return 0.0;
        }
        int safePartySize = Math.max(1, partySize);
        int safeLevel = Math.max(1, Math.min(20, averageLevel));

        int currentWealthGp = LootCalculator.wealthAtLevel(safeLevel);
        int nextWealthGp = LootCalculator.nextWealthAtLevel(safeLevel);
        long perPlayerWealthDeltaCp = Math.max(1L, (long) (nextWealthGp - currentWealthGp) * LootCoins.CP_PER_GP);
        long partyWealthDeltaCp = Math.max(1L, perPlayerWealthDeltaCp * safePartySize);

        return totalCp / (double) partyWealthDeltaCp;
    }

    private static List<Integer> distributeCopperByXp(List<Integer> flatXp, int totalCp, GenerationContext context) {
        List<Integer> assigned = new ArrayList<>(Collections.nCopies(flatXp.size(), 0));
        if (flatXp.isEmpty() || totalCp <= 0) {
            return assigned;
        }

        int xpSum = flatXp.stream().mapToInt(v -> Math.max(0, v == null ? 0 : v)).sum();
        if (xpSum <= 0) {
            fillUniformDistribution(assigned, totalCp, context);
            return assigned;
        }

        List<Double> weights = new ArrayList<>(flatXp.size());
        double totalWeight = 0.0;
        for (Integer value : flatXp) {
            int xp = Math.max(0, value == null ? 0 : value);
            double jitter = XP_VARIATION_MIN + ((XP_VARIATION_MAX - XP_VARIATION_MIN) * context.nextDouble());
            double weight = xp * jitter;
            weights.add(weight);
            totalWeight += weight;
        }
        if (totalWeight <= 0.0) {
            fillUniformDistribution(assigned, totalCp, context);
            return assigned;
        }

        List<Double> fractions = new ArrayList<>(flatXp.size());
        int floorSum = 0;
        for (int i = 0; i < flatXp.size(); i++) {
            double exact = totalCp * (weights.get(i) / totalWeight);
            int floor = (int) Math.floor(exact);
            assigned.set(i, floor);
            fractions.add(exact - floor);
            floorSum += floor;
        }

        int remainder = totalCp - floorSum;
        if (remainder > 0) {
            distributeTopFractions(assigned, fractions, remainder, context);
        }
        return assigned;
    }

    private static int chooseEncounterDenominationMask(
            List<Integer> cpPerEnemy,
            int minAllowedDenoms,
            int maxAllowedDenoms,
            GenerationContext context,
            double encounterRewardFraction,
            int totalCp) {
        DenominationRange effectiveRange = effectiveDenominationRange(minAllowedDenoms, maxAllowedDenoms, totalCp);
        List<Integer> masks = candidateMasks(effectiveRange.minDenoms(), effectiveRange.maxDenoms(), totalCp);
        if (masks.isEmpty()) {
            return fallbackMask(totalCp, effectiveRange);
        }

        List<ScoredMask> scored = new ArrayList<>(masks.size());
        for (Integer mask : masks) {
            if (mask == null) continue;
            double score = evaluateMask(mask, cpPerEnemy, encounterRewardFraction, totalCp);
            if (score > 0.0) {
                scored.add(new ScoredMask(mask, score));
            }
        }
        if (scored.isEmpty()) {
            return masks.get(0);
        }

        scored.sort(Comparator.comparingDouble(ScoredMask::score).reversed());
        int topCount = Math.min(5, scored.size());
        double totalTopScore = 0.0;
        for (int i = 0; i < topCount; i++) {
            totalTopScore += scored.get(i).score();
        }
        if (totalTopScore <= 0.0) {
            return scored.get(0).mask();
        }

        if (effectiveRange.minDenoms() <= 2 && effectiveRange.maxDenoms() >= 2) {
            Integer preferred = preferTwoDenominationsNearTop(scored);
            if (preferred != null) {
                return preferred;
            }
        }

        double roll = context.nextDouble() * totalTopScore;
        double running = 0.0;
        for (int i = 0; i < topCount; i++) {
            running += scored.get(i).score();
            if (roll <= running) {
                return scored.get(i).mask();
            }
        }
        int selected = scored.get(0).mask();
        return minValueForMask(selected) <= totalCp ? selected : fallbackMask(totalCp, effectiveRange);
    }

    private static List<Integer> candidateMasks(int minAllowedDenoms, int maxAllowedDenoms, int totalCp) {
        int minAllowed = clampInt(1, 4, minAllowedDenoms);
        int maxAllowed = clampInt(minAllowed, 4, maxAllowedDenoms);
        List<Integer> out = new ArrayList<>();
        for (int mask = 1; mask < (1 << 4); mask++) {
            int bits = Integer.bitCount(mask);
            if (bits >= minAllowed && bits <= maxAllowed && minValueForMask(mask) <= totalCp) {
                out.add(mask);
            }
        }
        return out;
    }

    private static DenominationRange effectiveDenominationRange(int minAllowed, int maxAllowed, int totalCp) {
        int safeMin = clampInt(1, 4, minAllowed);
        int safeMax = clampInt(safeMin, 4, maxAllowed);
        int feasibleMax = maxFeasibleDenomsForValue(totalCp);
        int effectiveMin = Math.min(safeMin, feasibleMax);
        int effectiveMax = Math.min(safeMax, feasibleMax);
        if (effectiveMax < effectiveMin) {
            effectiveMax = effectiveMin;
        }
        return new DenominationRange(effectiveMin, effectiveMax);
    }

    private static int maxFeasibleDenomsForValue(int totalCp) {
        int remaining = Math.max(0, totalCp);
        int count = 0;
        // Smallest denomination-first greedy maximizes the number of distinct denoms possible.
        int[] ascending = {IDX_CP, IDX_SP, IDX_GP, IDX_PP};
        for (int idx : ascending) {
            int value = denomValue(idx);
            if (remaining >= value) {
                remaining -= value;
                count++;
            }
        }
        return clampInt(1, 4, count);
    }

    private static int minValueForMask(int mask) {
        int total = 0;
        for (int idx = IDX_PP; idx <= IDX_CP; idx++) {
            if ((mask & (1 << idx)) != 0) {
                total += denomValue(idx);
            }
        }
        return total;
    }

    private static int fallbackMask(int totalCp, DenominationRange range) {
        int[] preferred = {
                (1 << IDX_GP) | (1 << IDX_SP),
                (1 << IDX_SP) | (1 << IDX_CP),
                (1 << IDX_GP),
                (1 << IDX_CP)
        };
        for (int mask : preferred) {
            int bits = Integer.bitCount(mask);
            if (bits < range.minDenoms() || bits > range.maxDenoms()) continue;
            if (minValueForMask(mask) <= totalCp) {
                return mask;
            }
        }
        // Last resort: any technically feasible mask in range.
        List<Integer> candidates = candidateMasks(range.minDenoms(), range.maxDenoms(), totalCp);
        if (!candidates.isEmpty()) {
            return candidates.get(0);
        }
        return minValueForMask(1 << IDX_CP) <= totalCp ? (1 << IDX_CP) : (1 << IDX_GP);
    }

    private static double evaluateMask(
            int mask,
            List<Integer> cpPerEnemy,
            double encounterRewardFraction,
            int totalCp) {
        if (cpPerEnemy == null || cpPerEnemy.isEmpty()) {
            return 1.0;
        }

        int smallest = smallestDenomInMask(mask);
        int smallestValue = denomValue(smallest);
        int largest = largestDenomInMask(mask);
        int largestValue = denomValue(largest);

        double penalty = 0.0;
        int nonZeroEnemies = 0;

        for (Integer value : cpPerEnemy) {
            int enemyCp = Math.max(0, value == null ? 0 : value);
            if (enemyCp <= 0) continue;
            nonZeroEnemies++;
            double enemyRewardFraction = enemyRewardFraction(enemyCp, totalCp, encounterRewardFraction);

            int rounded = roundedValueForMask(enemyCp, mask);
            int roundingError = Math.abs(enemyCp - rounded);
            penalty += roundingError * 0.07;

            if (rounded <= 0) {
                penalty += 240.0;
                continue;
            }

            int estimatedCoins = estimateCoinCount(rounded, mask);
            int maxCoins = maxCoinsForEnemyCp(enemyCp, smallestValue, enemyRewardFraction);
            if (estimatedCoins > maxCoins) {
                penalty += (estimatedCoins - maxCoins) * 6.0;
            }

            int quantizationError = quantizationError(enemyCp, smallestValue);
            penalty += quantizationError * 0.12;

            int highCoins = rounded / largestValue;
            if (highCoins > 120) {
                penalty += (highCoins - 120) * 1.5;
            }

            penalty += lowDenominationPressure(mask, enemyRewardFraction);
        }

        if (nonZeroEnemies == 0) {
            return 1.0;
        }

        penalty += denominationCountPenalty(Integer.bitCount(mask));

        return 1.0 / (1.0 + penalty);
    }

    private static double denominationCountPenalty(int count) {
        return switch (count) {
            case 1 -> 4.0;
            case 2 -> 0.0;
            case 3 -> 10.0;
            default -> 22.0;
        };
    }

    private static Integer preferTwoDenominationsNearTop(List<ScoredMask> scored) {
        if (scored == null || scored.isEmpty()) {
            return null;
        }
        ScoredMask best = scored.get(0);
        double bestScore = best.score();
        if (bestScore <= 0.0) {
            return null;
        }
        double threshold = bestScore * 0.95;
        for (ScoredMask candidate : scored) {
            if (candidate == null) continue;
            if (Integer.bitCount(candidate.mask()) != 2) continue;
            if (candidate.score() >= threshold) {
                return candidate.mask();
            }
        }
        return null;
    }

    private static double enemyRewardFraction(int enemyCp, int totalCp, double encounterRewardFraction) {
        int safeTotal = Math.max(1, totalCp);
        double share = Math.max(0.0, enemyCp) / (double) safeTotal;
        return Math.max(0.0, encounterRewardFraction * share);
    }

    private static double lowDenominationPressure(int mask, double enemyRewardFraction) {
        double penalty = 0.0;
        if (enemyRewardFraction > 0.0 && (mask & (1 << IDX_CP)) != 0 && hasHigherDenom(mask, IDX_CP)) {
            penalty += Math.min(36.0, Math.max(0.0, enemyRewardFraction - 0.05) * 18.0);
        }
        if (enemyRewardFraction > 0.0 && (mask & (1 << IDX_SP)) != 0 && hasHigherDenom(mask, IDX_SP)) {
            penalty += Math.min(30.0, Math.max(0.0, enemyRewardFraction - 0.20) * 12.0);
        }
        if (enemyRewardFraction > 0.0 && (mask & (1 << IDX_GP)) != 0 && hasHigherDenom(mask, IDX_GP)) {
            penalty += Math.min(18.0, Math.max(0.0, enemyRewardFraction - 1.20) * 6.0);
        }
        return penalty;
    }

    private static boolean hasHigherDenom(int mask, int idx) {
        for (int i = idx - 1; i >= IDX_PP; i--) {
            if ((mask & (1 << i)) != 0) return true;
        }
        return false;
    }

    private static double smallChangeBiasScale(double enemyRewardFraction) {
        if (enemyRewardFraction <= 0.05) return 1.35;
        if (enemyRewardFraction <= 0.20) return 1.10;
        if (enemyRewardFraction <= 0.80) return 0.85;
        if (enemyRewardFraction <= 1.80) return 0.70;
        return 0.60;
    }

    private static LootCoins convertEnemyCpToSelectedDenoms(
            int copperValue,
            int mask,
            GenerationContext context,
            double encounterRewardFraction,
            int totalCp) {
        if (copperValue <= 0) {
            return LootCoins.zero();
        }

        List<Integer> active = denomsFromMaskDesc(mask);
        if (active.isEmpty()) {
            return LootCoins.zero();
        }

        int roundedCp = roundedValueForMask(copperValue, mask);
        if (roundedCp <= 0) {
            return LootCoins.zero();
        }

        double enemyRewardFraction = enemyRewardFraction(copperValue, totalCp, encounterRewardFraction);
        int[] counts = distributeAcrossActiveDenoms(roundedCp, active, context, enemyRewardFraction);
        normalizeCoinCounts(counts, active, roundedCp, context, enemyRewardFraction);
        return fromCounts(counts);
    }

    private static int[] distributeAcrossActiveDenoms(
            int roundedCp,
            List<Integer> active,
            GenerationContext context,
            double enemyRewardFraction) {
        int[] counts = new int[4];
        if (active.size() == 1) {
            int idx = active.get(0);
            int denom = denomValue(idx);
            counts[idx] = Math.max(0, (int) Math.round(roundedCp / (double) denom));
            return counts;
        }

        double[] shareWeights = new double[active.size()];
        double weightSum = 0.0;
        for (int i = 0; i < active.size(); i++) {
            int idx = active.get(i);
            int denom = denomValue(idx);
            double rankBias = 1.0 + (i * SMALL_CHANGE_BIAS_STEP * smallChangeBiasScale(enemyRewardFraction));
            double scalePenalty = Math.pow(denom, 0.18);
            double jitter = 0.92 + (context.nextDouble() * 0.16);
            double weight = (rankBias / scalePenalty) * jitter;
            shareWeights[i] = weight;
            weightSum += weight;
        }

        int represented = 0;
        double[] fractions = new double[active.size()];
        for (int i = 0; i < active.size(); i++) {
            int idx = active.get(i);
            int denom = denomValue(idx);
            double targetValue = roundedCp * (shareWeights[i] / Math.max(1e-9, weightSum));
            double exactCoins = targetValue / denom;
            int floor = Math.max(0, (int) Math.floor(exactCoins));
            counts[idx] = floor;
            represented += floor * denom;
            fractions[i] = exactCoins - floor;
        }

        int remainder = Math.max(0, roundedCp - represented);
        fillRemainder(counts, active, fractions, remainder, context);
        ensureSomeLowerDenoms(counts, active, roundedCp);

        return counts;
    }

    private static void fillRemainder(
            int[] counts,
            List<Integer> active,
            double[] fractions,
            int remainder,
            GenerationContext context) {
        int safety = 0;
        while (remainder > 0 && safety++ < 256) {
            int pick = pickDenomForRemainder(active, fractions, remainder, context);
            int denom = denomValue(pick);
            if (denom <= remainder) {
                counts[pick]++;
                remainder -= denom;
            } else {
                break;
            }
        }
    }

    private static int pickDenomForRemainder(
            List<Integer> active,
            double[] fractions,
            int remainder,
            GenerationContext context) {
        int bestIdx = active.get(active.size() - 1);
        double bestScore = Double.NEGATIVE_INFINITY;
        for (int i = 0; i < active.size(); i++) {
            int idx = active.get(i);
            int denom = denomValue(idx);
            if (denom > remainder) continue;
            double score = fractions[i] + (context.nextDouble() * 1e-6) + (i * 1e-3);
            if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
            }
        }
        return bestIdx;
    }

    private static void ensureSomeLowerDenoms(int[] counts, List<Integer> active, int roundedCp) {
        if (active.size() < 2 || roundedCp <= 0) {
            return;
        }
        int highest = active.get(0);
        int lowest = active.get(active.size() - 1);
        if (highest == lowest) {
            return;
        }

        if (counts[lowest] > 0) {
            return;
        }

        int highValue = denomValue(highest);
        int lowValue = denomValue(lowest);
        if (highValue <= lowValue || counts[highest] <= 0) {
            return;
        }

        int ratio = highValue / lowValue;
        counts[highest]--;
        counts[lowest] += ratio;
    }

    private static void normalizeCoinCounts(
            int[] counts,
            List<Integer> active,
            int roundedCp,
            GenerationContext context,
            double enemyRewardFraction) {
        int smallestValue = denomValue(active.get(active.size() - 1));
        int minCoins = Math.max(1, active.size());
        int maxCoins = maxCoinsForEnemyCp(roundedCp, smallestValue, enemyRewardFraction);

        int safety = 0;
        while (coinCount(counts) > maxCoins && safety++ < 256) {
            if (!mergeOne(counts, active)) break;
        }

        safety = 0;
        while (coinCount(counts) < minCoins && safety++ < 128) {
            if (!breakOne(counts, active, context)) break;
        }

        applyRelativeLowDenomPressure(counts, active, roundedCp, enemyRewardFraction);
        applyNearestCoinRounding(counts, active, roundedCp);
    }

    private static void applyRelativeLowDenomPressure(
            int[] counts,
            List<Integer> active,
            int roundedCp,
            double enemyRewardFraction) {
        if (roundedCp <= 0 || active == null || active.isEmpty()) {
            return;
        }

        int safety = 0;
        while (safety++ < 256) {
            boolean changed = false;

            if (containsDenom(active, IDX_CP) && containsDenom(active, IDX_SP)) {
                double cpShare = valueShare(counts, IDX_CP, roundedCp);
                if (cpShare > targetCpShare(enemyRewardFraction) && mergeSpecific(counts, IDX_CP, IDX_SP)) {
                    changed = true;
                }
            }

            if (containsDenom(active, IDX_SP) && containsDenom(active, IDX_GP)) {
                double spShare = valueShare(counts, IDX_SP, roundedCp);
                if (spShare > targetSpShare(enemyRewardFraction) && mergeSpecific(counts, IDX_SP, IDX_GP)) {
                    changed = true;
                }
            }

            if (containsDenom(active, IDX_GP) && containsDenom(active, IDX_PP)) {
                double gpShare = valueShare(counts, IDX_GP, roundedCp);
                if (gpShare > targetGpShareWhenPp(enemyRewardFraction) && mergeSpecific(counts, IDX_GP, IDX_PP)) {
                    changed = true;
                }
            }

            if (!changed) {
                break;
            }
        }
    }

    private static boolean containsDenom(List<Integer> active, int denomIdx) {
        for (Integer idx : active) {
            if (idx != null && idx == denomIdx) {
                return true;
            }
        }
        return false;
    }

    private static double valueShare(int[] counts, int idx, int totalCp) {
        int safeTotal = Math.max(1, totalCp);
        return (counts[idx] * (double) denomValue(idx)) / safeTotal;
    }

    private static boolean mergeSpecific(int[] counts, int lowIdx, int highIdx) {
        int lowValue = denomValue(lowIdx);
        int highValue = denomValue(highIdx);
        if (highValue <= lowValue) {
            return false;
        }
        int ratio = highValue / lowValue;
        if (ratio <= 1 || counts[lowIdx] < ratio) {
            return false;
        }
        counts[lowIdx] -= ratio;
        counts[highIdx] += 1;
        return true;
    }

    private static double targetCpShare(double enemyRewardFraction) {
        if (enemyRewardFraction <= 0.05) return 0.68;
        if (enemyRewardFraction <= 0.20) return 0.50;
        if (enemyRewardFraction <= 0.80) return 0.28;
        if (enemyRewardFraction <= 1.80) return 0.18;
        return 0.12;
    }

    private static double targetSpShare(double enemyRewardFraction) {
        if (enemyRewardFraction <= 0.05) return 0.72;
        if (enemyRewardFraction <= 0.20) return 0.62;
        if (enemyRewardFraction <= 0.80) return 0.45;
        if (enemyRewardFraction <= 1.80) return 0.32;
        return 0.24;
    }

    private static double targetGpShareWhenPp(double enemyRewardFraction) {
        if (enemyRewardFraction <= 0.20) return 0.96;
        if (enemyRewardFraction <= 0.80) return 0.90;
        if (enemyRewardFraction <= 1.80) return 0.82;
        return 0.72;
    }

    private static boolean mergeOne(int[] counts, List<Integer> active) {
        for (int i = active.size() - 1; i > 0; i--) {
            int lowIdx = active.get(i);
            int highIdx = active.get(i - 1);
            int ratio = denomValue(highIdx) / denomValue(lowIdx);
            if (ratio <= 1) continue;
            if (counts[lowIdx] >= ratio) {
                counts[lowIdx] -= ratio;
                counts[highIdx]++;
                return true;
            }
        }
        return false;
    }

    private static boolean breakOne(int[] counts, List<Integer> active, GenerationContext context) {
        if (active.size() < 2) {
            return false;
        }
        int start = context.nextInt(active.size() - 1);
        for (int step = 0; step < active.size() - 1; step++) {
            int i = (start + step) % (active.size() - 1);
            int highIdx = active.get(i);
            int lowIdx = active.get(i + 1);
            if (counts[highIdx] <= 0) continue;
            int ratio = denomValue(highIdx) / denomValue(lowIdx);
            if (ratio <= 1) continue;
            counts[highIdx]--;
            counts[lowIdx] += ratio;
            return true;
        }
        return false;
    }

    private static void applyNearestCoinRounding(int[] counts, List<Integer> active, int targetCp) {
        int represented = cpValue(counts);
        int diff = targetCp - represented;
        if (diff == 0 || active.isEmpty()) {
            return;
        }

        Adjustment best = null;
        for (Integer idx : active) {
            if (idx == null) continue;
            int denom = denomValue(idx);

            int addValue = represented + denom;
            int addError = Math.abs(targetCp - addValue);
            if (best == null || addError < best.error()) {
                best = new Adjustment(idx, 1, addError);
            }

            if (counts[idx] > 0) {
                int subValue = represented - denom;
                int subError = Math.abs(targetCp - subValue);
                if (best == null || subError < best.error()) {
                    best = new Adjustment(idx, -1, subError);
                }
            }
        }

        if (best != null && best.delta() < 0 && counts[best.index()] <= 0) {
            return;
        }

        if (best != null) {
            counts[best.index()] += best.delta();
        }
    }

    private static int roundedValueForMask(int copperValue, int mask) {
        if (copperValue <= 0) {
            return 0;
        }
        int smallest = smallestDenomInMask(mask);
        int unit = denomValue(smallest);
        if (unit <= 1) {
            return copperValue;
        }

        int lower = (copperValue / unit) * unit;
        int upper = lower + unit;
        int downError = copperValue - lower;
        int upError = upper - copperValue;

        if (lower == 0 && upError > downError) {
            return unit;
        }
        return (upError < downError) ? upper : lower;
    }

    private static int estimateCoinCount(int roundedCp, int mask) {
        List<Integer> active = denomsFromMaskDesc(mask);
        if (active.isEmpty() || roundedCp <= 0) return 0;
        int smallest = denomValue(active.get(active.size() - 1));
        int rough = (int) Math.ceil(roundedCp / (double) Math.max(1, smallest));
        int withBias = (int) Math.round(rough * 0.35 + active.size());
        return Math.max(1, withBias);
    }

    private static int quantizationError(int cpValue, int smallestDenom) {
        if (smallestDenom <= 1) {
            return 0;
        }
        int remainder = cpValue % smallestDenom;
        return Math.min(remainder, smallestDenom - remainder);
    }

    private static int maxCoinsForEnemyCp(int enemyCp, int smallestDenomValue, double enemyRewardFraction) {
        int safeCp = Math.max(1, enemyCp);
        int safeSmall = Math.max(1, smallestDenomValue);
        double scaled = safeCp / (double) safeSmall;
        double rewardScale = enemyRewardFraction <= 0.05 ? 0.90
                : enemyRewardFraction <= 0.30 ? 1.0
                : enemyRewardFraction <= 1.20 ? 1.10
                : 1.25;
        int raw = (int) Math.round((Math.sqrt(scaled) * 2.8 + 6.0) * rewardScale);
        return clampInt(8, 120, raw);
    }

    private static int smallestDenomInMask(int mask) {
        for (int i = IDX_CP; i >= IDX_PP; i--) {
            if ((mask & (1 << i)) != 0) return i;
        }
        return IDX_CP;
    }

    private static int largestDenomInMask(int mask) {
        for (int i = IDX_PP; i <= IDX_CP; i++) {
            if ((mask & (1 << i)) != 0) return i;
        }
        return IDX_GP;
    }

    private static List<Integer> denomsFromMaskDesc(int mask) {
        List<Integer> out = new ArrayList<>(4);
        for (int idx = IDX_PP; idx <= IDX_CP; idx++) {
            if ((mask & (1 << idx)) != 0) out.add(idx);
        }
        return out;
    }

    private static void fillUniformDistribution(List<Integer> assigned, int totalCp, GenerationContext context) {
        int base = totalCp / assigned.size();
        int remainder = totalCp % assigned.size();
        for (int i = 0; i < assigned.size(); i++) {
            assigned.set(i, base);
        }
        if (remainder <= 0) return;

        List<Integer> indices = new ArrayList<>(assigned.size());
        for (int i = 0; i < assigned.size(); i++) {
            indices.add(i);
        }
        for (int i = indices.size() - 1; i > 0; i--) {
            int j = context.nextInt(i + 1);
            int tmp = indices.get(i);
            indices.set(i, indices.get(j));
            indices.set(j, tmp);
        }
        for (int i = 0; i < remainder; i++) {
            int index = indices.get(i % indices.size());
            assigned.set(index, assigned.get(index) + 1);
        }
    }

    private static void distributeTopFractions(
            List<Integer> assigned,
            List<Double> fractions,
            int remainder,
            GenerationContext context) {
        if (remainder <= 0 || fractions.isEmpty()) {
            return;
        }
        List<ScoreEntry> scored = new ArrayList<>(fractions.size());
        for (int i = 0; i < fractions.size(); i++) {
            double score = fractions.get(i) + context.nextDouble() * 1e-9;
            scored.add(new ScoreEntry(i, score));
        }
        scored.sort(Comparator.comparingDouble(ScoreEntry::score).reversed());
        int picks = Math.min(remainder, scored.size());
        for (int i = 0; i < picks; i++) {
            int index = scored.get(i).index();
            assigned.set(index, assigned.get(index) + 1);
        }
    }

    private static int coinCount(int[] counts) {
        return counts[IDX_PP] + counts[IDX_GP] + counts[IDX_SP] + counts[IDX_CP];
    }

    private static int denomValue(int idx) {
        if (idx < 0 || idx >= DENOM_VALUES.length) {
            return 1;
        }
        return DENOM_VALUES[idx];
    }

    private static int cpValue(int[] counts) {
        int total = 0;
        total += counts[IDX_PP] * LootCoins.CP_PER_PP;
        total += counts[IDX_GP] * LootCoins.CP_PER_GP;
        total += counts[IDX_SP] * LootCoins.CP_PER_SP;
        total += counts[IDX_CP];
        return total;
    }

    private static LootCoins fromCounts(int[] counts) {
        return LootCoins.fromDenominations(
                Math.max(0, counts[IDX_PP]),
                Math.max(0, counts[IDX_GP]),
                Math.max(0, counts[IDX_SP]),
                Math.max(0, counts[IDX_CP]));
    }

    private static int clampInt(int min, int max, int value) {
        return Math.max(min, Math.min(max, value));
    }

    private record ScoreEntry(int index, double score) {}

    private record ScoredMask(int mask, double score) {}

    private record Adjustment(int index, int delta, int error) {}

    private record DenominationRange(int minDenoms, int maxDenoms) {}

    private record DifficultyGoldRefs(int easyGold, int mediumGold, int hardGold, int deadlyGold) {}

    private static int toIntSaturated(long value) {
        if (value <= 0L) {
            return 0;
        }
        return value >= MAX_CP ? MAX_CP : (int) value;
    }
}
