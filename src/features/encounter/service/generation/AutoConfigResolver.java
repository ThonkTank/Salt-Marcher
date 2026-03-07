package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

import features.gamerules.service.XpCalculator;

final class AutoConfigResolver {

    record AutoConfig(double difficultyValue, double amountValue, int groupsLevel, int balanceLevel) {}
    private record ShapeFeasibilityKey(int slots, int targetCreatures, int maxTypes) {}

    private static final int START_TOLERANCE_PCT = 5;
    private static final int MAX_CREATURES_PER_SLOT = EncounterSearchEngine.MAX_CREATURES_PER_SLOT;

    private AutoConfigResolver() {
        throw new AssertionError("No instances");
    }

    static AutoConfig resolveAutoConfig(EncounterGenerator.EncounterRequest request,
                                        EncounterTuning.SlotBounds bounds,
                                        int partySize,
                                        int avgLevel,
                                        int minXp,
                                        int maxXp,
                                        int maxDifferentCreatures,
                                        long deadlineNanos,
                                        GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        Double fixedDifficulty = request.difficultyValue() < 0
                ? null : Math.max(0.0, Math.min(1.0, request.difficultyValue()));
        Double fixedAmount = request.amountValue() < 0
                ? null : Math.max(1.0, Math.min(5.0, request.amountValue()));
        Integer fixedGroups = request.groupsLevel() < 0
                ? null : Math.max(1, Math.min(5, request.groupsLevel()));
        Integer fixedBalance = request.balanceLevel() < 0
                ? null : Math.max(1, Math.min(5, request.balanceLevel()));
        Map<ShapeFeasibilityKey, Boolean> shapeFeasibilityCache = new HashMap<>();

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
                deadlineNanos,
                ctx,
                shapeFeasibilityCache);
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
        return isStructurallyFeasible(difficulty, amount, groups, balance, bounds,
                partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, null);
    }

    private static boolean isStructurallyFeasible(Double difficulty,
                                                  Double amount,
                                                  Integer groups,
                                                  Integer balance,
                                                  EncounterTuning.SlotBounds bounds,
                                                  int partySize,
                                                  int avgLevel,
                                                  int minXp,
                                                  int maxXp,
                                                  int maxDifferentCreatures,
                                                  Map<ShapeFeasibilityKey, Boolean> shapeFeasibilityCache) {
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
                    if (!hasFeasibleShapePlans(slots, target, maxTypes, shapeFeasibilityCache)) continue;
                    minCreatures = target;
                    maxCreatures = target;
                }
            }

            int minBudget = difficulty == null
                    ? XpCalculator.xpThreshold(avgLevel, XpCalculator.Difficulty.EASY) * Math.max(1, partySize)
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
                                                   long deadlineNanos,
                                                   GenerationContext context,
                                                   Map<ShapeFeasibilityKey, Boolean> shapeFeasibilityCache) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (ctx.isExpired(deadlineNanos)) return null;
        if (idx >= 4) {
            if (!isStructurallyFeasible(difficulty, amount, groups, balance, bounds,
                    partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, shapeFeasibilityCache)) {
                return null;
            }
            return new AutoConfig(
                    difficulty != null ? difficulty : EncounterTuning.resolveDifficulty(-1, ctx),
                    amount != null ? amount : EncounterTuning.resolveAmountValue(-1, partySize, ctx),
                    groups != null ? groups : EncounterTuning.resolveLevel(-1, ctx),
                    balance != null ? balance : EncounterTuning.resolveLevel(-1, ctx));
        }

        if (idx == 0) {
            List<Integer> candidates = request.groupsLevel() < 0
                    ? shuffledIntCandidates(1, 5, ctx)
                    : List.of(groups);
            return tryCandidates(
                    candidates,
                    g -> isStructurallyFeasible(difficulty, amount, g, balance, bounds,
                            partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, shapeFeasibilityCache),
                    g -> resolveAutoConfigRec(idx + 1, difficulty, amount, g, balance,
                            request, bounds, partySize, avgLevel, minXp, maxXp,
                            maxDifferentCreatures, deadlineNanos, ctx, shapeFeasibilityCache));
        }
        if (idx == 1) {
            List<Double> candidates = request.amountValue() < 0
                    ? shuffledAmountCandidates(partySize, ctx)
                    : List.of(amount);
            return tryCandidates(
                    candidates,
                    a -> isStructurallyFeasible(difficulty, a, groups, balance, bounds,
                            partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, shapeFeasibilityCache),
                    a -> resolveAutoConfigRec(idx + 1, difficulty, a, groups, balance,
                            request, bounds, partySize, avgLevel, minXp, maxXp,
                            maxDifferentCreatures, deadlineNanos, ctx, shapeFeasibilityCache));
        }
        if (idx == 2) {
            List<Integer> candidates = request.balanceLevel() < 0
                    ? shuffledIntCandidates(1, 5, ctx)
                    : List.of(balance);
            return tryCandidates(
                    candidates,
                    b -> isStructurallyFeasible(difficulty, amount, groups, b, bounds,
                            partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, shapeFeasibilityCache),
                    b -> resolveAutoConfigRec(idx + 1, difficulty, amount, groups, b,
                            request, bounds, partySize, avgLevel, minXp, maxXp,
                            maxDifferentCreatures, deadlineNanos, ctx, shapeFeasibilityCache));
        }

        List<Double> candidates = request.difficultyValue() < 0
                ? shuffledDifficultyCandidates(ctx)
                : List.of(difficulty);
        return tryCandidates(
                candidates,
                d -> isStructurallyFeasible(d, amount, groups, balance, bounds,
                        partySize, avgLevel, minXp, maxXp, maxDifferentCreatures, shapeFeasibilityCache),
                d -> resolveAutoConfigRec(idx + 1, d, amount, groups, balance,
                        request, bounds, partySize, avgLevel, minXp, maxXp,
                        maxDifferentCreatures, deadlineNanos, ctx, shapeFeasibilityCache));
    }

    private static <T> AutoConfig tryCandidates(List<T> candidates,
                                                Predicate<T> feasible,
                                                Function<T, AutoConfig> resolveNext) {
        for (T candidate : candidates) {
            if (!feasible.test(candidate)) continue;
            AutoConfig out = resolveNext.apply(candidate);
            if (out != null) return out;
        }
        return null;
    }

    private static boolean hasFeasibleShapePlans(int slots,
                                                 int targetCreatures,
                                                 int maxTypes,
                                                 Map<ShapeFeasibilityKey, Boolean> cache) {
        if (cache == null) {
            return !ShapePlanner.buildFeasibleShapePlans(slots, targetCreatures, maxTypes).isEmpty();
        }
        ShapeFeasibilityKey key = new ShapeFeasibilityKey(slots, targetCreatures, maxTypes);
        Boolean cached = cache.get(key);
        if (cached != null) return cached;
        boolean feasible = !ShapePlanner.buildFeasibleShapePlans(slots, targetCreatures, maxTypes).isEmpty();
        cache.put(key, feasible);
        return feasible;
    }

    private static List<Integer> shuffledIntCandidates(int min, int max, GenerationContext context) {
        List<Integer> out = new ArrayList<>();
        for (int i = min; i <= max; i++) out.add(i);
        shuffleInPlace(out, context);
        return out;
    }

    private static List<Double> shuffledDifficultyCandidates(GenerationContext context) {
        List<Double> out = new ArrayList<>();
        for (int i = 0; i <= 20; i++) out.add(i / 20.0);
        shuffleInPlace(out, context);
        return out;
    }

    private static List<Double> shuffledAmountCandidates(int partySize, GenerationContext context) {
        List<Double> primary = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            primary.add(EncounterTuning.resolveAmountValue(-1, partySize, context));
        }
        EncounterTuning.AutoAmountAnchorProfile profile = EncounterTuning.autoAmountAnchorProfile(partySize);
        List<Double> coreAnchors = new ArrayList<>(profile.coreAnchors());
        List<Double> outliers = new ArrayList<>(profile.outliers());

        shuffleInPlace(primary, context);
        shuffleInPlace(coreAnchors, context);
        shuffleInPlace(outliers, context);

        List<Double> combined = new ArrayList<>(primary.size() + coreAnchors.size() + outliers.size());
        combined.addAll(primary);
        combined.addAll(coreAnchors);
        combined.addAll(outliers);
        return combined;
    }

    private static <T> void shuffleInPlace(List<T> list, GenerationContext context) {
        context.shuffle(list);
    }
}
