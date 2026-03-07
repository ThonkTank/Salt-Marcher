package features.encounter.service.generation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import features.encounter.service.rules.EncounterMobSlotRules;


final class ShapePlanner {

    record Block(int slotCount, int count, double share) {}
    record ShapePlan(List<Integer> slotPartition, List<Integer> counts) {}

    private static final int MAX_CREATURES_PER_SLOT = EncounterSearchEngine.MAX_CREATURES_PER_SLOT;
    private static final Map<Integer, List<Integer>> SLOT_COUNT_OPTIONS_CACHE = new ConcurrentHashMap<>();

    private ShapePlanner() {}

    static int sumCounts(List<Integer> counts) {
        int s = 0;
        for (int c : counts) s += c;
        return s;
    }

    static List<Integer> partitionSlots(int totalSlots, int parts, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (parts <= 0 || totalSlots < parts) return List.of();
        List<Integer> out = new ArrayList<>();
        int remainingSlots = totalSlots;
        int remainingParts = parts;
        for (int i = 0; i < parts; i++) {
            if (remainingParts == 1) {
                out.add(remainingSlots);
                break;
            }
            int minHere = 1;
            int maxHere = remainingSlots - (remainingParts - 1);
            int chosen = ctx.nextInt(minHere, maxHere + 1);
            out.add(chosen);
            remainingSlots -= chosen;
            remainingParts--;
        }
        return out;
    }

    static List<Integer> pickCountsForPartition(List<Integer> slotPartition,
                                                double amountValue,
                                                int targetCreatures,
                                                GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        List<Integer> counts = new ArrayList<>();
        int usedCreatures = 0;
        for (int i = 0; i < slotPartition.size(); i++) {
            int slots = slotPartition.get(i);
            List<Integer> options = countOptionsForSlots(slots);
            if (options.isEmpty()) return List.of();

            int minRemaining = 0;
            int maxRemaining = 0;
            for (int j = i + 1; j < slotPartition.size(); j++) {
                minRemaining += slotPartition.get(j);
                maxRemaining += slotPartition.get(j) * MAX_CREATURES_PER_SLOT;
            }

            List<Integer> filtered = new ArrayList<>();
            for (int n : options) {
                if (targetCreatures == Integer.MAX_VALUE) {
                    filtered.add(n);
                    continue;
                }
                int after = usedCreatures + n;
                if (after + minRemaining > targetCreatures) continue;
                if (after + maxRemaining < targetCreatures) continue;
                filtered.add(n);
            }
            if (filtered.isEmpty()) return List.of();

            int picked = weightedRandomCount(filtered, amountValue, ctx);
            counts.add(picked);
            usedCreatures += picked;
        }
        return counts;
    }

    static List<Double> sampleShares(int count, int balanceLevel, GenerationContext context) {
        GenerationContext ctx = context != null ? context : GenerationContext.defaultContext();
        if (count <= 0) return List.of();
        if (count == 1) return List.of(1.0);

        double alpha = switch (balanceLevel) {
            case 1 -> 0.35;
            case 2 -> 0.7;
            case 3 -> 1.0;
            case 4 -> 2.0;
            case 5 -> 4.0;
            default -> 1.0;
        };

        List<Double> raw = new ArrayList<>();
        double sum = 0.0;
        for (int i = 0; i < count; i++) {
            double u = Math.max(1e-6, ctx.nextDouble());
            double v = Math.pow(u, 1.0 / alpha);
            raw.add(v);
            sum += v;
        }

        List<Double> out = new ArrayList<>();
        for (double v : raw) out.add(v / sum);
        return out;
    }

    static List<Block> sortBlocksForSearch(List<Block> blocks) {
        List<Block> out = new ArrayList<>(blocks);
        out.sort(Comparator
                .comparingInt(Block::count).reversed()
                .thenComparing(Comparator.comparingDouble((Block b) -> Math.abs(b.share() - 0.5)).reversed())
                .thenComparing(Comparator.comparingInt(Block::slotCount).reversed()));
        return out;
    }

    static List<ShapePlan> buildFeasibleShapePlans(int targetSlots, int targetCreatures, int maxTypes) {
        if (targetSlots <= 0 || targetCreatures <= 0 || maxTypes <= 0) return List.of();
        List<ShapePlan> out = new ArrayList<>();
        for (int typeCount = 1; typeCount <= maxTypes; typeCount++) {
            List<Integer> slotPartition = new ArrayList<>();
            buildSlotPartitions(targetSlots, typeCount, slotPartition, out, targetCreatures);
        }
        return out;
    }

    private static List<Integer> countOptionsForSlots(int slotCount) {
        return SLOT_COUNT_OPTIONS_CACHE.computeIfAbsent(slotCount, sc -> {
            List<Integer> out = new ArrayList<>();
            int maxN = Math.max(3, sc * MAX_CREATURES_PER_SLOT);
            for (int n = 1; n <= maxN; n++) {
                if (EncounterMobSlotRules.splitForMobSlots(n).size() == sc) out.add(n);
            }
            return List.copyOf(out);
        });
    }

    private static int weightedRandomCount(List<Integer> options, double amountValue, GenerationContext context) {
        int min = Integer.MAX_VALUE;
        int max = Integer.MIN_VALUE;
        for (int n : options) {
            min = Math.min(min, n);
            max = Math.max(max, n);
        }
        List<Double> weights = new ArrayList<>();
        double preference = (amountValue - 3.0) / 2.0;
        for (int n : options) {
            double t = (max == min) ? 0.5 : (n - min) / (double) (max - min);
            double w = Math.exp(preference * (t - 0.5) * 3.0);
            weights.add(w);
        }
        return options.get(CandidateScorer.weightedRandomIndex(weights, context));
    }

    private static void buildSlotPartitions(int remainingSlots,
                                            int remainingTypes,
                                            List<Integer> currentPartition,
                                            List<ShapePlan> out,
                                            int targetCreatures) {
        if (remainingTypes == 0) {
            if (remainingSlots == 0) buildCountPlansForPartition(currentPartition, targetCreatures, out);
            return;
        }
        int minHere = 1;
        int maxHere = remainingSlots - (remainingTypes - 1);
        for (int s = minHere; s <= maxHere; s++) {
            currentPartition.add(s);
            buildSlotPartitions(remainingSlots - s, remainingTypes - 1, currentPartition, out, targetCreatures);
            currentPartition.remove(currentPartition.size() - 1);
        }
    }

    private static void buildCountPlansForPartition(List<Integer> slotPartition,
                                                    int targetCreatures,
                                                    List<ShapePlan> out) {
        List<Integer> currentCounts = new ArrayList<>();
        buildCountsRec(slotPartition, 0, 0, targetCreatures, currentCounts, out);
    }

    private static void buildCountsRec(List<Integer> slotPartition,
                                       int idx,
                                       int sumSoFar,
                                       int targetCreatures,
                                       List<Integer> currentCounts,
                                       List<ShapePlan> out) {
        if (idx >= slotPartition.size()) {
            if (sumSoFar == targetCreatures) out.add(new ShapePlan(List.copyOf(slotPartition), List.copyOf(currentCounts)));
            return;
        }

        List<Integer> options = countOptionsForSlots(slotPartition.get(idx));
        if (options.isEmpty()) return;

        int minRemaining = 0;
        int maxRemaining = 0;
        for (int i = idx + 1; i < slotPartition.size(); i++) {
            int slots = slotPartition.get(i);
            minRemaining += slots;
            maxRemaining += slots * MAX_CREATURES_PER_SLOT;
        }

        for (int n : options) {
            int after = sumSoFar + n;
            if (after + minRemaining > targetCreatures) continue;
            if (after + maxRemaining < targetCreatures) continue;
            currentCounts.add(n);
            buildCountsRec(slotPartition, idx + 1, after, targetCreatures, currentCounts, out);
            currentCounts.remove(currentCounts.size() - 1);
        }
    }
}
