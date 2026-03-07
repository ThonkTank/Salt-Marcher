package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import features.creaturecatalog.model.Creature;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterSlot;
import features.encounter.model.MonsterRole;
import features.encounter.service.EncounterCreatureMapper;

final class SearchBacktracker {

    private static final int MAX_CREATURES_PER_SLOT = EncounterSearchEngine.MAX_CREATURES_PER_SLOT;
    private static final int MAX_BRANCHES_PER_DEPTH = 48;

    private record XpWindow(int minXp, int maxXp, int remainingBlocks, int[] remainingCounts) {}
    private record CrCount(double cr, int count) {}
    // low/high scores intentionally aggregate by CR bucket using per-bucket max count.
    // This catches obvious "tiny filler swarm" padding but stays permissive for mixed IDs
    // at the same CR (e.g., several distinct CR 2 creatures plus one low-CR add-on).
    private record CrStats(double medianCr, int lowScore, int highScore) {}

    static final class BuildState {
        final Map<Long, Integer> counts = new LinkedHashMap<>();
    }

    private static final class SearchContext {
        final List<ShapePlanner.Block> blocks;
        final List<Creature> pool;
        final Map<Long, MonsterRole> roleMap;
        final int poolSize;
        final int rawLower;
        final int rawUpper;
        final int globalMinXp;
        final int globalMaxXp;
        final double amountValue;
        final int balanceLevel;
        final Map<Long, Integer> selectionWeights;
        final int boundSlackXp;
        final GenerationContext context;

        SearchContext(List<ShapePlanner.Block> blocks,
                      List<Creature> pool,
                      Map<Long, MonsterRole> roleMap,
                      int rawLower,
                      int rawUpper,
                      int globalMinXp,
                      int globalMaxXp,
                      double amountValue,
                      int balanceLevel,
                      Map<Long, Integer> selectionWeights,
                      int boundSlackXp,
                      GenerationContext context) {
            this.blocks = blocks;
            this.pool = pool;
            this.roleMap = roleMap;
            this.poolSize = pool.size();
            this.rawLower = rawLower;
            this.rawUpper = rawUpper;
            this.globalMinXp = globalMinXp;
            this.globalMaxXp = globalMaxXp;
            this.amountValue = amountValue;
            this.balanceLevel = balanceLevel;
            this.selectionWeights = selectionWeights == null ? Map.of() : selectionWeights;
            this.boundSlackXp = Math.max(0, boundSlackXp);
            this.context = context != null ? context : GenerationContext.defaultContext();
        }
    }

    private SearchBacktracker() {}

    static BuildState search(List<ShapePlanner.Block> blocks,
                             List<Creature> pool,
                             Map<Long, MonsterRole> roleMap,
                             int rawLower,
                             int rawUpper,
                             int globalMinXp,
                             int globalMaxXp,
                             double amountValue,
                             int balanceLevel,
                             Map<Long, Integer> selectionWeights,
                             long deadlineNanos,
                             GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        SearchContext strictCtx = new SearchContext(
                blocks, pool, roleMap,
                rawLower, rawUpper,
                globalMinXp, globalMaxXp,
                amountValue, balanceLevel,
                selectionWeights, 0, ctx);

        BuildState state = new BuildState();
        boolean ok = assignRecursive(strictCtx,
                0, state, new HashSet<>(), 0, new ArrayList<>(), deadlineNanos);
        if (!ok && !ctx.isExpired(deadlineNanos)) {
            int slackXp = Math.max(1, globalMinXp);
            SearchContext relaxedCtx = new SearchContext(
                    blocks, pool, roleMap,
                    rawLower, rawUpper,
                    globalMinXp, globalMaxXp,
                    amountValue, balanceLevel,
                    selectionWeights, slackXp, ctx);
            state = new BuildState();
            ok = assignRecursive(relaxedCtx,
                    0, state, new HashSet<>(), 0, new ArrayList<>(), deadlineNanos);
        }

        return ok ? state : null;
    }

    static int mobSlotCount(BuildState state) {
        int slots = 0;
        for (int count : state.counts.values()) slots += EncounterTuning.splitForMobSlots(count).size();
        return slots;
    }

    static int adjustedXpFromState(BuildState state, Map<Long, Creature> byId) {
        int raw = 0;
        int total = 0;
        for (Map.Entry<Long, Integer> e : state.counts.entrySet()) {
            Creature c = byId.get(e.getKey());
            if (c == null) continue;
            raw += c.XP * e.getValue();
            total += e.getValue();
        }
        return EncounterScoring.applyMultiplier(raw, total);
    }

    static List<EncounterSlot> toEncounterSlots(BuildState state,
                                                Map<Long, Creature> byId,
                                                Map<Long, MonsterRole> roleMap) {
        List<EncounterSlot> slots = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : state.counts.entrySet()) {
            Creature c = byId.get(e.getKey());
            if (c == null) continue;
            MonsterRole role = roleMap.getOrDefault(e.getKey(), MonsterRole.BRUTE);
            EncounterCreatureSnapshot snapshot = EncounterCreatureMapper.toSnapshot(c);
            for (int part : EncounterTuning.splitForMobSlots(e.getValue())) {
                slots.add(new EncounterSlot(snapshot, part, role));
            }
        }
        return slots;
    }

    static boolean passesLowHighCrRule(BuildState state, Map<Long, Creature> byId) {
        List<CrCount> crCounts = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : state.counts.entrySet()) {
            Creature c = byId.get(e.getKey());
            if (c == null) continue;
            int n = e.getValue();
            if (n <= 0) continue;
            double cr = (c.CR != null) ? c.CR.numeric : 0.0;
            crCounts.add(new CrCount(cr, n));
        }
        CrStats stats = computeCrStatsFromCrCounts(crCounts);
        return stats.lowScore >= stats.highScore;
    }

    private static boolean assignRecursive(SearchContext ctx,
                                           int idx,
                                           BuildState state,
                                           Set<Long> usedIds,
                                           int rawSoFar,
                                           List<Creature> pickedOrder,
                                           long deadlineNanos) {
        if (ctx.context.isExpired(deadlineNanos)) return false;
        if (idx >= ctx.blocks.size()) {
            return rawSoFar >= ctx.rawLower && rawSoFar <= ctx.rawUpper;
        }
        if (!hasRemainingCapacityForMobSlots(ctx, idx, usedIds)) return false;

        ShapePlanner.Block block = ctx.blocks.get(idx);
        XpWindow coarseWindow = computeXpWindow(ctx, idx, rawSoFar, usedIds, null);
        if (coarseWindow == null) return false;
        List<Creature> availableSortedByXp = availableCreaturesSortedByXp(ctx.pool, usedIds);
        int[] sortedRemainingCounts = coarseWindow.remainingCounts().clone();
        sortDescending(sortedRemainingCounts);

        List<Creature> options = new ArrayList<>();
        List<Double> weights = new ArrayList<>();

        int targetXpPerCreature = Math.max(1, (int) Math.round((ctx.rawUpper * block.share()) / Math.max(1, block.count())));

        for (Creature c : ctx.pool) {
            if (usedIds.contains(c.Id)) continue;
            if (c.XP < coarseWindow.minXp() || c.XP > coarseWindow.maxXp()) continue;
            if (!isCandidateFeasible(ctx, idx, rawSoFar, usedIds, c,
                    sortedRemainingCounts, coarseWindow.remainingBlocks(), availableSortedByXp)) continue;

            MonsterRole role = ctx.roleMap.getOrDefault(c.Id, MonsterRole.BRUTE);
            double w = CandidateScorer.scoreCandidate(c, role, targetXpPerCreature,
                    ctx.globalMinXp, ctx.globalMaxXp,
                    ctx.amountValue, ctx.balanceLevel,
                    pickedOrder, ctx.roleMap, ctx.selectionWeights);
            if (w <= 0.0) continue;

            options.add(c);
            weights.add(w);
        }

        if (options.isEmpty()) return false;
        capBranchesRandomly(options, weights, computeBranchCap(ctx, idx, options.size()), ctx.context);

        while (!options.isEmpty()) {
            int pickIdx = CandidateScorer.weightedRandomIndex(weights, ctx.context);
            Creature picked = options.remove(pickIdx);
            weights.remove(pickIdx);

            usedIds.add(picked.Id);
            state.counts.put(picked.Id, block.count());
            pickedOrder.add(picked);

            if (!canStillSatisfyLowHighRule(ctx, idx + 1, state, pickedOrder)) {
                pickedOrder.remove(pickedOrder.size() - 1);
                state.counts.remove(picked.Id);
                usedIds.remove(picked.Id);
                continue;
            }

            boolean ok = assignRecursive(ctx, idx + 1, state, usedIds,
                    rawSoFar + picked.XP * block.count(), pickedOrder, deadlineNanos);
            if (ok) return true;

            pickedOrder.remove(pickedOrder.size() - 1);
            state.counts.remove(picked.Id);
            usedIds.remove(picked.Id);
        }

        return false;
    }

    private static boolean isCandidateFeasible(SearchContext ctx,
                                                int idx,
                                                int rawSoFar,
                                                Set<Long> usedIds,
                                                Creature candidate,
                                                int[] sortedRemainingCounts,
                                                int remainingBlocks,
                                                List<Creature> availableSortedByXp) {
        ShapePlanner.Block block = ctx.blocks.get(idx);
        int c = Math.max(1, block.count());
        if (remainingBlocks <= 0) {
            int newRaw = rawSoFar + candidate.XP * c;
            return newRaw >= ctx.rawLower && newRaw <= ctx.rawUpper;
        }

        int availableDistinct = ctx.poolSize - usedIds.size() - 1;
        if (availableDistinct < remainingBlocks) return false;

        int minRemainingRaw = weightedRemainingRawBoundFromSorted(
                availableSortedByXp, candidate.Id, sortedRemainingCounts, true);
        if (minRemainingRaw < 0) return false;
        int maxRemainingRaw = weightedRemainingRawBoundFromSorted(
                availableSortedByXp, candidate.Id, sortedRemainingCounts, false);
        if (maxRemainingRaw < 0) return false;

        int slack = ctx.boundSlackXp * Math.max(1, remainingBlocks);
        int minXpNeeded = ceilDiv(ctx.rawLower - slack - rawSoFar - maxRemainingRaw, c);
        int maxXpAllowed = floorDiv(ctx.rawUpper + slack - rawSoFar - minRemainingRaw, c);
        return candidate.XP >= minXpNeeded && candidate.XP <= maxXpAllowed;
    }

    private static XpWindow computeXpWindow(SearchContext ctx,
                                            int idx,
                                            int rawSoFar,
                                            Set<Long> usedIds,
                                            Long blockedId) {
        ShapePlanner.Block block = ctx.blocks.get(idx);
        int c = Math.max(1, block.count());

        int remainingBlocks = ctx.blocks.size() - (idx + 1);
        if (remainingBlocks <= 0) {
            int minXp = ceilDiv(ctx.rawLower - rawSoFar, c);
            int maxXp = floorDiv(ctx.rawUpper - rawSoFar, c);
            return minXp <= maxXp ? new XpWindow(minXp, maxXp, 0, new int[0]) : null;
        }

        int availableDistinct = ctx.poolSize - usedIds.size() - (blockedId == null ? 0 : 1);
        if (availableDistinct < remainingBlocks + (blockedId == null ? 1 : 0)) return null;

        int[] remainingCounts = new int[remainingBlocks];
        for (int i = 0; i < remainingBlocks; i++) remainingCounts[i] = ctx.blocks.get(idx + 1 + i).count();

        int[] sortedRemainingCounts = remainingCounts.clone();
        sortDescending(sortedRemainingCounts);

        List<Creature> availableSortedByXp = availableCreaturesSortedByXp(ctx.pool, usedIds);
        int minRemainingRaw = weightedRemainingRawBoundFromSorted(
                availableSortedByXp, blockedId, sortedRemainingCounts, true);
        int maxRemainingRaw = weightedRemainingRawBoundFromSorted(
                availableSortedByXp, blockedId, sortedRemainingCounts, false);
        if (minRemainingRaw < 0 || maxRemainingRaw < 0) return null;

        int slack = ctx.boundSlackXp * Math.max(1, remainingBlocks);
        int minXp = ceilDiv(ctx.rawLower - slack - rawSoFar - maxRemainingRaw, c);
        int maxXp = floorDiv(ctx.rawUpper + slack - rawSoFar - minRemainingRaw, c);
        if (minXp > maxXp) return null;
        return new XpWindow(minXp, maxXp, remainingBlocks, remainingCounts);
    }

    private static List<Creature> availableCreaturesSortedByXp(List<Creature> pool, Set<Long> usedIds) {
        List<Creature> available = new ArrayList<>();
        for (Creature creature : pool) {
            if (!usedIds.contains(creature.Id)) available.add(creature);
        }
        available.sort(Comparator.comparingInt(c -> c.XP));
        return available;
    }

    private static int weightedRemainingRawBoundFromSorted(List<Creature> availableSortedByXp,
                                                           Long blockedId,
                                                           int[] sortedCountsDesc,
                                                           boolean minBound) {
        if (sortedCountsDesc.length == 0) return 0;

        int availableCount = availableSortedByXp.size() - (blockedId != null ? 1 : 0);
        if (availableCount < sortedCountsDesc.length) return -1;

        int total = 0;
        int picked = 0;
        if (minBound) {
            for (int i = 0; i < availableSortedByXp.size() && picked < sortedCountsDesc.length; i++) {
                Creature creature = availableSortedByXp.get(i);
                if (blockedId != null && blockedId.equals(creature.Id)) continue;
                total += sortedCountsDesc[picked++] * creature.XP;
            }
        } else {
            for (int i = availableSortedByXp.size() - 1; i >= 0 && picked < sortedCountsDesc.length; i--) {
                Creature creature = availableSortedByXp.get(i);
                if (blockedId != null && blockedId.equals(creature.Id)) continue;
                total += sortedCountsDesc[picked++] * creature.XP;
            }
        }
        return picked == sortedCountsDesc.length ? total : -1;
    }

    private static int computeBranchCap(SearchContext ctx, int idx, int optionCount) {
        if (optionCount <= 1) return optionCount;
        int remainingDepth = ctx.blocks.size() - idx;
        double depthRatio = ctx.blocks.size() <= 1 ? 1.0 : idx / (double) (ctx.blocks.size() - 1);

        int cap = (int) Math.round(18 + depthRatio * 30);
        cap = Math.min(cap, MAX_BRANCHES_PER_DEPTH);

        if (optionCount > 200) cap = Math.min(cap, 22);
        else if (optionCount > 120) cap = Math.min(cap, 30);
        else if (optionCount > 80) cap = Math.min(cap, 36);

        if (remainingDepth <= 2) cap = Math.max(cap, 32);

        return Math.max(10, Math.min(cap, optionCount));
    }

    private static boolean hasRemainingCapacityForMobSlots(SearchContext ctx, int idx, Set<Long> usedIds) {
        int remainingBlocks = ctx.blocks.size() - idx;
        int availableDistinct = ctx.poolSize - usedIds.size();
        if (availableDistinct < remainingBlocks) return false;

        int remainingCreatures = 0;
        int remainingSlots = 0;
        for (int i = idx; i < ctx.blocks.size(); i++) {
            ShapePlanner.Block b = ctx.blocks.get(i);
            remainingCreatures += b.count();
            remainingSlots += b.slotCount();
        }

        int minCreaturesBySlots = remainingSlots;
        int maxCreaturesBySlots = remainingSlots * MAX_CREATURES_PER_SLOT;
        if (remainingCreatures < minCreaturesBySlots || remainingCreatures > maxCreaturesBySlots) return false;

        return remainingCreatures >= remainingBlocks && remainingSlots >= remainingBlocks;
    }

    private static void sortDescending(int[] values) {
        Arrays.sort(values);
        for (int i = 0, j = values.length - 1; i < j; i++, j--) {
            int tmp = values[i];
            values[i] = values[j];
            values[j] = tmp;
        }
    }

    private static int floorDiv(int a, int b) {
        if (b <= 0) throw new IllegalArgumentException("b must be > 0");
        return Math.floorDiv(a, b);
    }

    private static int ceilDiv(int a, int b) {
        if (b <= 0) throw new IllegalArgumentException("b must be > 0");
        return -Math.floorDiv(-a, b);
    }

    private static void capBranchesRandomly(List<Creature> options,
                                            List<Double> weights,
                                            int cap,
                                            GenerationContext context) {
        if (cap <= 0 || options.size() <= cap) return;
        int size = options.size();
        for (int i = 0; i < cap; i++) {
            int j = i + context.nextInt(size - i);
            swap(options, i, j);
            swap(weights, i, j);
        }
        options.subList(cap, size).clear();
        weights.subList(cap, size).clear();
    }

    private static <T> void swap(List<T> list, int i, int j) {
        if (i == j) return;
        T tmp = list.get(i);
        list.set(i, list.get(j));
        list.set(j, tmp);
    }

    private static boolean canStillSatisfyLowHighRule(SearchContext ctx,
                                                       int nextIdx,
                                                       BuildState state,
                                                       List<Creature> pickedOrder) {
        if (pickedOrder.isEmpty()) return true;

        CrStats now = computeCrStats(state, pickedOrder);
        if (nextIdx >= ctx.blocks.size()) return now.lowScore >= now.highScore;

        int remainingCount = 0;
        for (int i = nextIdx; i < ctx.blocks.size(); i++) remainingCount += ctx.blocks.get(i).count();
        return now.lowScore + remainingCount >= now.highScore;
    }

    private static CrStats computeCrStats(BuildState state, List<Creature> pickedOrder) {
        List<CrCount> crCounts = new ArrayList<>();
        for (Creature c : pickedOrder) {
            int n = state.counts.getOrDefault(c.Id, 0);
            if (n <= 0) continue;
            double cr = (c.CR != null) ? c.CR.numeric : 0.0;
            crCounts.add(new CrCount(cr, n));
        }
        return computeCrStatsFromCrCounts(crCounts);
    }

    private static CrStats computeCrStatsFromCrCounts(List<CrCount> crCounts) {
        List<Double> all = new ArrayList<>();
        for (CrCount entry : crCounts) {
            for (int i = 0; i < entry.count(); i++) all.add(entry.cr());
        }
        if (all.isEmpty()) return new CrStats(0.0, 0, 0);
        all.sort(Double::compare);

        double median;
        int size = all.size();
        if ((size & 1) == 1) {
            median = all.get(size / 2);
        } else {
            median = (all.get(size / 2 - 1) + all.get(size / 2)) / 2.0;
        }

        // Intentional heuristic: each exact CR contributes at most its largest stack.
        // This avoids over-penalizing variety within one CR band while still detecting
        // strong skew between low and high CR sides.
        Map<Double, Integer> lowMaxByCr = new HashMap<>();
        Map<Double, Integer> highMaxByCr = new HashMap<>();
        for (CrCount entry : crCounts) {
            int n = entry.count();
            double cr = entry.cr();
            if (cr <= median) {
                lowMaxByCr.merge(cr, n, Math::max);
            } else {
                highMaxByCr.merge(cr, n, Math::max);
            }
        }

        int low = 0;
        for (int v : lowMaxByCr.values()) low += v;
        int high = 0;
        for (int v : highMaxByCr.values()) high += v;
        return new CrStats(median, low, high);
    }
}
