package features.encounter.service.combat;

import features.encounter.model.EncounterCreatureSnapshot;
import features.gamerules.model.LootCoins;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Immutable combat-preparation slot with per-creature loot assignment. */
public record PreparedEncounterSlot(
        EncounterCreatureSnapshot creature,
        int count,
        List<LootCoins> perCreatureLoot) {

    public PreparedEncounterSlot {
        creature = Objects.requireNonNull(creature, "creature must be non-null");
        if (count < 1) {
            throw new IllegalArgumentException("count must be >= 1");
        }
        if (perCreatureLoot == null || perCreatureLoot.size() != count) {
            throw new IllegalArgumentException("perCreatureLoot size must match count");
        }
        List<LootCoins> copy = new ArrayList<>(perCreatureLoot.size());
        for (LootCoins loot : perCreatureLoot) {
            LootCoins safeValue = loot == null ? LootCoins.zero() : loot;
            if (safeValue.totalCp() < 0) {
                throw new IllegalArgumentException("perCreatureLoot values must be >= 0");
            }
            copy.add(safeValue);
        }
        perCreatureLoot = List.copyOf(copy);
    }
}
