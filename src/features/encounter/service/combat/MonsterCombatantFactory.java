package features.encounter.service.combat;

import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterSlot;
import features.encounter.model.MonsterCombatant;

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
            EncounterSlot slot,
            int creatureIndex,
            int initiative,
            RandomGenerator random) {
        Objects.requireNonNull(slot, "slot");
        Objects.requireNonNull(random, "random");
        if (slot.getCreature() == null) {
            throw new IllegalArgumentException("slot creature must be non-null");
        }
        if (creatureIndex < 1 || creatureIndex > slot.getCount()) {
            throw new IllegalArgumentException("creatureIndex must be within slot count");
        }

        int lootGold = lootFor(slot.getPerCreatureLootGold(), creatureIndex);
        MonsterCombatant combatant = create(slot.getCreature(), initiative, lootGold, random);
        if (slot.getCount() > 1) {
            combatant.rename(slot.getCreature().getName() + " #" + creatureIndex);
        }
        return combatant;
    }

    static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature) {
        return createReinforcement(creature, ThreadLocalRandom.current());
    }

    static MonsterCombatant createReinforcement(EncounterCreatureSnapshot creature, RandomGenerator random) {
        Objects.requireNonNull(creature, "creature");
        return create(creature, InitiativeRoller.rollFor(creature), 0, random);
    }

    private static MonsterCombatant create(
            EncounterCreatureSnapshot creature,
            int initiative,
            int lootGold,
            RandomGenerator random) {
        int rolledHp = HitPointRoller.rollFor(creature, random);
        return new MonsterCombatant(
                creature.getName(),
                initiative,
                creature.getInitiativeBonus(),
                rolledHp,
                rolledHp,
                creature.getAc(),
                lootGold,
                creature);
    }

    private static int lootFor(List<Integer> perCreatureLoot, int creatureIndex) {
        if (perCreatureLoot == null || perCreatureLoot.size() < creatureIndex) {
            return 0;
        }
        Integer value = perCreatureLoot.get(creatureIndex - 1);
        return value == null ? 0 : value;
    }
}
