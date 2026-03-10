package features.encounter.combat.service;

import features.encounter.model.EncounterCreatureSnapshot;
import features.gamerules.model.LootCoins;
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

        LootCoins lootCoins = lootFor(slot.perCreatureLoot(), creatureIndex);
        MonsterCombatant combatant = create(slot.creature(), initiative, lootCoins, random);
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
        return create(creature, InitiativeRoller.rollFor(creature), LootCoins.zero(), random);
    }

    private static MonsterCombatant create(
            EncounterCreatureSnapshot creature,
            int initiative,
            LootCoins lootCoins,
            RandomGenerator random) {
        int rolledHp = HitPointRoller.rollFor(creature, random);
        return new MonsterCombatant(
                creature.getName(),
                initiative,
                creature.getInitiativeBonus(),
                rolledHp,
                rolledHp,
                creature.getAc(),
                lootCoins,
                creature);
    }

    private static LootCoins lootFor(List<LootCoins> perCreatureLoot, int creatureIndex) {
        if (perCreatureLoot == null || perCreatureLoot.size() < creatureIndex) {
            return LootCoins.zero();
        }
        LootCoins value = perCreatureLoot.get(creatureIndex - 1);
        return value == null ? LootCoins.zero() : value;
    }
}
