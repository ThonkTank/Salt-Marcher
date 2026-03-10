package features.encounter.combat.service;

import features.creatures.model.HitDice;
import features.encounter.model.EncounterCreatureSnapshot;

import java.util.Objects;
import java.util.OptionalInt;
import java.util.concurrent.ThreadLocalRandom;
import java.util.random.RandomGenerator;

public final class HitPointRoller {
    private HitPointRoller() {
        throw new AssertionError("No instances");
    }

    public static int rollFor(EncounterCreatureSnapshot creature) {
        return rollFor(creature, ThreadLocalRandom.current());
    }

    static int rollFor(EncounterCreatureSnapshot creature, RandomGenerator random) {
        if (creature == null) {
            throw new IllegalArgumentException("creature must be non-null");
        }
        return rollFromHitDice(creature.getHitDice(), random).orElse(creature.getHp());
    }

    static OptionalInt rollFromHitDice(HitDice hitDice) {
        return rollFromHitDice(hitDice, ThreadLocalRandom.current());
    }

    static OptionalInt rollFromHitDice(HitDice hitDice, RandomGenerator random) {
        Objects.requireNonNull(random, "random");
        if (hitDice == null) return OptionalInt.empty();
        return OptionalInt.of(hitDice.roll(random));
    }
}
