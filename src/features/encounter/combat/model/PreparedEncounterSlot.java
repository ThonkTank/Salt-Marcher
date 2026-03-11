package features.encounter.combat.model;

import features.encounter.model.EncounterCreatureSnapshot;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Immutable combat-preparation slot with per-creature loot assignment. */
public record PreparedEncounterSlot(
        EncounterCreatureSnapshot creature,
        int count,
        List<CombatLoot> perCreatureLoot) {

    public PreparedEncounterSlot {
        creature = Objects.requireNonNull(creature, "creature must be non-null");
        if (count < 1) {
            throw new IllegalArgumentException("count must be >= 1");
        }
        if (perCreatureLoot == null || perCreatureLoot.size() != count) {
            throw new IllegalArgumentException("perCreatureLoot size must match count");
        }
        List<CombatLoot> copy = new ArrayList<>(perCreatureLoot.size());
        for (CombatLoot loot : perCreatureLoot) {
            CombatLoot safeValue = loot == null ? CombatLoot.empty() : loot;
            if (safeValue.coins().totalCpValue() < 0) {
                throw new IllegalArgumentException("perCreatureLoot coin values must be >= 0");
            }
            copy.add(safeValue);
        }
        perCreatureLoot = List.copyOf(copy);
    }
}
