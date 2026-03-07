package features.encounter.service.combat;

import features.encounter.model.EncounterCreatureSnapshot;

import java.util.concurrent.ThreadLocalRandom;

public final class InitiativeRoller {
    private InitiativeRoller() {
        throw new AssertionError("No instances");
    }

    public static int rollWithBonus(int initiativeBonus) {
        return ThreadLocalRandom.current().nextInt(1, 21) + initiativeBonus;
    }

    public static int rollFor(EncounterCreatureSnapshot creature) {
        if (creature == null) {
            throw new IllegalArgumentException("creature must be non-null");
        }
        return rollWithBonus(creature.getInitiativeBonus());
    }
}
