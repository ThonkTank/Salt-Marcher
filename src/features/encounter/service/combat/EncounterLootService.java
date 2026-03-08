package features.encounter.service.combat;

import features.encounter.model.EncounterSlot;
import features.gamerules.model.LootCoins;
import features.encounter.service.generation.GenerationContext;
import features.gamerules.service.LootCalculator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Assigns encounter loot to concrete creature instances before combat starts.
 */
public final class EncounterLootService {
    private static final double LOOT_VARIATION_MIN = 0.90;
    private static final double LOOT_VARIATION_MAX = 1.10;
    private static final int MAX_CP = Integer.MAX_VALUE;

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
            if (slot == null) {
                continue;
            }
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
        long totalCpLong = Math.max(0L, (long) totalGold) * LootCoins.CP_PER_GP;
        int totalCp = toIntSaturated(totalCpLong);
        if (totalCp <= 0) {
            List<List<LootCoins>> perSlotLoot = new ArrayList<>(assignedSlots.size());
            for (EncounterSlot slot : assignedSlots) {
                perSlotLoot.add(Collections.nCopies(slot.getCount(), LootCoins.zero()));
            }
            return toPreparedSlots(assignedSlots, perSlotLoot);
        }

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

        List<Integer> flatCp = distributeByXp(flatXp, totalCp, ctx);
        List<List<LootCoins>> perSlotLoot = new ArrayList<>(assignedSlots.size());
        for (int i = 0; i < assignedSlots.size(); i++) {
            perSlotLoot.add(new ArrayList<>());
        }
        for (int i = 0; i < flatCp.size(); i++) {
            perSlotLoot.get(slotIndices.get(i)).add(LootCoins.ofCp(flatCp.get(i)));
        }
        return toPreparedSlots(assignedSlots, perSlotLoot);
    }

    private static List<PreparedEncounterSlot> toPreparedSlots(
            List<EncounterSlot> assignedSlots,
            List<List<LootCoins>> perSlotLoot) {
        List<PreparedEncounterSlot> preparedSlots = new ArrayList<>(assignedSlots.size());
        for (int i = 0; i < assignedSlots.size(); i++) {
            EncounterSlot slot = assignedSlots.get(i);
            List<LootCoins> loot = perSlotLoot.get(i);
            preparedSlots.add(new PreparedEncounterSlot(slot.getCreature(), slot.getCount(), loot));
        }
        return List.copyOf(preparedSlots);
    }

    private static List<Integer> distributeByXp(List<Integer> flatXp, int totalCp, GenerationContext context) {
        List<Integer> assigned = new ArrayList<>(Collections.nCopies(flatXp.size(), 0));
        if (flatXp.isEmpty() || totalCp <= 0) {
            return assigned;
        }

        int xpSum = flatXp.stream().mapToInt(Integer::intValue).sum();
        if (xpSum <= 0) {
            fillUniformDistribution(assigned, totalCp, context);
            return assigned;
        }

        List<Double> weights = new ArrayList<>(flatXp.size());
        double totalWeight = 0.0;
        for (Integer value : flatXp) {
            int xp = Math.max(0, value == null ? 0 : value);
            double jitter = LOOT_VARIATION_MIN + ((LOOT_VARIATION_MAX - LOOT_VARIATION_MIN) * context.nextDouble());
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
            // Pick the top remainder fractional parts once; tiny jitter randomizes ties.
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
        return assigned;
    }

    private record ScoreEntry(int index, double score) {}

    private static int toIntSaturated(long value) {
        if (value <= 0L) {
            return 0;
        }
        return value >= MAX_CP ? MAX_CP : (int) value;
    }

    private static void fillUniformDistribution(List<Integer> assigned, int totalCp, GenerationContext context) {
        int base = totalCp / assigned.size();
        int remainder = totalCp % assigned.size();
        for (int i = 0; i < assigned.size(); i++) {
            assigned.set(i, base);
        }
        distributeUniformRemainder(assigned, remainder, context);
    }

    private static void distributeUniformRemainder(List<Integer> assigned, int remainder, GenerationContext context) {
        if (remainder <= 0 || assigned.isEmpty()) {
            return;
        }
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
}
