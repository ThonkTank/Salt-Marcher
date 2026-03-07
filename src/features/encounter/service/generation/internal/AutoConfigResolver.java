package features.encounter.service.generation.internal;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import features.encounter.service.rules.XpCalculator;
import features.encounter.service.generation.EncounterGenerator;
import features.encounter.service.generation.EncounterScoring;
import features.encounter.service.generation.EncounterTuning;

final class AutoConfigResolver {

    record AutoConfig(double difficultyValue, double amountValue, int groupsLevel, int balanceLevel) {}

    private static final int START_TOLERANCE_PCT = 5;
    private static final int MAX_CREATURES_PER_SLOT = EncounterSearchEngine.MAX_CREATURES_PER_SLOT;

    private AutoConfigResolver() {}

    static AutoConfig resolveAutoConfig(EncounterGenerator.EncounterRequest request,
                                        EncounterTuning.SlotBounds bounds,
                                        int partySize,
                                        int avgLevel,
                                        int minXp,
                                        int maxXp,
                                        int maxDifferentCreatures,
                                        long deadlineNanos) {
        Double fixedDifficulty = request.difficultyValue() < 0
                ? null : Math.max(0.0, Math.min(1.0, request.difficultyValue()));
        Double fixedAmount = request.amountValue() < 0
                ? null : Math.max(1.0, Math.min(5.0, request.amountValue()));
        Integer fixedGroups = request.groupsLevel() < 0
                ? null : Math.max(1, Math.min(5, request.groupsLevel()));
        Integer fixedBalance = request.balanceLevel() < 0
                ? null : Math.max(1, Math.min(5, request.balanceLevel()));

        return resolveAutoConfigRec(
                0,
                fixedDifficulty,
                fixedAmount,
                fixedGroups,
                fixedBalance,
                request,
                bounds,
                partySize,
                avgLevel,
                minXp,
                maxXp,
                maxDifferentCreatures,
                deadlineNanos);
    }

    static boolean isStructurallyFeasible(Double difficulty,
                                          Double amount,
                                          Integer groups,
                                          Integer balance,
                                          EncounterTuning.SlotBounds bounds,
                                          int partySize,
                                          int avgLevel,
                                          int minXp,
                                          int maxXp,
                                          int maxDifferentCreatures) {
        int minSlots = groups == null ? bounds.minSlots() : EncounterTuning.targetSlotsForLevel(bounds, groups);
        int maxSlots = groups == null ? bounds.maxSlots() : minSlots;

        for (int slots = minSlots; slots <= maxSlots; slots++) {
            int minCreatures = slots;
            int maxCreatures = slots * MAX_CREATURES_PER_SLOT;
            if (amount != null) {
                int target = EncounterTuning.targetCreaturesForAmount(amount, partySize);
                if (target != Integer.MAX_VALUE) {
                    target = Math.max(target, slots);
                    if (target < slots || target > slots * MAX_CREATURES_PER_SLOT) continue;
                    int maxTypes = Math.max(1, Math.min(maxDifferentCreatures, slots));
                    if (ShapePlanner.buildFeasibleShapePlans(slots, target, maxTypes).isEmpty()) continue;
                    minCreatures = target;
                    maxCreatures = target;
                }
            }

            int minBudget = difficulty == null
                    ? XpCalculator.getXpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize)
                    : -1;
            int maxBudget = difficulty == null ? EncounterTuning.deadly125Budget(avgLevel, partySize) : -1;
            if (difficulty != null) {
                int b = EncounterTuning.mapDifficultyToBudget(avgLevel, partySize, difficulty);
                minBudget = (int) Math.floor(b * (1.0 - START_TOLERANCE_PCT / 100.0));
                maxBudget = (int) Math.ceil(b * (1.0 + START_TOLERANCE_PCT / 100.0));
            }

            int minAdj = EncounterScoring.applyMultiplier(minCreatures * minXp, minCreatures);
            int maxAdj = EncounterScoring.applyMultiplier(maxCreatures * maxXp, maxCreatures);
            if (maxAdj >= minBudget && minAdj <= maxBudget) return true;
        }
        return false;
    }

    private static AutoConfig resolveAutoConfigRec(int idx,
                                                   Double difficulty,
                                                   Double amount,
                                                   Integer groups,
                                                   Integer balance,
                                                   EncounterGenerator.EncounterRequest request,
                                                   EncounterTuning.SlotBounds bounds,
                                                   int partySize,
                                                   int avgLevel,
                                                   int minXp,
                                                   int maxXp,
                                                   int maxDifferentCreatures,
                                                   long deadlineNanos) {
        if (System.nanoTime() > deadlineNanos) return null;
        if (idx >= 4) {
            if (!isStructurallyFeasible(difficulty, amount, groups, balance, bounds,
                    partySize, avgLevel, minXp, maxXp, maxDifferentCreatures)) {
                return null;
            }
            return new AutoConfig(
                    difficulty != null ? difficulty : EncounterTuning.resolveDifficulty(-1),
                    amount != null ? amount : EncounterTuning.resolveAmountValue(-1),
                    groups != null ? groups : EncounterTuning.resolveLevel(-1),
                    balance != null ? balance : EncounterTuning.resolveLevel(-1));
        }

        if (idx == 0) {
            List<Integer> candidates = request.groupsLevel() < 0
                    ? shuffledIntCandidates(1, 5)
                    : List.of(groups);
            for (Integer g : candidates) {
                if (!isStructurallyFeasible(difficulty, amount, g, balance, bounds,
                        partySize, avgLevel, minXp, maxXp, maxDifferentCreatures)) continue;
                AutoConfig out = resolveAutoConfigRec(idx + 1, difficulty, amount, g, balance,
                        request, bounds, partySize, avgLevel, minXp, maxXp,
                        maxDifferentCreatures, deadlineNanos);
                if (out != null) return out;
            }
            return null;
        }
        if (idx == 1) {
            List<Double> candidates = request.amountValue() < 0
                    ? shuffledAmountCandidates()
                    : List.of(amount);
            for (Double a : candidates) {
                if (!isStructurallyFeasible(difficulty, a, groups, balance, bounds,
                        partySize, avgLevel, minXp, maxXp, maxDifferentCreatures)) continue;
                AutoConfig out = resolveAutoConfigRec(idx + 1, difficulty, a, groups, balance,
                        request, bounds, partySize, avgLevel, minXp, maxXp,
                        maxDifferentCreatures, deadlineNanos);
                if (out != null) return out;
            }
            return null;
        }
        if (idx == 2) {
            List<Integer> candidates = request.balanceLevel() < 0
                    ? shuffledIntCandidates(1, 5)
                    : List.of(balance);
            for (Integer b : candidates) {
                if (!isStructurallyFeasible(difficulty, amount, groups, b, bounds,
                        partySize, avgLevel, minXp, maxXp, maxDifferentCreatures)) continue;
                AutoConfig out = resolveAutoConfigRec(idx + 1, difficulty, amount, groups, b,
                        request, bounds, partySize, avgLevel, minXp, maxXp,
                        maxDifferentCreatures, deadlineNanos);
                if (out != null) return out;
            }
            return null;
        }

        List<Double> candidates = request.difficultyValue() < 0
                ? shuffledDifficultyCandidates()
                : List.of(difficulty);
        for (Double d : candidates) {
            if (!isStructurallyFeasible(d, amount, groups, balance, bounds,
                    partySize, avgLevel, minXp, maxXp, maxDifferentCreatures)) continue;
            AutoConfig out = resolveAutoConfigRec(idx + 1, d, amount, groups, balance,
                    request, bounds, partySize, avgLevel, minXp, maxXp,
                    maxDifferentCreatures, deadlineNanos);
            if (out != null) return out;
        }
        return null;
    }

    private static List<Integer> shuffledIntCandidates(int min, int max) {
        List<Integer> out = new ArrayList<>();
        for (int i = min; i <= max; i++) out.add(i);
        shuffleInPlace(out);
        return out;
    }

    private static List<Double> shuffledDifficultyCandidates() {
        List<Double> out = new ArrayList<>();
        for (int i = 0; i <= 20; i++) out.add(i / 20.0);
        shuffleInPlace(out);
        return out;
    }

    private static List<Double> shuffledAmountCandidates() {
        List<Double> out = new ArrayList<>();
        for (int i = 0; i < 10; i++) out.add(EncounterTuning.resolveAmountValue(-1));
        out.add(1.0);
        out.add(1.5);
        out.add(2.0);
        out.add(2.5);
        out.add(3.0);
        out.add(3.5);
        out.add(4.0);
        out.add(5.0);
        shuffleInPlace(out);
        return out;
    }

    private static <T> void shuffleInPlace(List<T> list) {
        for (int i = list.size() - 1; i > 0; i--) {
            int j = ThreadLocalRandom.current().nextInt(i + 1);
            T tmp = list.get(i);
            list.set(i, list.get(j));
            list.set(j, tmp);
        }
    }
}
