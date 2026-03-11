package features.encounter.combat.service;

import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.combat.model.CombatLoot;
import features.encounter.combat.model.MonsterCombatant;
import features.encounter.combat.model.PreparedEncounterSlot;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.random.RandomGenerator;

/** Creates monster combatants for slot expansion and reinforcements. */
public final class MonsterCombatantFactory {
    private MonsterCombatantFactory() {
        throw new AssertionError("No instances");
    }

    static MonsterCombatant createFromSlot(
            PreparedEncounterSlot slot,
            int creatureIndex,
            int initiative,
            RandomGenerator random) {
        Objects.requireNonNull(slot, "slot");
        Objects.requireNonNull(random, "random");
        if (creatureIndex < 1 || creatureIndex > slot.count()) {
            throw new IllegalArgumentException("creatureIndex must be within slot count");
        }

        CombatLoot loot = lootFor(slot.perCreatureLoot(), creatureIndex);
        MonsterCombatant combatant = create(slot.creature(), initiative, loot, random);
        if (slot.count() > 1) {
            combatant.rename(slot.creature().getName() + " #" + creatureIndex);
        }
        return combatant;
    }

    static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature) {
        return createReinforcement(creature, ThreadLocalRandom.current());
    }

    static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature, RandomGenerator random) {
        Objects.requireNonNull(creature, "creature");
        return create(creature, InitiativeRoller.rollFor(creature), CombatLoot.empty(), random);
    }

    private static MonsterCombatant create(
            EncounterCreatureSnapshot creature,
            int initiative,
            CombatLoot loot,
            RandomGenerator random) {
        int rolledHp = HitPointRoller.rollFor(creature, random);
        return new MonsterCombatant(
                creature.getName(),
                initiative,
                creature.getInitiativeBonus(),
                rolledHp,
                rolledHp,
                creature.getAc(),
                loot,
                creature);
    }

    private static CombatLoot lootFor(List<CombatLoot> perCreatureLoot, int creatureIndex) {
        if (perCreatureLoot == null || perCreatureLoot.size() < creatureIndex) {
            return CombatLoot.empty();
        }
        CombatLoot value = perCreatureLoot.get(creatureIndex - 1);
        return value == null ? CombatLoot.empty() : value;
    }
}
