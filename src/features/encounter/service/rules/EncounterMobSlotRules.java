package features.encounter.service.rules;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared mob-slot partitioning policy used by encounter generation and runtime combat grouping.
 */
public final class EncounterMobSlotRules {
    private EncounterMobSlotRules() {
        throw new AssertionError("No instances");
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
        if (count <= EncounterRules.MAX_CREATURES_PER_SLOT) return List.of(count);

        int k = (int) Math.ceil(count / (double) EncounterRules.MAX_CREATURES_PER_SLOT);
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
}
